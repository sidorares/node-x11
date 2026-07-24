const x11 = require('../lib');
const should = require('should');

describe('DOUBLE-BUFFER extension', () => {

    const W = 20;
    const H = 20;

    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.white = dpy.screen[0].white_pixel;
            self.black = dpy.screen[0].black_pixel;
            self.X.require('dbe', (err, ext) => {
                should.not.exist(err);
                self.dbe = ext;
                self.wid = self.X.AllocID();
                self.X.CreateWindow(self.wid, self.root, 0, 0, W, H, 0, 0, 0, 0,
                    { backgroundPixel: self.black });
                self.X.MapWindow(self.wid);
                self.gc = self.X.AllocID();
                self.X.CreateGC(self.gc, self.wid, { foreground: self.white });
                done();
            });
        });

        client.on('error', done);
    });

    it('GetVersion should report version 1.0', function() {
        this.dbe.major.should.equal(1);
        this.dbe.minor.should.be.aboveOrEqual(0);
    });

    it('AllocateBackBufferName + GetBackBufferAttributes should round-trip the window', function(done) {
        const self = this;
        this.backBuf = this.X.AllocID();
        this.dbe.AllocateBackBufferName(this.wid, this.backBuf, this.dbe.SwapAction.Undefined);
        this.dbe.GetBackBufferAttributes(this.backBuf, (err, attrs) => {
            should.not.exist(err);
            attrs.window.should.equal(self.wid);
            done();
        });
    });

    it('SwapBuffers should move back buffer contents to the front buffer', function(done) {
        const self = this;
        // the back buffer is a drawable: paint it white with a core request
        this.X.PolyFillRectangle(this.backBuf, this.gc, [0, 0, W, H]);
        this.X.GetImage(2, this.backBuf, 0, 0, W, H, 0xffffffff, (err, imgBack) => {
            should.not.exist(err);
            self.X.GetImage(2, self.wid, 0, 0, W, H, 0xffffffff, (err, imgFrontBefore) => {
                should.not.exist(err);
                // front buffer still shows the black window background
                imgFrontBefore.data.equals(imgBack.data).should.be.false();
                self.dbe.SwapBuffers([{ window: self.wid, swapAction: self.dbe.SwapAction.Untouched }]);
                self.X.GetImage(2, self.wid, 0, 0, W, H, 0xffffffff, (err, imgFrontAfter) => {
                    should.not.exist(err);
                    imgFrontAfter.data.equals(imgBack.data).should.be.true();
                    done();
                });
            });
        });
    });

    it('GetVisualInfo should list double-buffer capable visuals for the root screen', function(done) {
        this.dbe.GetVisualInfo([this.root], (err, screens) => {
            should.not.exist(err);
            screens.should.be.an.Array();
            screens.length.should.equal(1);
            screens[0].length.should.be.above(0);
            screens[0].forEach(info => {
                info.visual.should.be.above(0);
                info.depth.should.be.above(0);
                info.perfLevel.should.be.a.Number();
            });
            done();
        });
    });

    it('BeginIdiom and EndIdiom should be accepted by the server', function(done) {
        this.dbe.BeginIdiom();
        this.dbe.EndIdiom();
        // round trip to make sure neither request produced an error
        this.dbe.GetVersion(1, 0, (err, vers) => {
            should.not.exist(err);
            vers[0].should.equal(1);
            done();
        });
    });

    it('DeallocateBackBufferName should invalidate the buffer name', function(done) {
        const self = this;
        this.dbe.DeallocateBackBufferName(this.backBuf);
        this.dbe.GetBackBufferAttributes(this.backBuf, (err, attrs) => {
            should.not.exist(err);
            attrs.window.should.equal(0); // None: no longer attached to the window
            done();
        });
    });

    after(function(done) {
        this.X.FreeGC(this.gc);
        this.X.DestroyWindow(this.wid);
        this.X.terminate();
        this.X.on('end', done);
    });
});
