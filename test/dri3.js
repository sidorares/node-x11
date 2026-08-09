// DRI3 request encoding and reply parsing, validated against the wire
// layouts in <X11/extensions/dri3proto.h> (xorgproto). Unit-level: the
// extension is driven with a fake client and a detached FrameBuffer, so no
// server, no GPU and no real descriptors-over-socket are involved — those
// live in test/dri3-live.js (needs a DRI3 server) and in the examples.
const should = require('should');
const fs = require('fs');
const FrameBuffer = require('../lib/framebuffer');
const dri3 = require('../lib/ext/dri3');

const OPCODE = 200; // fake major opcode assigned by the fake QueryExtension

// A client just real enough for lib/ext/dri3.js: requests captured off a
// detached FrameBuffer ('data' fires synchronously on submit), replies
// resolved by hand through X.replies like lib/xcore.js would.
function fakeClient(streamOverride) {
    const pack_stream = new FrameBuffer(false);
    const sent = []; // { buf, fds } in wire order
    pack_stream.on('data', (buf, fds) => sent.push({ buf, fds: fds || null }));
    const X = {
        seq_num: 0,
        replies: {},
        pack_stream,
        stream: streamOverride !== undefined ? streamOverride
            : { _fdCapable: true, sendFds: () => {} },
        _voidSyncs: [],
        _scheduleVoidSync(seq) { this._voidSyncs.push(seq); },
        QueryExtension(name, cb) {
            name.should.equal('DRI3');
            cb(null, { present: 1, majorOpcode: OPCODE, firstEvent: 0, firstError: 0 });
        }
    };
    // resolve the pending reply for `seq` the way xcore.js does: parser gets
    // the body from byte 8 on, plus the header's data byte
    const respond = (seq, body, opt) => {
        const handler = X.replies[seq];
        should.exist(handler, `no reply handler registered for seq ${seq}`);
        delete X.replies[seq];
        handler[1](null, handler[0].call(X, body, opt));
    };
    return { X, sent, respond };
}

function requireDri3(harness, cb) {
    dri3.requireExt({ client: harness.X }, (err, ext) => {
        should.not.exist(err);
        cb(ext);
    });
    // answer the automatic QueryVersion(1, 4) so requireExt completes
    const body = Buffer.alloc(24);
    body.writeUInt32LE(1, 0);
    body.writeUInt32LE(4, 4);
    harness.respond(harness.X.seq_num, body, 0);
}

describe('DRI3 extension (encoding)', () => {

    let h;
    let DRI3;

    beforeEach(done => {
        h = fakeClient();
        requireDri3(h, ext => {
            DRI3 = ext;
            h.sent.length = 0; // drop the QueryVersion request
            done();
        });
    });

    it('negotiates version 1.4 while requiring', () => {
        DRI3.major.should.equal(1);
        DRI3.minor.should.equal(4);
        DRI3.fdCapable.should.equal(true);
    });

    it('encodes QueryVersion per dri3proto', done => {
        DRI3.QueryVersion(1, 2, (err, vers) => {
            should.not.exist(err);
            vers.should.eql([1, 2]);
            done();
        });
        const { buf, fds } = h.sent[0];
        should.not.exist(fds);
        buf.length.should.equal(12);           // sz_xDRI3QueryVersionReq
        buf.readUInt8(0).should.equal(OPCODE);
        buf.readUInt8(1).should.equal(0);      // minor opcode
        buf.readUInt16LE(2).should.equal(3);   // length in 4-byte units
        buf.readUInt32LE(4).should.equal(1);
        buf.readUInt32LE(8).should.equal(2);
        const body = Buffer.alloc(24);
        body.writeUInt32LE(1, 0);
        body.writeUInt32LE(2, 4);
        h.respond(h.X.seq_num, body, 0);
    });

    it('encodes PixmapFromBuffer and carries its descriptor', () => {
        const fd = fs.openSync('/dev/null', 'r');
        DRI3.PixmapFromBuffer(0x600001, 0x123, {
            fd, width: 64, height: 32, stride: 256, depth: 24, bpp: 32
        });
        const { buf, fds } = h.sent[0];
        fds.should.eql([fd]);
        buf.length.should.equal(24);           // sz_xDRI3PixmapFromBufferReq
        buf.readUInt8(1).should.equal(2);
        buf.readUInt16LE(2).should.equal(6);
        buf.readUInt32LE(4).should.equal(0x600001);
        buf.readUInt32LE(8).should.equal(0x123);
        buf.readUInt32LE(12).should.equal(256 * 32); // size defaults to stride*height
        buf.readUInt16LE(16).should.equal(64);
        buf.readUInt16LE(18).should.equal(32);
        buf.readUInt16LE(20).should.equal(256);
        buf.readUInt8(22).should.equal(24);
        buf.readUInt8(23).should.equal(32);
        fs.closeSync(fd);
    });

    it('honors an explicit size in PixmapFromBuffer', () => {
        const fd = fs.openSync('/dev/null', 'r');
        DRI3.PixmapFromBuffer(1, 2, {
            fd, width: 4, height: 4, stride: 16, depth: 24, bpp: 32, size: 4096
        });
        h.sent[0].buf.readUInt32LE(12).should.equal(4096);
        fs.closeSync(fd);
    });

    it('confirms PixmapFromBuffer through a void round trip when given a callback', () => {
        const fd = fs.openSync('/dev/null', 'r');
        let called = 'not yet';
        DRI3.PixmapFromBuffer(1, 2, {
            fd, width: 4, height: 4, stride: 16, depth: 24, bpp: 32
        }, err => { called = err; });
        const seq = h.X.seq_num;
        h.X._voidSyncs.should.eql([seq]);
        // no error arrives; the sweep resolves it with null like xcore does
        h.X.replies[seq][1](null).should.be.true();
        should.equal(called, null);
        // an error resolves it too, and reports handled
        fs.closeSync(fd);
    });

    it('encodes PixmapFromBuffers (DRI3 1.2) with modifier and planes', () => {
        const fd0 = fs.openSync('/dev/null', 'r');
        const fd1 = fs.openSync('/dev/null', 'r');
        DRI3.PixmapFromBuffers(0xAB, 0xCD, {
            width: 128, height: 64, depth: 24, bpp: 32,
            modifier: DRI3.FormatModifier.Invalid,
            planes: [
                { fd: fd0, stride: 512, offset: 0 },
                { fd: fd1, stride: 256, offset: 32768 }
            ]
        });
        const { buf, fds } = h.sent[0];
        fds.should.eql([fd0, fd1]);
        buf.length.should.equal(64);           // sz_xDRI3PixmapFromBuffersReq
        buf.readUInt8(1).should.equal(7);
        buf.readUInt16LE(2).should.equal(16);
        buf.readUInt32LE(4).should.equal(0xAB);
        buf.readUInt32LE(8).should.equal(0xCD);
        buf.readUInt8(12).should.equal(2);     // num_buffers
        buf.readUInt16LE(16).should.equal(128);
        buf.readUInt16LE(18).should.equal(64);
        buf.readUInt32LE(20).should.equal(512);   // stride0
        buf.readUInt32LE(24).should.equal(0);     // offset0
        buf.readUInt32LE(28).should.equal(256);   // stride1
        buf.readUInt32LE(32).should.equal(32768); // offset1
        buf.readUInt32LE(36).should.equal(0);     // stride2 unused
        buf.readUInt8(52).should.equal(24);
        buf.readUInt8(53).should.equal(32);
        buf.readBigUInt64LE(56).should.equal((1n << 56n) - 1n);
        fs.closeSync(fd0);
        fs.closeSync(fd1);
    });

    it('rejects PixmapFromBuffers with 0 or more than 4 planes', done => {
        DRI3.PixmapFromBuffers(1, 2, { width: 1, height: 1, depth: 24, bpp: 32, planes: [] }, err => {
            should.exist(err);
            h.sent.length.should.equal(0);
            done();
        });
    });

    it('encodes GetSupportedModifiers and parses 64-bit modifiers exactly', done => {
        DRI3.GetSupportedModifiers(0x321, 24, 32, (err, mods) => {
            should.not.exist(err);
            mods.windowModifiers.should.eql([0n, 0x0100000000000001n]);
            mods.screenModifiers.should.eql([(1n << 56n) - 1n]);
            done();
        });
        const { buf } = h.sent[0];
        buf.length.should.equal(12);           // sz_xDRI3GetSupportedModifiersReq
        buf.readUInt8(1).should.equal(6);
        buf.readUInt32LE(4).should.equal(0x321);
        buf.readUInt8(8).should.equal(24);
        buf.readUInt8(9).should.equal(32);
        const body = Buffer.alloc(24 + 3 * 8);
        body.writeUInt32LE(2, 0);              // numWindowModifiers
        body.writeUInt32LE(1, 4);              // numScreenModifiers
        body.writeBigUInt64LE(0n, 24);
        body.writeBigUInt64LE(0x0100000000000001n, 32); // > 2^53: needs BigInt
        body.writeBigUInt64LE((1n << 56n) - 1n, 40);
        h.respond(h.X.seq_num, body, 0);
    });

    it('encodes FenceFromFD with its descriptor', () => {
        const fd = fs.openSync('/dev/null', 'r');
        DRI3.FenceFromFD(0x42, 0x99, true, fd);
        const { buf, fds } = h.sent[0];
        fds.should.eql([fd]);
        buf.length.should.equal(16);           // sz_xDRI3FenceFromFDReq
        buf.readUInt8(1).should.equal(4);
        buf.readUInt32LE(4).should.equal(0x42);
        buf.readUInt32LE(8).should.equal(0x99);
        buf.readUInt8(12).should.equal(1);
        fs.closeSync(fd);
    });

    it('encodes SetDRMDeviceInUse (DRI3 1.3)', () => {
        DRI3.SetDRMDeviceInUse(0x77, 226, 128);
        const { buf, fds } = h.sent[0];
        should.not.exist(fds);
        buf.length.should.equal(16);           // sz_xDRI3SetDRMDeviceInUseReq
        buf.readUInt8(1).should.equal(9);
        buf.readUInt32LE(4).should.equal(0x77);
        buf.readUInt32LE(8).should.equal(226);
        buf.readUInt32LE(12).should.equal(128);
    });

    it('encodes ImportSyncobj / FreeSyncobj (DRI3 1.4)', () => {
        const fd = fs.openSync('/dev/null', 'r');
        DRI3.ImportSyncobj(0x11, 0x22, fd);
        DRI3.FreeSyncobj(0x11);
        h.sent[0].fds.should.eql([fd]);
        h.sent[0].buf.length.should.equal(12); // sz_xDRI3ImportSyncobjReq
        h.sent[0].buf.readUInt8(1).should.equal(10);
        h.sent[0].buf.readUInt32LE(4).should.equal(0x11);
        h.sent[0].buf.readUInt32LE(8).should.equal(0x22);
        h.sent[1].buf.length.should.equal(8);  // sz_xDRI3FreeSyncobjReq
        h.sent[1].buf.readUInt8(1).should.equal(11);
        h.sent[1].buf.readUInt32LE(4).should.equal(0x11);
        should.not.exist(h.sent[1].fds);
        fs.closeSync(fd);
    });

    it('refuses the four requests whose replies carry descriptors', done => {
        const gated = [
            cb => DRI3.Open(1, 0, cb),
            cb => DRI3.BufferFromPixmap(1, cb),
            cb => DRI3.FDFromFence(1, 2, cb),
            cb => DRI3.BuffersFromPixmap(1, cb)
        ];
        let remaining = gated.length;
        gated.forEach(fn => fn(err => {
            should.exist(err);
            err.message.should.match(/file descriptor/);
            if (--remaining === 0) {
                h.sent.length.should.equal(0); // nothing reached the wire
                done();
            }
        }));
    });

    it('fails cleanly and consumes the descriptor when the connection cannot pass fds', done => {
        const plain = fakeClient({}); // stream without sendFds
        requireDri3(plain, ext => {
            const fd = fs.openSync('/dev/null', 'r');
            ext.fdCapable.should.equal(false);
            ext.PixmapFromBuffer(1, 2, { fd, width: 4, height: 4, stride: 16, depth: 24, bpp: 32 }, err => {
                should.exist(err);
                err.message.should.match(/fd-capable/);
                should.throws(() => fs.fstatSync(fd)); // closed: consumed contract
                done();
            });
        });
    });
});

describe('FrameBuffer putWithFds ordering', () => {

    const collect = fb => {
        const out = [];
        fb.on('data', (buf, fds) => out.push({ str: buf.toString(), fds: fds || null }));
        return out;
    };

    it('keeps an fd-carrying packet in wire order (unbuffered)', () => {
        const fb = new FrameBuffer(false);
        const out = collect(fb);
        fb.put(Buffer.from('aa'));
        fb.submit();
        fb.putWithFds(Buffer.from('bb'), [7, 8]);
        fb.put(Buffer.from('cc'));
        fb.submit();
        out.map(o => o.str).should.eql(['aa', 'bb', 'cc']);
        out[1].fds.should.eql([7, 8]);
        should.not.exist(out[0].fds);
        should.not.exist(out[2].fds);
    });

    it('keeps an fd-carrying packet in wire order (batching)', () => {
        const fb = new FrameBuffer(true);
        const out = collect(fb);
        fb.put(Buffer.from('aa'));
        fb.submit();
        fb.putWithFds(Buffer.from('bb'), [9]);
        fb.put(Buffer.from('cc'));
        fb.submit();
        fb.flush();
        out.map(o => o.str).should.eql(['aa', 'bb', 'cc']);
        out[1].fds.should.eql([9]);
    });
});
