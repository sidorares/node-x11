const x11 = require('../lib');
const should = require('should');

// Node has no built-in way to create SysV shared memory segments (and the
// zero-dependency rule forbids native addons), so a real Attach/PutImage
// round-trip through an actual segment cannot be tested here. Instead the
// wire format is validated with controlled X errors: a request that reaches
// the server, is parsed correctly and rejected with the exact expected error
// code/badParam proves the encoding, the opcode wiring and the registration
// of the extension's BadSeg error parser.

describe('MIT-SHM extension', () => {
    before(function(done) {
        const self = this;
        x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.depth = dpy.screen[0].root_depth;
            self.X.require('shm', (err, ext) => {
                should.not.exist(err);
                self.shm = ext;
                done();
            });
        });
    });

    it('QueryVersion (auto-called) should report at least 1.1 and a sane pixmap format', function() {
        this.shm.major.should.equal(1);
        this.shm.minor.should.be.aboveOrEqual(1);
        this.shm.sharedPixmaps.should.be.a.Boolean();
        // pixmapFormat is one of the core image formats; only meaningful
        // when shared pixmaps are supported
        if (this.shm.sharedPixmaps)
            this.shm.pixmapFormat.should.equal(this.shm.ImageFormat.ZPixmap);
        this.shm.uid.should.be.a.Number();
        this.shm.gid.should.be.a.Number();
    });

    it('QueryVersion round-trip should match the cached values', function(done) {
        const self = this;
        this.shm.QueryVersion((err, vers) => {
            should.not.exist(err);
            vers.majorVersion.should.equal(self.shm.major);
            vers.minorVersion.should.equal(self.shm.minor);
            vers.sharedPixmaps.should.equal(self.shm.sharedPixmaps);
            vers.pixmapFormat.should.equal(self.shm.pixmapFormat);
            done();
        });
    });

    it('Attach with a bogus shmid should raise BadAccess from the SHM opcode', function(done) {
        const self = this;
        const seg = this.X.AllocID();
        // the SEG XID is fresh and valid, so the server gets past the XID
        // check and fails in shmat() on the bogus shmid -> core BadAccess
        // (the extension BadSeg error is only raised for unattached SEG XIDs,
        // covered by the tests below)
        this.shm.Attach(seg, 0x7fffffff, false);
        const seq = this.X.seq_num;
        this.X.once('error', err => {
            err.error.should.equal(10); // BadAccess
            err.seq.should.equal(seq);
            err.majorOpcode.should.equal(self.shm.majorOpcode);
            err.minorOpcode.should.equal(1);
            done();
        });
    });

    it('Detach of an unattached segment should raise the extension BadSeg error', function(done) {
        const self = this;
        const seg = this.X.AllocID();
        this.shm.Detach(seg);
        const seq = this.X.seq_num;
        this.X.once('error', err => {
            err.error.should.equal(self.shm.firstError + self.shm.errors.BadSeg);
            err.seq.should.equal(seq);
            err.badParam.should.equal(seg);
            err.majorOpcode.should.equal(self.shm.majorOpcode);
            err.minorOpcode.should.equal(2);
            err.message.should.match(/MIT-SHM/);
            done();
        });
    });

    it('PutImage with an unattached segment should raise BadSeg', function(done) {
        const self = this;
        const gc = this.X.AllocID();
        this.X.CreateGC(gc, this.root);
        const seg = this.X.AllocID();
        this.shm.PutImage(this.root, gc, {
            totalWidth: 4, totalHeight: 4,
            srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
            dstX: 0, dstY: 0,
            depth: this.depth, format: this.shm.ImageFormat.ZPixmap,
            sendEvent: false, shmseg: seg, offset: 0
        });
        const seq = this.X.seq_num;
        this.X.once('error', err => {
            err.error.should.equal(self.shm.firstError + self.shm.errors.BadSeg);
            err.seq.should.equal(seq);
            err.badParam.should.equal(seg);
            err.minorOpcode.should.equal(3);
            self.X.FreeGC(gc);
            done();
        });
    });

    it('GetImage with an unattached segment should raise BadSeg via the reply callback', function(done) {
        const self = this;
        const seg = this.X.AllocID();
        this.shm.GetImage(this.root, 0, 0, 4, 4, 0xffffffff,
            this.shm.ImageFormat.ZPixmap, seg, 0, err => {
                should.exist(err);
                err.error.should.equal(self.shm.firstError + self.shm.errors.BadSeg);
                err.badParam.should.equal(seg);
                err.minorOpcode.should.equal(4);
                done();
                return true; // handled - don't re-emit on the client
            });
    });

    it('CreatePixmap with an unattached segment should raise BadSeg', function(done) {
        if (!this.shm.sharedPixmaps)
            return this.skip(); // server would answer BadImplementation
        const self = this;
        const pid = this.X.AllocID();
        const seg = this.X.AllocID();
        this.shm.CreatePixmap(pid, this.root, 4, 4, this.depth, seg, 0);
        const seq = this.X.seq_num;
        this.X.once('error', err => {
            err.error.should.equal(self.shm.firstError + self.shm.errors.BadSeg);
            err.seq.should.equal(seq);
            err.badParam.should.equal(seg);
            err.minorOpcode.should.equal(5);
            done();
        });
    });

    it('ShmCompletion event parser should decode the wire layout', function() {
        // cannot trigger a real completion event without a live segment, so
        // feed the registered parser a hand-built event body (bytes 8..31 of
        // the 32-byte event) and check the field mapping
        const parser = this.X.eventParsers[this.shm.firstEvent + this.shm.events.ShmCompletion];
        should.exist(parser);
        const raw = Buffer.alloc(24);
        raw.writeUInt16LE(3, 0);          // minor_event
        raw.writeUInt8(130, 2);           // major_event
        raw.writeUInt32LE(0x00a00001, 4); // shmseg
        raw.writeUInt32LE(4096, 8);       // offset
        const ev = parser(this.shm.firstEvent, 42, 0x00500001, 0, raw);
        ev.name.should.equal('ShmCompletion');
        ev.seq.should.equal(42);
        ev.drawable.should.equal(0x00500001);
        ev.minorEvent.should.equal(3);
        ev.majorEvent.should.equal(130);
        ev.shmseg.should.equal(0x00a00001);
        ev.offset.should.equal(4096);
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});

// The high-level, provider-backed API. Unlike the wire tests above, these need
// a real attachable segment: the built-in provider (an fd-passed /dev/shm file)
// works on a local unix connection to a SHM 1.2 server (Linux CI/Xvfb). Where
// that is not available — a remote display, a server without 1.2, a platform
// without /dev/shm — `usable()` reports false and the round-trip tests skip,
// exactly as a real caller would fall back to core PutImage.
describe('MIT-SHM shared segments (provider-backed)', () => {
    before(function(done) {
        const self = this;
        x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.display = dpy;
            self.root = dpy.screen[0].root;
            self.depth = dpy.screen[0].root_depth;
            self.X.require('shm', (err, ext) => {
                should.not.exist(err);
                self.shm = ext;
                ext.usable((e, ok) => {
                    should.not.exist(e);
                    self.ok = ok;
                    done();
                });
            });
        });
    });

    it('exposes isLocalSocket on the display', function() {
        this.display.isLocalSocket.should.be.a.Boolean();
    });

    it('usable() resolves a boolean, cached, consistent with the provider', function(done) {
        const self = this;
        this.ok.should.be.a.Boolean();
        if (this.ok) {
            should.exist(this.shm.provider);
            this.shm.fdCapable.should.equal(true);
        }
        // second call is cached and must agree
        this.shm.usable((e, ok2) => {
            should.not.exist(e);
            ok2.should.equal(self.ok);
            done();
        });
    });

    it('createSegment -> putImage round-trips real pixels', function(done) {
        if (!this.ok) return this.skip();
        const self = this;
        const W = 64, H = 64, size = W * H * 4;
        this.shm.createSegment(size, (err, seg) => {
            should.not.exist(err);
            seg.shmseg.should.be.a.Number();
            seg.size.should.equal(size);
            for (let i = 0; i < size; i++)
                seg.buffer[i] = (i * 37) & 0xff;
            const pid = self.X.AllocID();
            const gc = self.X.AllocID();
            self.X.CreatePixmap(pid, self.root, self.depth, W, H);
            self.X.CreateGC(gc, pid);
            seg.putImage(pid, gc, { width: W, height: H, depth: self.depth });
            self.X.GetImage(2, pid, 0, 0, W, H, 0xffffffff, (err, img) => {
                should.not.exist(err);
                let bad = 0;
                for (let i = 0; i < size; i += 4)
                    if (img.data[i] !== seg.buffer[i] ||
                        img.data[i + 1] !== seg.buffer[i + 1] ||
                        img.data[i + 2] !== seg.buffer[i + 2]) bad++;
                bad.should.equal(0);
                self.X.FreeGC(gc);
                self.X.FreePixmap(pid);
                seg.detach(done);
            });
        });
    });

    it('shm GetImage reads pixels back into the segment buffer', function(done) {
        if (!this.ok) return this.skip();
        const self = this;
        const W = 48, H = 48, size = W * H * 4;
        this.shm.createSegment(size, (err, seg) => {
            should.not.exist(err);
            for (let i = 0; i < size; i++)
                seg.buffer[i] = (i * 53) & 0xff;
            const pid = self.X.AllocID();
            const gc = self.X.AllocID();
            self.X.CreatePixmap(pid, self.root, self.depth, W, H);
            self.X.CreateGC(gc, pid);
            seg.putImage(pid, gc, { width: W, height: H, depth: self.depth });
            const reference = Buffer.from(seg.buffer);
            seg.buffer.fill(0);
            seg.getImage(pid, 0, 0, W, H, 0xffffffff, undefined, 0, (err, rep) => {
                should.not.exist(err);
                rep.size.should.equal(size);
                let bad = 0;
                for (let i = 0; i < size; i += 4)
                    if (seg.buffer[i] !== reference[i] ||
                        seg.buffer[i + 1] !== reference[i + 1] ||
                        seg.buffer[i + 2] !== reference[i + 2]) bad++;
                bad.should.equal(0);
                self.X.FreeGC(gc);
                self.X.FreePixmap(pid);
                seg.detach(done);
            });
        });
    });

    it('emits ShmCompletion on the segment when putImage sends an event', function(done) {
        if (!this.ok) return this.skip();
        const self = this;
        const W = 32, H = 32, size = W * H * 4;
        this.shm.createSegment(size, (err, seg) => {
            should.not.exist(err);
            const pid = self.X.AllocID();
            const gc = self.X.AllocID();
            self.X.CreatePixmap(pid, self.root, self.depth, W, H);
            self.X.CreateGC(gc, pid);
            seg.once('complete', offset => {
                offset.should.equal(0);
                self.X.FreeGC(gc);
                self.X.FreePixmap(pid);
                seg.detach(done);
            });
            seg.putImage(pid, gc, { width: W, height: H, depth: self.depth, sendEvent: true });
        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});

// Disabling SHM must be a clean, non-throwing "no fast path", so callers can
// probe once and route to core requests.
describe('MIT-SHM disabled (shm: false)', () => {
    it('usable() is false and createSegment fails without throwing', function(done) {
        x11.createClient({ shm: false }, (err, dpy) => {
            should.not.exist(err);
            const X = dpy.client;
            dpy.isLocalSocket.should.be.a.Boolean();
            X.require('shm', (err, ext) => {
                should.not.exist(err);
                ext.fdCapable.should.equal(false);
                should.not.exist(ext.provider);
                ext.usable((e, ok) => {
                    should.not.exist(e);
                    ok.should.equal(false);
                    ext.createSegment(4096, err => {
                        should.exist(err);
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
    it('reports an error instead of throwing when the client closes mid-attach', function(done) {
        x11.createClient((err, dpy) => {
            should.not.exist(err);
            const X = dpy.client;
            X.on('error', () => {}); // teardown noise is not the subject
            X.require('shm', (err, ext) => {
                should.not.exist(err);
                if (!ext.provider) {
                    X.terminate();
                    return X.on('end', () => done());
                }
                let settled = false;
                ext.createSegment(64 * 1024, err => {
                    // may succeed (won the race) or fail, but must not throw
                    settled = true;
                    if (err) err.should.be.an.Error();
                });
                // close() while the attach is still in flight: it sets the
                // client's closing flag, which is what made the confirming
                // round trip throw out of the fd-send callback
                X.close();
                setTimeout(() => {
                    settled.should.equal(true, 'the attach callback was answered');
                    done();
                }, 300);
            });
        });
    });
});
