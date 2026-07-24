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
