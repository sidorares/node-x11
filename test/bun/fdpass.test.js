// The Bun transport (lib/fdpass-bun.js), end to end over a real unix socket.
//
// Run with `npm run test:bun` (= `bun test test/bun`). Nothing here runs under
// Node — mocha and test-runner.js never look into test subdirectories — and
// that is the point: this is the half of the library Node cannot reach.
//
// The peer side is built here with its own hand-rolled sendmsg/recvmsg through
// bun:ffi rather than by importing the module under test, so a mistake in the
// msghdr/cmsghdr layouts cannot cancel itself out.

const { test, expect, beforeAll, afterAll } = require('bun:test');
const { dlopen, ptr, read } = require('bun:ffi');
const fs = require('fs');
const os = require('os');
const path = require('path');

const fdpass = require('../../lib/fdpass');
const x11 = require('../../lib');

// --- the peer side: unix listener + descriptor-passing, built from scratch ---

const isDarwin = process.platform === 'darwin';
const libc = dlopen(isDarwin ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6', {
    socket:  { args: ['int', 'int', 'int'], returns: 'int' },
    bind:    { args: ['int', 'ptr', 'int'], returns: 'int' },
    listen:  { args: ['int', 'int'], returns: 'int' },
    accept:  { args: ['int', 'ptr', 'ptr'], returns: 'int' },
    sendmsg: { args: ['int', 'ptr', 'int'], returns: 'i64' },
    recvmsg: { args: ['int', 'ptr', 'int'], returns: 'i64' },
    close:   { args: ['int'], returns: 'int' },
    ...(isDarwin
        ? { __error: { args: [], returns: 'ptr' } }
        : { __errno_location: { args: [], returns: 'ptr' } })
}).symbols;

const errno = () => read.i32(isDarwin ? libc.__error() : libc.__errno_location(), 0);

const CMSG_HDR = isDarwin ? 12 : 16;
const align = n => (isDarwin ? (n + 3) & ~3 : (n + 7) & ~7);
const SOL_SOCKET = isDarwin ? 0xffff : 1;
const SCM_RIGHTS = 1;
const MSG_DONTWAIT = isDarwin ? 0x80 : 0x40;
const EAGAIN = isDarwin ? 35 : 11;

function msghdr(iov, ctl, ctlLen) {
    const m = Buffer.alloc(56);
    m.writeBigUInt64LE(BigInt(ptr(iov)), 16);
    if (isDarwin) m.writeInt32LE(1, 24);
    else m.writeBigUInt64LE(1n, 24);
    if (ctlLen > 0) {
        m.writeBigUInt64LE(BigInt(ptr(ctl)), 32);
        if (isDarwin) m.writeUInt32LE(ctlLen, 40);
        else m.writeBigUInt64LE(BigInt(ctlLen), 40);
    }
    return m;
}

function iovec(buf) {
    const iov = Buffer.alloc(16);
    iov.writeBigUInt64LE(BigInt(ptr(buf)), 0);
    iov.writeBigUInt64LE(BigInt(buf.length), 8);
    return iov;
}

// send `data` on `fd`, with `fds` as SCM_RIGHTS ancillary data
function peerSend(fd, data, fds) {
    const payload = 4 * fds.length;
    const ctl = Buffer.alloc(fds.length ? align(CMSG_HDR) + align(payload) : 0);
    if (fds.length) {
        if (isDarwin) ctl.writeUInt32LE(CMSG_HDR + payload, 0);
        else ctl.writeBigUInt64LE(BigInt(CMSG_HDR + payload), 0);
        ctl.writeInt32LE(SOL_SOCKET, isDarwin ? 4 : 8);
        ctl.writeInt32LE(SCM_RIGHTS, isDarwin ? 8 : 12);
        fds.forEach((v, i) => ctl.writeInt32LE(v, CMSG_HDR + 4 * i));
    }
    const m = msghdr(iovec(data), ctl, ctl.length);
    const n = Number(libc.sendmsg(fd, ptr(m), 0));
    expect(n).toBe(data.length);
}

// one non-blocking recvmsg: { n, data, fds } (n < 0 means "nothing yet")
function peerRecv(fd, max) {
    const data = Buffer.alloc(max);
    const ctl = Buffer.alloc(align(CMSG_HDR) + align(4 * 16));
    const m = msghdr(iovec(data), ctl, ctl.length);
    const n = Number(libc.recvmsg(fd, ptr(m), MSG_DONTWAIT));
    const fds = [];
    if (n > 0) {
        const ctlLen = isDarwin ? m.readUInt32LE(40) : Number(m.readBigUInt64LE(40));
        let off = 0;
        while (off + CMSG_HDR <= ctlLen) {
            const len = isDarwin ? ctl.readUInt32LE(off) : Number(ctl.readBigUInt64LE(off));
            if (len < CMSG_HDR) break;
            if (ctl.readInt32LE(off + (isDarwin ? 4 : 8)) === SOL_SOCKET &&
                ctl.readInt32LE(off + (isDarwin ? 8 : 12)) === SCM_RIGHTS)
                for (let p = off + CMSG_HDR; p + 4 <= off + len; p += 4)
                    fds.push(ctl.readInt32LE(p));
            off += align(len);
        }
    }
    return { n, data: data.subarray(0, Math.max(n, 0)), fds };
}

// keep recvmsg'ing until `want` bytes have arrived, recording where each
// descriptor turned up in the stream
async function peerRecvAll(fd, want) {
    const chunks = [];
    const marks = []; // { offset, fds }
    let total = 0;
    const deadline = Date.now() + 5000;
    while (total < want && Date.now() < deadline) {
        const got = peerRecv(fd, 1 << 16);
        if (got.n < 0) {
            expect(errno()).toBe(EAGAIN);
            await Bun.sleep(1);
            continue;
        }
        if (got.n === 0) break;
        if (got.fds.length)
            marks.push({ offset: total, fds: got.fds });
        chunks.push(got.data);
        total += got.n;
    }
    return { bytes: Buffer.concat(chunks), marks };
}

const AF_UNIX = 1;
const SOCK_STREAM = 1;

function listenUnix(socketPath) {
    const sa = Buffer.alloc(2 + (isDarwin ? 104 : 108));
    if (isDarwin) {
        sa.writeUInt8(sa.length, 0);
        sa.writeUInt8(AF_UNIX, 1);
    } else {
        sa.writeUInt16LE(AF_UNIX, 0);
    }
    sa.write(socketPath, 2);
    const fd = libc.socket(AF_UNIX, SOCK_STREAM, 0);
    expect(fd).toBeGreaterThanOrEqual(0);
    expect(libc.bind(fd, ptr(sa), sa.length)).toBe(0);
    expect(libc.listen(fd, 4)).toBe(0);
    return fd;
}

// --- fixtures ---------------------------------------------------------------

let dir;
let payloadPath;
const PAYLOAD = 'descriptors really do cross\n';
const open = () => fs.openSync(payloadPath, 'r');
const readThrough = fd => {
    const buf = Buffer.alloc(PAYLOAD.length);
    fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.toString();
};
const once = (emitter, event) => new Promise((resolve, reject) => {
    emitter.once(event, resolve);
    emitter.once('error', reject);
});

let sockCounter = 0;
// a connected pair: our transport on one side, a raw descriptor on the other
async function connectPair(options) {
    const socketPath = path.join(dir, `s${sockCounter++}`);
    const listener = listenUnix(socketPath);
    const client = fdpass.connect(socketPath, options);
    expect(client).not.toBe(null);
    await once(client, 'connect');
    const peer = libc.accept(listener, null, null);
    expect(peer).toBeGreaterThanOrEqual(0);
    libc.close(listener);
    fs.unlinkSync(socketPath);
    return { client, peer };
}

beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'x11-fdpass-'));
    payloadPath = path.join(dir, 'payload');
    fs.writeFileSync(payloadPath, PAYLOAD);
});

afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

// --- tests ------------------------------------------------------------------

test('fd passing is available under Bun', () => {
    expect(fdpass.available()).toBe(true);
});

test('sendFds puts the request bytes and the descriptor on the wire', async () => {
    const { client, peer } = await connectPair();
    expect(client._fdCapable).toBe(true);

    const fd = open();
    const sent = new Promise(resolve => client.sendFds(Buffer.from('REQ0'), [fd], resolve));
    expect(await sent).toBe(null);
    // consumed: the descriptor handed to sendFds is closed once it is sent
    // (before the peer receives it, or its number could be handed straight
    // back to us as the received one)
    expect(() => fs.fstatSync(fd)).toThrow();

    const { bytes, marks } = await peerRecvAll(peer, 4);
    expect(bytes.toString()).toBe('REQ0');
    expect(marks.length).toBe(1);
    expect(readThrough(marks[0].fds[0])).toBe(PAYLOAD);

    marks[0].fds.forEach(f => fs.closeSync(f));
    libc.close(peer);
    client.destroy();
});

test('several descriptors ride one request', async () => {
    const { client, peer } = await connectPair();
    const fds = [open(), open(), open()];
    const sent = new Promise(resolve => client.sendFds(Buffer.from('MULTI'), fds, resolve));
    expect(await sent).toBe(null);

    const { bytes, marks } = await peerRecvAll(peer, 5);
    expect(bytes.toString()).toBe('MULTI');
    expect(marks.length).toBe(1);
    expect(marks[0].fds.length).toBe(3);
    marks[0].fds.forEach(f => {
        expect(readThrough(f)).toBe(PAYLOAD);
        fs.closeSync(f);
    });
    libc.close(peer);
    client.destroy();
});

// The ancillary data lands on the byte it was sent with, so a descriptor
// request queued behind bytes Bun has not managed to write yet must wait for
// them — and everything written after it must wait for it in turn.
test('an fd request keeps its place behind buffered output', async () => {
    const { client, peer } = await connectPair();
    const filler = Buffer.alloc(1 << 22, 0x41); // 4 MB: more than any send buffer
    client.write(filler);
    expect(client.writableLength).toBeGreaterThan(0);

    const fd = open();
    const sent = new Promise(resolve => client.sendFds(Buffer.from('FDREQ'), [fd], resolve));
    client.write(Buffer.from('AFTER'));

    const total = filler.length + 5 + 5;
    const { bytes, marks } = await peerRecvAll(peer, total);
    expect(await sent).toBe(null);
    expect(bytes.length).toBe(total);
    expect(bytes.subarray(filler.length).toString()).toBe('FDREQAFTER');
    expect(marks.length).toBe(1);
    // The descriptor cannot turn up after the bytes it belongs to. It may turn
    // up before them: Linux glues queued messages into one read and hands over
    // the descriptors of the first one carrying any, so it arrives with
    // whatever preceded it (macOS stops at the message boundary and reports
    // exactly `filler.length`).
    expect(marks[0].offset).toBeLessThanOrEqual(filler.length);
    expect(readThrough(marks[0].fds[0])).toBe(PAYLOAD);

    fs.closeSync(marks[0].fds[0]);
    libc.close(peer);
    client.destroy();
}, 20000);

test('a receiving connection takes descriptors off the wire', async () => {
    const { client, peer } = await connectPair({ receiveFds: true });
    expect(client._fdCapable).toBe(true);
    expect(client._fdReceiving).toBe(true);

    const chunks = [];
    let takenWith = null; // what takeFds() gives while the marked bytes arrive
    client.on('data', chunk => {
        chunks.push(chunk.toString());
        if (chunk.toString().includes('WITHFD'))
            takenWith = client.takeFds(1);
    });

    const fd = open();
    peerSend(peer, Buffer.from('PLAIN'), []);
    peerSend(peer, Buffer.from('WITHFD'), [fd]);
    peerSend(peer, Buffer.from('TAIL'), []);
    fs.closeSync(fd);

    const deadline = Date.now() + 5000;
    while (chunks.join('').length < 15 && Date.now() < deadline)
        await Bun.sleep(1);

    expect(chunks.join('')).toBe('PLAINWITHFDTAIL');
    // the descriptor is queued before the bytes it belongs to are handed over,
    // which is what lets a reply parser take it while parsing that reply
    expect(takenWith).not.toBe(null);
    expect(takenWith.length).toBe(1);
    expect(readThrough(takenWith[0])).toBe(PAYLOAD);
    expect(client.takeFds(1)).toEqual([]);

    fs.closeSync(takenWith[0]);
    libc.close(peer);
    client.destroy();
});

test('a receiving connection writes, reports end of stream and closes', async () => {
    const { client, peer } = await connectPair({ receiveFds: true });

    client.write(Buffer.from('PING'));
    const { bytes } = await peerRecvAll(peer, 4);
    expect(bytes.toString()).toBe('PING');

    const ended = once(client, 'end');
    const closed = once(client, 'close');
    peerSend(peer, Buffer.from('BYE'), []);
    libc.close(peer);
    await ended;
    await closed;
    expect(client.destroyed).toBe(true);
});

test('a receiving connection shuts its write side down on end()', async () => {
    const { client, peer } = await connectPair({ receiveFds: true });
    client.write(Buffer.from('LAST'));
    client.end();

    const { bytes } = await peerRecvAll(peer, 4);
    expect(bytes.toString()).toBe('LAST');
    // the peer now sees end of stream
    const deadline = Date.now() + 5000;
    let n = -1;
    while (n !== 0 && Date.now() < deadline) {
        n = peerRecv(peer, 16).n;
        if (n < 0) await Bun.sleep(1);
    }
    expect(n).toBe(0);
    libc.close(peer);
    client.destroy();
});

test('connect reports a missing socket as ENOENT so the caller can fall back', async () => {
    const client = fdpass.connect(path.join(dir, 'not-there'), { receiveFds: true });
    const err = await new Promise(resolve => client.once('error', resolve));
    expect(err.code).toBe('ENOENT');
});

// --- against a real X server -------------------------------------------------

const haveDisplay = !!process.env.DISPLAY;
const liveTest = haveDisplay ? test : test.skip;

liveTest('a local connection is fd-capable', async () => {
    const display = await new Promise((resolve, reject) => {
        x11.createClient((err, dpy) => (err ? reject(err) : resolve(dpy)));
    });
    const X = display.client;
    expect(X.stream._fdCapable).toBe(true);
    await new Promise(resolve => X.close(resolve));
});

liveTest('the receiving transport carries the protocol', async () => {
    const display = await new Promise((resolve, reject) => {
        x11.createClient({ receiveFds: true }, (err, dpy) => (err ? reject(err) : resolve(dpy)));
    });
    const X = display.client;
    expect(X.stream._fdReceiving).toBe(true);

    const root = display.screen[0].root;
    const wid = X.AllocID();
    X.CreateWindow(wid, root, 0, 0, 64, 32);
    const geometry = await new Promise((resolve, reject) => {
        X.GetGeometry(wid, (err, g) => (err ? reject(err) : resolve(g)));
    });
    expect(geometry.width).toBe(64);
    expect(geometry.height).toBe(32);

    // a reply larger than one read, to exercise the recvmsg loop
    const name = Buffer.alloc(60000, 0x78);
    X.ChangeProperty(0, root, X.atoms.WM_NAME, X.atoms.STRING, 8, name);
    const prop = await new Promise((resolve, reject) => {
        X.GetProperty(0, root, X.atoms.WM_NAME, X.atoms.STRING, 0, 60000,
            (err, p) => (err ? reject(err) : resolve(p)));
    });
    expect(prop.data.length).toBe(name.length);

    X.DestroyWindow(wid);
    await new Promise(resolve => X.close(resolve));
});
