const x11 = require('../lib');
const should = require('should');

describe('X-Resource extension', () => {

    const W = 50;
    const H = 40;

    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.display = dpy;
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.depth = dpy.screen[0].root_depth;
            self.bytesPP = self.depth <= 8 ? 1 : (self.depth <= 16 ? 2 : 4);
            self.X.require('res', (err, ext) => {
                should.not.exist(err);
                self.res = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('QueryVersion should report at least 1.0', function() {
        this.res.major.should.be.aboveOrEqual(1);
        this.res.minor.should.be.aboveOrEqual(0);
    });

    it('QueryClients should include our own client XID range', function(done) {
        const self = this;
        this.res.QueryClients((err, clients) => {
            should.not.exist(err);
            clients.length.should.be.above(0);
            const mine = clients.filter(c => c.resourceBase === self.display.resource_base);
            mine.length.should.equal(1);
            mine[0].resourceMask.should.equal(self.display.resource_mask);
            done();
        });
    });

    it('QueryClientResources should report a PIXMAP count increase after CreatePixmap', function(done) {
        const self = this;
        const PIXMAP = 20; // predefined PIXMAP atom
        const countPixmaps = types => {
            const entry = types.filter(t => t.resourceType === PIXMAP)[0];
            return entry ? entry.count : 0;
        };
        this.res.QueryClientResources(this.display.resource_base, (err, typesBefore) => {
            should.not.exist(err);
            const before = countPixmaps(typesBefore);
            self.pixmap = self.X.AllocID();
            self.X.CreatePixmap(self.pixmap, self.root, self.depth, W, H);
            self.res.QueryClientResources(self.display.resource_base, (err, typesAfter) => {
                should.not.exist(err);
                countPixmaps(typesAfter).should.equal(before + 1);
                done();
            });
        });
    });

    it('QueryClientPixmapBytes should grow by at least the size of a new pixmap', function(done) {
        const self = this;
        this.res.QueryClientPixmapBytes(this.display.resource_base, (err, bytesBefore) => {
            should.not.exist(err);
            const pixmap = self.X.AllocID();
            self.X.CreatePixmap(pixmap, self.root, self.depth, W, H);
            self.res.QueryClientPixmapBytes(self.display.resource_base, (err, bytesAfter) => {
                should.not.exist(err);
                // scanlines may be padded, so at least the unpadded size
                (bytesAfter - bytesBefore).should.be.aboveOrEqual(W * H * self.bytesPP);
                self.X.FreePixmap(pixmap);
                done();
            });
        });
    });

    it('QueryClientIds should return our own process id (1.2)', function(done) {
        if (this.res.major === 1 && this.res.minor < 2)
            return this.skip(); // server doesn't speak X-Resource 1.2
        this.res.QueryClientIds([{
            client: this.display.resource_base,
            mask: this.res.ClientIdMask.LocalClientPID
        }], (err, ids) => {
            should.not.exist(err);
            ids.length.should.equal(1);
            ids[0].mask.should.equal(2);
            ids[0].value.should.eql([process.pid]);
            done();
        });
    });

    it('QueryResourceBytes should report the size of a known pixmap (1.2)', function(done) {
        if (this.res.major === 1 && this.res.minor < 2)
            return this.skip(); // server doesn't speak X-Resource 1.2
        const self = this;
        this.res.QueryResourceBytes(0, [{ resource: this.pixmap, type: 0 }], (err, sizes) => {
            should.not.exist(err);
            sizes.length.should.be.aboveOrEqual(1);
            const mine = sizes.filter(s => s.resource === self.pixmap)[0];
            should.exist(mine);
            mine.type.should.equal(20); // PIXMAP atom
            mine.bytes.should.be.aboveOrEqual(W * H * self.bytesPP);
            mine.refCount.should.be.aboveOrEqual(1);
            mine.crossReferences.should.be.an.Array();
            done();
        });
    });

    after(function(done) {
        if (this.pixmap)
            this.X.FreePixmap(this.pixmap);
        this.X.terminate();
        this.X.on('end', done);
    });
});
