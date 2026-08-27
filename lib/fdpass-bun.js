'use strict';

// File-descriptor passing under Bun.
//
// lib/fdpass.js reaches uv_write2 through process.binding('pipe_wrap') and
// ('stream_wrap'). Neither binding exists under Bun (oven-sh/bun#4957), so the
// probe there degrades to "no fd passing" and the whole descriptor-passing
// half of the library — MIT-SHM AttachFd, DRI3 PixmapFromBuffer(s) — is off.
// Bun has a different way in: `bun:ffi` can call sendmsg(2)/recvmsg(2)
// directly, and unlike Node it can do so in BOTH directions.
//
// dlopen, not cc(). bun:ffi's cc() would make the CMSG_* macros free, but it
// compiles against the system libc and headers at runtime, which a slim
// container need not have ("tcc: error: library 'c' not found"). Plain dlopen
// of sendmsg/recvmsg needs neither compiler nor headers — only hand-built
// msghdr/cmsghdr bytes, whose layouts differ between Linux and macOS but are
// small, fixed and documented (see "wire structs" below).
//
// Two transports, because receiving costs more than sending:
//
//   SEND ONLY — connect(path). An ordinary Bun net.Socket carries the
//   connection and sendFds() puts the request bytes on the wire with sendmsg()
//   on that socket's own descriptor. No extra threads, no change to how the
//   connection reads: this is the Node transport's behaviour, restored.
//
//   SEND AND RECEIVE — connect(path, { receiveFds: true }), reached from
//   createClient({ receiveFds: true }). Bun's socket reader does a plain
//   read(2), which silently DROPS ancillary data (no SIGABRT like Node — the
//   descriptor is simply lost), so a connection that must receive descriptors
//   cannot let Bun read it. This transport therefore owns the descriptor end
//   to end: recvmsg(2) from here, with read readiness coming from a worker
//   thread blocked in poll(2). That is what makes DRI3 Open, BufferFromPixmap,
//   BuffersFromPixmap and FDFromFence implementable under Bun at all.
//
// Ownership, both directions:
//   - descriptors handed to sendFds() are CONSUMED (closed once the message
//     is on the wire, or when it fails) — same contract as lib/fdpass.js;
//   - descriptors that arrive are OWNED BY THE CALLER once takeFds() hands
//     them over. Anything still queued when the connection is destroyed is
//     closed here rather than leaked.

const { EventEmitter } = require('events');
const fs = require('fs');

// require() behind an indirection. The specifiers loaded through it exist only
// on the runtime that uses them, and a bundler targeting the browser must
// neither resolve nor inline them — a computed specifier is not enough, since
// esbuild folds `'bun' + ':ffi'` straight back into a literal. Nothing here
// runs unless `Bun` is defined.
const nodeRequire = require;
const loadModule = name => nodeRequire(name);

const isDarwin = process.platform === 'darwin';
const supportedPlatform = isDarwin || process.platform === 'linux';

// ---------------------------------------------------------------------------
// libc through bun:ffi
// ---------------------------------------------------------------------------

const LIBC_CANDIDATES = isDarwin
    ? ['/usr/lib/libSystem.B.dylib']
    : ['libc.so.6', 'libc.so', 'libc.musl-x86_64.so.1', 'libc.musl-aarch64.so.1'];

// Only non-variadic entry points: fcntl(2) and ioctl(2) are variadic, and a
// variadic call made through a fixed FFI signature passes its arguments in the
// wrong place on arm64. Nothing here needs them — MSG_DONTWAIT makes every
// send and receive non-blocking per call, so the descriptor never has to be
// switched to O_NONBLOCK (which would also be visible to Bun's own socket).
const SYMBOLS = {
    socket:   { args: ['int', 'int', 'int'], returns: 'int' },
    connect:  { args: ['int', 'ptr', 'int'], returns: 'int' },
    sendmsg:  { args: ['int', 'ptr', 'int'], returns: 'i64' },
    recvmsg:  { args: ['int', 'ptr', 'int'], returns: 'i64' },
    send:     { args: ['int', 'ptr', 'u64', 'int'], returns: 'i64' },
    write:    { args: ['int', 'ptr', 'u64'], returns: 'i64' },
    shutdown: { args: ['int', 'int'], returns: 'int' },
    dup:      { args: ['int'], returns: 'int' },
    pipe:     { args: ['ptr'], returns: 'int' },
    close:    { args: ['int'], returns: 'int' }
};

const ERRNO_SYMBOL = isDarwin
    ? { __error: { args: [], returns: 'ptr' } }
    : { __errno_location: { args: [], returns: 'ptr' } };

let libc = null;
let libcProbed = false;

function loadLibc() {
    if (libcProbed)
        return libc;
    libcProbed = true;
    if (typeof Bun === 'undefined' || !supportedPlatform)
        return null;
    let ffi;
    try {
        ffi = loadModule('bun:ffi');
    } catch {
        return null;
    }
    for (const name of LIBC_CANDIDATES) {
        let lib;
        try {
            lib = ffi.dlopen(name, Object.assign({}, SYMBOLS, ERRNO_SYMBOL));
        } catch {
            continue; // not this libc — try the next candidate
        }
        const sym = lib.symbols;
        const errnoLocation = isDarwin ? sym.__error : sym.__errno_location;
        libc = {
            name,
            sym,
            ptr: ffi.ptr,
            errno: () => ffi.read.i32(errnoLocation(), 0)
        };
        break;
    }
    return libc;
}

// ---------------------------------------------------------------------------
// wire structs
//
// Both platforms are LP64 (8-byte pointers), and struct msghdr is 56 bytes on
// both, but two fields differ:
//
//   struct msghdr  msg_iovlen / msg_controllen are `int` + padding on macOS
//                  and `size_t` on Linux
//   struct cmsghdr { len; int level; int type; } — len is socklen_t (4 bytes)
//                  on macOS and size_t (8) on Linux, so the header is 12 vs 16
//                  bytes and the payload after it aligns to 4 vs 8
//   struct iovec   { void *base; size_t len; } — 16 bytes on both
// ---------------------------------------------------------------------------

const MSGHDR_SIZE = 56;
const OFF_IOV = 16;
const OFF_IOVLEN = 24;
const OFF_CONTROL = 32;
const OFF_CONTROLLEN = 40;
const OFF_FLAGS = 48;

const CMSG_HDR = isDarwin ? 12 : 16;
const cmsgAlign = n => (isDarwin ? (n + 3) & ~3 : (n + 7) & ~7);
const OFF_CMSG_LEVEL = isDarwin ? 4 : 8;
const OFF_CMSG_TYPE = isDarwin ? 8 : 12;

const AF_UNIX = 1;
const SOCK_STREAM = 1;
const SHUT_WR = 1;
const SOL_SOCKET = isDarwin ? 0xffff : 1;
const SCM_RIGHTS = 1;
const MSG_DONTWAIT = isDarwin ? 0x80 : 0x40;
const MSG_CTRUNC = isDarwin ? 0x20 : 0x08;
const EINTR = 4;
const EAGAIN = isDarwin ? 35 : 11; // == EWOULDBLOCK on both
const EMSGSIZE = isDarwin ? 40 : 90;
const ENOENT = 2;
const SUN_PATH_MAX = isDarwin ? 104 : 108;

// Descriptors per message. The X protocol never sends more than a handful
// (DRI3 BuffersFromPixmap: up to 4 planes); 16 is room to spare in a control
// buffer small enough to keep as a scratch allocation.
const MAX_FDS = 16;
const READ_SIZE = 65536;

// Scratch, reused for every call: these are pointed at by pointers handed to
// libc, so they must not move or be collected mid-call. Every use is
// synchronous and single-threaded, so one set is enough.
const msgScratch = Buffer.alloc(MSGHDR_SIZE);
const iovScratch = Buffer.alloc(16);
const ctlScratch = Buffer.alloc(cmsgAlign(CMSG_HDR) + cmsgAlign(4 * MAX_FDS));

function setMsghdr(iovPtr, ctlPtr, ctlLen) {
    msgScratch.fill(0);
    msgScratch.writeBigUInt64LE(BigInt(iovPtr), OFF_IOV);
    if (isDarwin)
        msgScratch.writeInt32LE(1, OFF_IOVLEN);
    else
        msgScratch.writeBigUInt64LE(1n, OFF_IOVLEN);
    if (ctlLen > 0) {
        msgScratch.writeBigUInt64LE(BigInt(ctlPtr), OFF_CONTROL);
        if (isDarwin)
            msgScratch.writeUInt32LE(ctlLen, OFF_CONTROLLEN);
        else
            msgScratch.writeBigUInt64LE(BigInt(ctlLen), OFF_CONTROLLEN);
    }
}

function setIovec(buf) {
    iovScratch.writeBigUInt64LE(BigInt(libc.ptr(buf)), 0);
    iovScratch.writeBigUInt64LE(BigInt(buf.length), 8);
}

// Send `buf` with `fds` attached as SCM_RIGHTS ancillary data. Returns the
// number of bytes accepted (a stream socket may take fewer than offered — the
// descriptors go with the bytes that were taken), or -1 with errno set.
function sendmsgWithFds(fd, buf, fds) {
    setIovec(buf);
    const payload = 4 * fds.length;
    const ctlLen = cmsgAlign(CMSG_HDR) + cmsgAlign(payload);
    ctlScratch.fill(0, 0, ctlLen);
    if (isDarwin)
        ctlScratch.writeUInt32LE(CMSG_HDR + payload, 0);
    else
        ctlScratch.writeBigUInt64LE(BigInt(CMSG_HDR + payload), 0);
    ctlScratch.writeInt32LE(SOL_SOCKET, OFF_CMSG_LEVEL);
    ctlScratch.writeInt32LE(SCM_RIGHTS, OFF_CMSG_TYPE);
    for (let i = 0; i < fds.length; i++)
        ctlScratch.writeInt32LE(fds[i], CMSG_HDR + 4 * i);
    setMsghdr(libc.ptr(iovScratch), libc.ptr(ctlScratch), ctlLen);
    return Number(libc.sym.sendmsg(fd, libc.ptr(msgScratch), MSG_DONTWAIT));
}

function sendPlain(fd, buf) {
    return Number(libc.sym.send(fd, libc.ptr(buf), BigInt(buf.length), MSG_DONTWAIT));
}

// One recvmsg into `buf`. Returns { n, fds }: n is the byte count (0 at end of
// stream, -1 with errno set on failure) and fds the descriptors that arrived
// with those bytes.
//
// Descriptors can arrive EARLY but never late. Linux glues queued messages
// into one read and hands over the descriptors of the first one that carries
// any (it stops there, so never two batches at once); macOS stops at the
// message boundary instead. Either way a descriptor is delivered no later than
// the bytes it belongs to — which is what makes the arrival-ordered queue in
// FdSocket, popped by the reply that declares them, the right model.
function recvmsgInto(fd, buf) {
    setIovec(buf);
    ctlScratch.fill(0);
    setMsghdr(libc.ptr(iovScratch), libc.ptr(ctlScratch), ctlScratch.length);
    const n = Number(libc.sym.recvmsg(fd, libc.ptr(msgScratch), MSG_DONTWAIT));
    if (n <= 0)
        return { n, fds: null, truncated: false };
    const controlLen = isDarwin
        ? msgScratch.readUInt32LE(OFF_CONTROLLEN)
        : Number(msgScratch.readBigUInt64LE(OFF_CONTROLLEN));
    const truncated = (msgScratch.readInt32LE(OFF_FLAGS) & MSG_CTRUNC) !== 0;
    let fds = null;
    let off = 0;
    while (off + CMSG_HDR <= controlLen) {
        const len = isDarwin
            ? ctlScratch.readUInt32LE(off)
            : Number(ctlScratch.readBigUInt64LE(off));
        if (len < CMSG_HDR)
            break;
        if (ctlScratch.readInt32LE(off + OFF_CMSG_LEVEL) === SOL_SOCKET &&
            ctlScratch.readInt32LE(off + OFF_CMSG_TYPE) === SCM_RIGHTS) {
            fds = fds || [];
            for (let p = off + CMSG_HDR; p + 4 <= off + len; p += 4)
                fds.push(ctlScratch.readInt32LE(p));
        }
        off += cmsgAlign(len);
    }
    return { n, fds, truncated };
}

function closeFds(fds) {
    for (const fd of fds) {
        try { fs.closeSync(fd); } catch { /* already gone */ }
    }
}

// sockaddr_un: { u8 len; u8 family; char path[104] } on macOS,
//              { u16 family; char path[108] } on Linux.
function sockaddrUn(socketPath) {
    const bytes = Buffer.byteLength(socketPath);
    if (bytes >= SUN_PATH_MAX)
        return null;
    const sa = Buffer.alloc(2 + SUN_PATH_MAX);
    if (isDarwin) {
        sa.writeUInt8(sa.length, 0);
        sa.writeUInt8(AF_UNIX, 1);
    } else {
        sa.writeUInt16LE(AF_UNIX, 0);
    }
    sa.write(socketPath, 2);
    return sa;
}

// ---------------------------------------------------------------------------
// send-only transport: an ordinary Bun net.Socket, plus sendFds()
// ---------------------------------------------------------------------------

const EMPTY = Buffer.alloc(0);
// How long to wait before retrying a descriptor-carrying write the kernel
// would not take, and for how long. Only reachable with the socket send buffer
// full — for the ~64 byte requests that carry descriptors, a server that has
// stopped reading — and giving up then poisons the connection the way a failed
// socket write does.
const SEND_RETRY_MS = 1;
const SEND_RETRY_LIMIT = 5000;

// Attach sendFds() to a connected Bun socket whose descriptor is `fd`.
//
// The bytes of an fd-carrying request must land where the output queue put
// them, and ancillary data attaches to the byte it is sent with — so a
// sendmsg() straight to the descriptor is only correct while Bun has nothing
// of its own buffered. When it has (writableLength > 0: the kernel would not
// take everything earlier writes offered), the request and everything written
// after it are held here until Bun's buffer has drained, and then replayed in
// order. socket.write is wrapped for exactly that window.
function attachSender(socket, fd) {
    socket._fdCapable = true;

    const rawWrite = socket.write;
    const queue = [];      // { chunk, cb } | { chunk, fds, cb, attempts }
    let holding = false;   // draining the queue: everything written goes on it
    let deferred = false;  // a write was held back, so a 'drain' is owed

    const finish = (item, err) => {
        if (item.fds)
            closeFds(item.fds); // consumed: sent, or given up on
        if (item.cb)
            item.cb(err || null);
    };

    // sendmsg the head of the queue, with everything before it already gone to
    // the kernel. Returns false when the kernel took nothing and the whole
    // thing should be retried.
    const sendHead = item => {
        if (socket.destroyed) {
            queue.shift();
            finish(item, new Error('connection is not fd-capable or already closed'));
            return true;
        }
        const sent = sendmsgWithFds(fd, item.chunk, item.fds);
        if (sent < 0) {
            const errno = libc.errno();
            // EMSGSIZE is how macOS reports "no room for this message right
            // now" when it carries control data; elsewhere it is EAGAIN.
            const wouldBlock = errno === EAGAIN || errno === EINTR || errno === EMSGSIZE;
            if (wouldBlock && item.attempts++ < SEND_RETRY_LIMIT)
                return false;
            queue.shift();
            finish(item, new Error(`fd write failed (errno ${errno})`));
            return true;
        }
        queue.shift();
        if (sent < item.chunk.length) {
            // Partial write: the descriptors went with the bytes the kernel
            // took, and the rest is plain bytes that must follow immediately.
            // Bun's buffer is empty here, so writing them keeps the order.
            closeFds(item.fds);
            item.fds = null;
            rawWrite.call(socket, item.chunk.subarray(sent), item.cb || undefined);
            return true;
        }
        finish(item, null);
        return true;
    };

    // Work through the queue in order. Nothing may overtake an fd request that
    // is still waiting, so the pump stops on anything that has to wait and is
    // resumed by the event that unblocks it.
    const pump = () => {
        while (queue.length > 0) {
            const item = queue[0];
            if (!item.fds) {
                queue.shift();
                rawWrite.call(socket, item.chunk, item.cb || undefined);
                continue;
            }
            if (socket.writableLength !== 0) {
                // Bun buffered more while we were held: wait for it again
                rawWrite.call(socket, EMPTY, pump);
                return;
            }
            if (!sendHead(item)) {
                // socket send buffer full: nothing of ours is queued in Bun,
                // so there is no 'drain' to wait for
                setTimeout(pump, SEND_RETRY_MS);
                return;
            }
        }
        holding = false;
        if (deferred) {
            // Those writes returned false, so the output queue is waiting for
            // a 'drain' Bun may never emit (it never backed up on its own).
            deferred = false;
            socket.emit('drain');
        }
    };

    socket.write = function(chunk, cb) {
        if (!holding)
            return rawWrite.call(socket, chunk, cb);
        queue.push({ chunk, cb: typeof cb === 'function' ? cb : null });
        deferred = true;
        return false;
    };

    socket.sendFds = function sendFds(reqBuffer, fds, cb) {
        const done = cb || null;
        if (fds.length === 0) {
            if (done) process.nextTick(() => done(new Error('sendFds: no descriptors given')));
            return;
        }
        if (fds.length > MAX_FDS) {
            closeFds(fds);
            if (done) process.nextTick(() => done(new Error(`sendFds: at most ${MAX_FDS} descriptors per request`)));
            return;
        }
        queue.push({ chunk: reqBuffer, fds, cb: done, attempts: 0 });
        if (!holding) {
            holding = true;
            pump();
        }
    };
}

// ---------------------------------------------------------------------------
// send-and-receive transport: the connection descriptor, owned here
// ---------------------------------------------------------------------------

// The reader thread. It blocks in poll(2) — which is exactly what Bun's event
// loop cannot be asked to do for a descriptor it does not own — and posts a
// message when the connection becomes readable or writable. It never touches
// the byte stream: recvmsg stays on the main thread, so data and descriptors
// need no thread hop and arrive in one piece.
//
// Main -> worker is a byte on a pipe (the poll wakes on it immediately):
//   'r' watch for readable again (sent once the main thread has drained)
//   'o' watch for writable / 'p' stop watching for writable
//   's' stop: close the descriptors this thread owns and exit
//
// The thread holds its own dup() of the connection, so a descriptor number
// reused after close() can never be polled by mistake.
const POLLER_SOURCE = `
'use strict';
const { parentPort, workerData } = require('worker_threads');
const ffi = require('bun' + ':ffi');
const lib = ffi.dlopen(workerData.libc, {
    poll:  { args: ['ptr', 'int', 'int'], returns: 'int' },
    read:  { args: ['int', 'ptr', 'u64'], returns: 'i64' },
    close: { args: ['int'], returns: 'int' }
});
const POLLIN = 1, POLLOUT = 4;
const sock = workerData.sock, wake = workerData.wake;
const pollfds = Buffer.alloc(16); // two struct pollfd { int fd; short ev; short rev; }
const commands = Buffer.alloc(64);
let watchRead = true, watchWrite = false, running = true, failures = 0;
while (running) {
    pollfds.writeInt32LE(sock, 0);
    pollfds.writeInt16LE((watchRead ? POLLIN : 0) | (watchWrite ? POLLOUT : 0), 4);
    pollfds.writeInt16LE(0, 6);
    pollfds.writeInt32LE(wake, 8);
    pollfds.writeInt16LE(POLLIN, 12);
    pollfds.writeInt16LE(0, 14);
    const rc = lib.symbols.poll(ffi.ptr(pollfds), 2, -1);
    if (rc < 0) {
        // EINTR: retry. A descriptor that has really gone bad shows up as
        // POLLNVAL below instead, so a poll that keeps failing is something
        // this thread cannot fix — say so rather than spin.
        if (++failures < 64) continue;
        parentPort.postMessage(-1);
        break;
    }
    failures = 0;
    const woken = pollfds.readInt16LE(14);
    if (woken) {
        const n = Number(lib.symbols.read(wake, ffi.ptr(commands), 64));
        for (let i = 0; i < n; i++) {
            const c = commands[i];
            if (c === 115) running = false;         // 's'
            else if (c === 114) watchRead = true;   // 'r'
            else if (c === 111) watchWrite = true;  // 'o'
            else if (c === 112) watchWrite = false; // 'p'
        }
        if (!running)
            break;
    }
    const revents = pollfds.readInt16LE(6);
    if (revents) {
        // Level-triggered: stop watching what fired until the main thread
        // says it has drained, or this loop would spin.
        if (revents & POLLIN) watchRead = false;
        if (revents & POLLOUT) watchWrite = false;
        parentPort.postMessage(revents);
    }
}
lib.symbols.close(sock);
lib.symbols.close(wake);
`;

const POLLIN = 1;
const POLLOUT = 4;
const POLLERR = 8;
const POLLHUP = 16;
const POLLNVAL = 32;

// A net.Socket stand-in over a raw connection descriptor: the subset the
// client and the output queue use (write/end/destroy, 'connect'/'data'/'end'/
// 'error'/'close'/'drain', writableLength for backpressure) plus sendFds() and
// takeFds().
class FdSocket extends EventEmitter {
    constructor(fd) {
        super();
        this._fd = fd;
        this._wake = -1;
        this._worker = null;
        this._backlog = [];        // { buf, off, fds, cb } — in wire order
        this._backlogBytes = 0;
        this._watchingWrite = false;
        this._readFds = [];        // received, waiting to be taken
        this._drainPending = false;
        this._shutdown = false;
        this.destroyed = false;
        this.writableEnded = false;
        this.readableEnded = false;
        this.readBuffer = null;
        // what lib/ext/{shm,dri3}.js and lib/fdpass.js users check
        this._fdCapable = true;
        this._fdReceiving = true;
    }

    get writableLength() {
        return this._backlogBytes;
    }

    // ---- reading ----------------------------------------------------------

    _startReader() {
        const { Worker } = loadModule('worker_threads');
        const pipefds = new Int32Array(2);
        if (libc.sym.pipe(libc.ptr(pipefds)) !== 0)
            throw new Error(`could not create the reader wake pipe (errno ${libc.errno()})`);
        const dup = libc.sym.dup(this._fd);
        if (dup < 0) {
            libc.sym.close(pipefds[0]);
            libc.sym.close(pipefds[1]);
            throw new Error(`could not duplicate the connection descriptor (errno ${libc.errno()})`);
        }
        this._wake = pipefds[1];
        try {
            // The worker source is inlined rather than kept in a sibling file
            // so that a bundled application (`bun build`) still has it.
            this._worker = new Worker(POLLER_SOURCE, {
                eval: true,
                workerData: { libc: libc.name, sock: dup, wake: pipefds[0] }
            });
        } catch (err) {
            // nothing owns these yet
            libc.sym.close(dup);
            libc.sym.close(pipefds[0]);
            libc.sym.close(pipefds[1]);
            this._wake = -1;
            throw err;
        }
        this._worker.on('message', revents => this._onReady(revents));
        this._worker.on('error', err => this._fail(err));
        this._worker.on('exit', () => {
            // it exits on 's', after destroy(); any other time it took the
            // read side with it
            if (!this.destroyed)
                this._fail(new Error('the connection reader thread stopped'));
        });
        // A blocked poll() keeps the thread alive, and with it the process —
        // which is what an open connection should do (a net.Socket does the
        // same). destroy() stops it.
    }

    _tell(command) {
        if (this._wake < 0)
            return;
        const byte = Buffer.from(command);
        libc.sym.write(this._wake, libc.ptr(byte), 1n);
    }

    _onReady(revents) {
        if (this.destroyed)
            return;
        if (revents < 0) {
            this._fail(new Error('waiting on the connection failed'));
            return;
        }
        if (revents & POLLNVAL) {
            this._fail(new Error('connection descriptor became invalid'));
            return;
        }
        if (revents & POLLOUT) {
            this._watchingWrite = false;
            this._flushBacklog();
        }
        if (!this.destroyed && (revents & (POLLIN | POLLHUP | POLLERR)))
            this._drainReads((revents & (POLLHUP | POLLERR)) !== 0);
    }

    // `hangup`: poll reported the peer gone. Then a read that comes up empty
    // is the end of the stream, not "nothing yet" — re-arming on it would put
    // this thread and the reader in a loop.
    _drainReads(hangup) {
        if (!this.readBuffer)
            this.readBuffer = Buffer.allocUnsafeSlow(READ_SIZE);
        for (;;) {
            const { n, fds, truncated } = recvmsgInto(this._fd, this.readBuffer);
            if (fds)
                this._readFds.push(...fds);
            if (truncated) {
                this._fail(new Error('descriptors were dropped: control message truncated'));
                return;
            }
            if (n > 0) {
                // A private copy: the read buffer is reused, and the frame
                // buffer keeps chunks until it has parsed them.
                this.emit('data', Buffer.from(this.readBuffer.subarray(0, n)));
                if (this.destroyed)
                    return;
                continue;
            }
            if (n === 0) {
                this._endOfStream();
                return;
            }
            const errno = libc.errno();
            if (errno === EAGAIN || errno === EINTR) {
                if (hangup)
                    this._endOfStream();
                else
                    this._tell('r'); // drained: watch for the next bytes
                return;
            }
            this._fail(errnoError('read from the connection failed', errno));
            return;
        }
    }

    _endOfStream() {
        this.readableEnded = true;
        this.emit('end');
        if (!this.destroyed)
            this.destroy();
    }

    // Descriptors arrive with the reply that declares them, so they are in the
    // queue by the time that reply is parsed. `n` of them, oldest first; the
    // caller owns them from here (and must close them).
    takeFds(n) {
        return this._readFds.splice(0, n);
    }

    // ---- writing ----------------------------------------------------------

    write(chunk, cb) {
        const done = typeof cb === 'function' ? cb : null;
        if (this.destroyed || this.writableEnded) {
            if (done)
                process.nextTick(() => done(new Error('write after end')));
            return false;
        }
        if (chunk.length === 0) {
            // the output queue's "tell me when everything so far is out" probe
            if (this._backlog.length > 0)
                this._queue({ buf: chunk, off: 0, fds: null, cb: done });
            else if (done)
                process.nextTick(done);
            return this._backlog.length === 0;
        }
        this._queue({ buf: chunk, off: 0, fds: null, cb: done });
        return this._flushBacklog();
    }

    sendFds(reqBuffer, fds, cb) {
        const done = cb || null;
        if (fds.length === 0) {
            if (done) process.nextTick(() => done(new Error('sendFds: no descriptors given')));
            return;
        }
        if (fds.length > MAX_FDS) {
            closeFds(fds);
            if (done) process.nextTick(() => done(new Error(`sendFds: at most ${MAX_FDS} descriptors per request`)));
            return;
        }
        if (this.destroyed || this.writableEnded) {
            closeFds(fds);
            if (done) process.nextTick(() => done(new Error('connection is not fd-capable or already closed')));
            return;
        }
        this._queue({ buf: reqBuffer, off: 0, fds, cb: done });
        this._flushBacklog();
    }

    _queue(item) {
        this._backlog.push(item);
        this._backlogBytes += item.buf.length - item.off;
    }

    // Write as much of the backlog as the kernel takes, in order. Returns
    // false when it stopped short, so callers can apply backpressure.
    _flushBacklog() {
        while (this._backlog.length > 0) {
            const item = this._backlog[0];
            const rest = item.buf.subarray(item.off);
            let sent = 0;
            if (rest.length > 0) {
                sent = item.fds ? sendmsgWithFds(this._fd, rest, item.fds)
                    : sendPlain(this._fd, rest);
                if (sent < 0) {
                    const errno = libc.errno();
                    // EMSGSIZE: macOS for "no room for this message right now"
                    // when it carries control data (EAGAIN everywhere else)
                    if (errno === EAGAIN || errno === EINTR || errno === EMSGSIZE) {
                        this._watchWritable();
                        return false;
                    }
                    this._fail(errnoError('write to the connection failed', errno));
                    return false;
                }
                if (item.fds) {
                    // on the wire with the first byte taken, consumed either way
                    closeFds(item.fds);
                    item.fds = null;
                }
            }
            item.off += sent;
            this._backlogBytes -= sent;
            if (item.off < item.buf.length) {
                this._watchWritable();
                return false;
            }
            this._backlog.shift();
            if (item.cb)
                process.nextTick(item.cb, null);
        }
        if (this._watchingWrite) {
            this._watchingWrite = false;
            this._tell('p');
        }
        if (this._drainPending) {
            this._drainPending = false;
            this.emit('drain');
        }
        if (this.writableEnded && !this._shutdown)
            this._shutdownWrite();
        return true;
    }

    _watchWritable() {
        this._drainPending = true;
        if (this._watchingWrite)
            return;
        this._watchingWrite = true;
        this._tell('o');
    }

    // ---- teardown ---------------------------------------------------------

    _shutdownWrite() {
        this._shutdown = true;
        libc.sym.shutdown(this._fd, SHUT_WR);
    }

    end() {
        if (this.writableEnded || this.destroyed)
            return this;
        this.writableEnded = true;
        if (this._flushBacklog() && !this._shutdown)
            this._shutdownWrite();
        return this;
    }

    destroy() {
        if (this.destroyed)
            return this;
        this.destroyed = true;
        this.writableEnded = true;
        this._tell('s'); // the thread closes its dup and the read end, then exits
        if (this._wake >= 0)
            libc.sym.close(this._wake);
        this._wake = -1;
        // Anything still queued is dropped, but its descriptors are consumed
        // (the contract) and received ones nobody took must not leak.
        for (const item of this._backlog) {
            if (item.fds)
                closeFds(item.fds);
        }
        this._backlog = [];
        this._backlogBytes = 0;
        closeFds(this._readFds);
        this._readFds = [];
        libc.sym.close(this._fd);
        this._fd = -1;
        process.nextTick(() => this.emit('close'));
        return this;
    }

    _fail(err) {
        if (this.destroyed)
            return;
        this.emit('error', err);
        this.destroy();
    }
}

function errnoError(message, errno) {
    const err = new Error(`${message} (errno ${errno})`);
    err.errno = errno;
    return err;
}

// ---------------------------------------------------------------------------
// entry points
// ---------------------------------------------------------------------------

// Whether this runtime can pass descriptors at all. Cheap and memoised.
function available() {
    return loadLibc() !== null;
}

// Connect to `socketPath`, fd-capable. Returns the connection synchronously,
// "connecting" (it emits 'connect' on success and 'error' on failure, like
// net.createConnection), or null when fd passing is unavailable so the caller
// falls back to a plain socket.
//
// With `options.receiveFds` the connection can also receive descriptors, at
// the cost of a reader thread; without it, it sends only, exactly like the
// Node transport in lib/fdpass.js.
function connect(socketPath, options) {
    const c = loadLibc();
    if (!c)
        return null;
    if (!(options && options.receiveFds))
        return connectSending(socketPath);
    return connectReceiving(socketPath);
}

function connectSending(socketPath) {
    let socket;
    try {
        const net = require('net');
        socket = net.createConnection(socketPath);
    } catch {
        return null; // any surprise -> caller uses a plain socket
    }
    socket.once('connect', () => {
        // Bun exposes the raw descriptor of a client socket here; without it
        // the connection still works, it just cannot pass descriptors.
        const fd = socket._handle && socket._handle.fd;
        if (typeof fd === 'number' && fd >= 0)
            attachSender(socket, fd);
    });
    return socket;
}

function connectReceiving(socketPath) {
    const sa = sockaddrUn(socketPath);
    if (!sa)
        return null; // path too long for sockaddr_un -> plain socket
    const fd = libc.sym.socket(AF_UNIX, SOCK_STREAM, 0);
    if (fd < 0)
        return null;
    const socket = new FdSocket(fd);
    // Blocking connect: a unix socket either has a listener or does not, and
    // this is the same descriptor Bun would have connected synchronously.
    if (libc.sym.connect(fd, libc.ptr(sa), sa.length) !== 0) {
        const errno = libc.errno();
        libc.sym.close(fd);
        socket._fd = -1;
        socket.destroyed = true;
        process.nextTick(() => {
            const err = errnoError(`connect to ${socketPath} failed`, errno);
            // surface ENOENT so the caller keeps its unix->TCP fallback
            err.code = errno === ENOENT ? 'ENOENT' : `E${errno}`;
            socket.emit('error', err);
        });
        return socket;
    }
    try {
        socket._startReader();
    } catch (err) {
        libc.sym.close(fd);
        socket._fd = -1;
        socket.destroyed = true;
        process.nextTick(() => socket.emit('error', err));
        return socket;
    }
    process.nextTick(() => {
        if (!socket.destroyed)
            socket.emit('connect');
    });
    return socket;
}

module.exports = { available, connect };
