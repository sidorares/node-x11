const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

// Node has no built-in way to create SysV shared memory segments (and the
// zero-dependency rule forbids native addons), so a real Attach/PutImage
// round-trip through an actual segment cannot be tested here. Instead the
// wire format is validated with controlled X errors: a request that reaches
// the server, is parsed correctly and rejected with the exact expected error
// code/badParam proves the encoding, the opcode wiring and the registration
// of the extension's BadSeg error parser.

describe('MIT-SHM extension', () => {
    let X, root, depth, shm;

    before(function(t, done) {
        x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            depth = dpy.screen[0].root_depth;
            X.require('shm', (err, ext) => {
                assert.ifError(err);
                shm = ext;
                done();
            });
        });
    });

    it('QueryVersion (auto-called) should report at least 1.1 and a sane pixmap format', function() {
        assert.strictEqual(shm.major, 1);
        assert.ok(shm.minor >= 1);
        assert.strictEqual(typeof shm.sharedPixmaps, 'boolean');
        // pixmapFormat is one of the core image formats; only meaningful
        // when shared pixmaps are supported
        if (shm.sharedPixmaps)
            assert.strictEqual(shm.pixmapFormat, shm.ImageFormat.ZPixmap);
        assert.strictEqual(typeof shm.uid, 'number');
        assert.strictEqual(typeof shm.gid, 'number');
    });

    it('QueryVersion round-trip should match the cached values', function(t, done) {
        shm.QueryVersion((err, vers) => {
            assert.ifError(err);
            assert.strictEqual(vers.majorVersion, shm.major);
            assert.strictEqual(vers.minorVersion, shm.minor);
            assert.strictEqual(vers.sharedPixmaps, shm.sharedPixmaps);
            assert.strictEqual(vers.pixmapFormat, shm.pixmapFormat);
            done();
        });
    });

    it('Attach with a bogus shmid should raise BadAccess from the SHM opcode', function(t, done) {
        const seg = X.AllocID();
        // the SEG XID is fresh and valid, so the server gets past the XID
        // check and fails in shmat() on the bogus shmid -> core BadAccess
        // (the extension BadSeg error is only raised for unattached SEG XIDs,
        // covered by the tests below)
        shm.Attach(seg, 0x7fffffff, false);
        const seq = X.seq_num;
        X.once('error', err => {
            assert.strictEqual(err.error, 10); // BadAccess
            assert.strictEqual(err.seq, seq);
            assert.strictEqual(err.majorOpcode, shm.majorOpcode);
            assert.strictEqual(err.minorOpcode, 1);
            done();
        });
    });

    it('Detach of an unattached segment should raise the extension BadSeg error', function(t, done) {
        const seg = X.AllocID();
        shm.Detach(seg);
        const seq = X.seq_num;
        X.once('error', err => {
            assert.strictEqual(err.error, shm.firstError + shm.errors.BadSeg);
            assert.strictEqual(err.seq, seq);
            assert.strictEqual(err.badParam, seg);
            assert.strictEqual(err.majorOpcode, shm.majorOpcode);
            assert.strictEqual(err.minorOpcode, 2);
            assert.match(err.message, /MIT-SHM/);
            done();
        });
    });

    it('PutImage with an unattached segment should raise BadSeg', function(t, done) {
        const gc = X.AllocID();
        X.CreateGC(gc, root);
        const seg = X.AllocID();
        shm.PutImage(root, gc, {
            totalWidth: 4, totalHeight: 4,
            srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
            dstX: 0, dstY: 0,
            depth: depth, format: shm.ImageFormat.ZPixmap,
            sendEvent: false, shmseg: seg, offset: 0
        });
        const seq = X.seq_num;
        X.once('error', err => {
            assert.strictEqual(err.error, shm.firstError + shm.errors.BadSeg);
            assert.strictEqual(err.seq, seq);
            assert.strictEqual(err.badParam, seg);
            assert.strictEqual(err.minorOpcode, 3);
            X.FreeGC(gc);
            done();
        });
    });

    it('GetImage with an unattached segment should raise BadSeg via the reply callback', function(t, done) {
        const seg = X.AllocID();
        shm.GetImage(root, 0, 0, 4, 4, 0xffffffff,
            shm.ImageFormat.ZPixmap, seg, 0, err => {
                assert.ok(err != null);
                assert.strictEqual(err.error, shm.firstError + shm.errors.BadSeg);
                assert.strictEqual(err.badParam, seg);
                assert.strictEqual(err.minorOpcode, 4);
                done();
                return true; // handled - don't re-emit on the client
            });
    });

    it('CreatePixmap with an unattached segment should raise BadSeg', function(t, done) {
        if (!shm.sharedPixmaps) {
            t.skip(); // server would answer BadImplementation
            return done();
        }
        const pid = X.AllocID();
        const seg = X.AllocID();
        shm.CreatePixmap(pid, root, 4, 4, depth, seg, 0);
        const seq = X.seq_num;
        X.once('error', err => {
            assert.strictEqual(err.error, shm.firstError + shm.errors.BadSeg);
            assert.strictEqual(err.seq, seq);
            assert.strictEqual(err.badParam, seg);
            assert.strictEqual(err.minorOpcode, 5);
            done();
        });
    });

    it('ShmCompletion event parser should decode the wire layout', function() {
        // cannot trigger a real completion event without a live segment, so
        // feed the registered parser a hand-built event body (bytes 8..31 of
        // the 32-byte event) and check the field mapping
        const parser = X.eventParsers[shm.firstEvent + shm.events.ShmCompletion];
        assert.ok(parser != null);
        const raw = Buffer.alloc(24);
        raw.writeUInt16LE(3, 0);          // minor_event
        raw.writeUInt8(130, 2);           // major_event
        raw.writeUInt32LE(0x00a00001, 4); // shmseg
        raw.writeUInt32LE(4096, 8);       // offset
        const ev = parser(shm.firstEvent, 42, 0x00500001, 0, raw);
        assert.strictEqual(ev.name, 'ShmCompletion');
        assert.strictEqual(ev.seq, 42);
        assert.strictEqual(ev.drawable, 0x00500001);
        assert.strictEqual(ev.minorEvent, 3);
        assert.strictEqual(ev.majorEvent, 130);
        assert.strictEqual(ev.shmseg, 0x00a00001);
        assert.strictEqual(ev.offset, 4096);
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});

// The high-level, provider-backed API. Unlike the wire tests above, these need
// a real attachable segment: the built-in provider (an fd-passed /dev/shm file)
// works on a local unix connection to a SHM 1.2 server (Linux CI/Xvfb). Where
// that is not available — a remote display, a server without 1.2, a platform
// without /dev/shm — `usable()` reports false and the round-trip tests skip,
// exactly as a real caller would fall back to core PutImage.
describe('MIT-SHM shared segments (provider-backed)', () => {
    let X, display, root, depth, shm, ok;

    before(function(t, done) {
        x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            display = dpy;
            root = dpy.screen[0].root;
            depth = dpy.screen[0].root_depth;
            X.require('shm', (err, ext) => {
                assert.ifError(err);
                shm = ext;
                ext.usable((e, usable) => {
                    assert.ifError(e);
                    ok = usable;
                    done();
                });
            });
        });
    });

    it('exposes isLocalSocket on the display', function() {
        assert.strictEqual(typeof display.isLocalSocket, 'boolean');
    });

    it('usable() resolves a boolean, cached, consistent with the provider', function(t, done) {
        assert.strictEqual(typeof ok, 'boolean');
        if (ok) {
            assert.ok(shm.provider != null);
            assert.strictEqual(shm.fdCapable, true);
        }
        // second call is cached and must agree
        shm.usable((e, ok2) => {
            assert.ifError(e);
            assert.strictEqual(ok2, ok);
            done();
        });
    });

    it('createSegment -> putImage round-trips real pixels', function(t, done) {
        if (!ok) {
            t.skip();
            return done();
        }
        const W = 64, H = 64, size = W * H * 4;
        shm.createSegment(size, (err, seg) => {
            assert.ifError(err);
            assert.strictEqual(typeof seg.shmseg, 'number');
            assert.strictEqual(seg.size, size);
            for (let i = 0; i < size; i++)
                seg.buffer[i] = (i * 37) & 0xff;
            const pid = X.AllocID();
            const gc = X.AllocID();
            X.CreatePixmap(pid, root, depth, W, H);
            X.CreateGC(gc, pid);
            seg.putImage(pid, gc, { width: W, height: H, depth: depth });
            X.GetImage(2, pid, 0, 0, W, H, 0xffffffff, (err, img) => {
                assert.ifError(err);
                let bad = 0;
                for (let i = 0; i < size; i += 4)
                    if (img.data[i] !== seg.buffer[i] ||
                        img.data[i + 1] !== seg.buffer[i + 1] ||
                        img.data[i + 2] !== seg.buffer[i + 2]) bad++;
                assert.strictEqual(bad, 0);
                X.FreeGC(gc);
                X.FreePixmap(pid);
                seg.detach(done);
            });
        });
    });

    it('shm GetImage reads pixels back into the segment buffer', function(t, done) {
        if (!ok) {
            t.skip();
            return done();
        }
        const W = 48, H = 48, size = W * H * 4;
        shm.createSegment(size, (err, seg) => {
            assert.ifError(err);
            for (let i = 0; i < size; i++)
                seg.buffer[i] = (i * 53) & 0xff;
            const pid = X.AllocID();
            const gc = X.AllocID();
            X.CreatePixmap(pid, root, depth, W, H);
            X.CreateGC(gc, pid);
            seg.putImage(pid, gc, { width: W, height: H, depth: depth });
            const reference = Buffer.from(seg.buffer);
            seg.buffer.fill(0);
            seg.getImage(pid, 0, 0, W, H, 0xffffffff, undefined, 0, (err, rep) => {
                assert.ifError(err);
                assert.strictEqual(rep.size, size);
                let bad = 0;
                for (let i = 0; i < size; i += 4)
                    if (seg.buffer[i] !== reference[i] ||
                        seg.buffer[i + 1] !== reference[i + 1] ||
                        seg.buffer[i + 2] !== reference[i + 2]) bad++;
                assert.strictEqual(bad, 0);
                X.FreeGC(gc);
                X.FreePixmap(pid);
                seg.detach(done);
            });
        });
    });

    it('emits ShmCompletion on the segment when putImage sends an event', function(t, done) {
        if (!ok) {
            t.skip();
            return done();
        }
        const W = 32, H = 32, size = W * H * 4;
        shm.createSegment(size, (err, seg) => {
            assert.ifError(err);
            const pid = X.AllocID();
            const gc = X.AllocID();
            X.CreatePixmap(pid, root, depth, W, H);
            X.CreateGC(gc, pid);
            seg.once('complete', offset => {
                assert.strictEqual(offset, 0);
                X.FreeGC(gc);
                X.FreePixmap(pid);
                seg.detach(done);
            });
            seg.putImage(pid, gc, { width: W, height: H, depth: depth, sendEvent: true });
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});

// Disabling SHM must be a clean, non-throwing "no fast path", so callers can
// probe once and route to core requests.
describe('MIT-SHM disabled (shm: false)', () => {
    it('usable() is false and createSegment fails without throwing', function(t, done) {
        x11.createClient({ shm: false }, (err, dpy) => {
            assert.ifError(err);
            const X = dpy.client;
            assert.strictEqual(typeof dpy.isLocalSocket, 'boolean');
            X.require('shm', (err, ext) => {
                assert.ifError(err);
                assert.strictEqual(ext.fdCapable, false);
                assert.ok(ext.provider == null);
                ext.usable((e, ok) => {
                    assert.ifError(e);
                    assert.strictEqual(ok, false);
                    ext.createSegment(4096, err => {
                        assert.ok(err != null);
                        X.terminate();
                        X.on('end', done);
                    });
                });
            });
        });
    });
});

// A segment attach is asynchronous — the descriptor goes out after a flush,
// and the confirming round trip after that. A client that closes in between
// used to make the attach path issue a request on a closing connection, which
// throws out of a callback and takes the process down. Closing mid-attach must
// report an error on the callback instead.
describe('MIT-SHM attach racing connection close', () => {
    it('reports an error instead of throwing when the client closes mid-attach', function(t, done) {
        x11.createClient((err, dpy) => {
            assert.ifError(err);
            const X = dpy.client;
            X.on('error', () => {}); // teardown noise is not the subject
            X.require('shm', (err, ext) => {
                assert.ifError(err);
                if (!ext.provider) {
                    X.terminate();
                    return X.on('end', () => done());
                }
                let settled = false;
                ext.createSegment(64 * 1024, err => {
                    // may succeed (won the race) or fail, but must not throw
                    settled = true;
                    if (err) assert.ok(err instanceof Error);
                });
                // close() while the attach is still in flight: it sets the
                // client's closing flag, which is what made the confirming
                // round trip throw out of the fd-send callback
                X.close();
                setTimeout(() => {
                    assert.strictEqual(settled, true, 'the attach callback was answered');
                    done();
                }, 300);
            });
        });
    });
});
