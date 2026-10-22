const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');

describe('DOUBLE-BUFFER extension', () => {
    let X, root, white, black, dbe, wid, gc, backBuf;

    const W = 20;
    const H = 20;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            white = dpy.screen[0].white_pixel;
            black = dpy.screen[0].black_pixel;
            X.require('dbe', (err, ext) => {
                should.not.exist(err);
                dbe = ext;
                wid = X.AllocID();
                X.CreateWindow(wid, root, 0, 0, W, H, 0, 0, 0, 0,
                    { backgroundPixel: black });
                X.MapWindow(wid);
                gc = X.AllocID();
                X.CreateGC(gc, wid, { foreground: white });
                done();
            });
        });

        client.on('error', done);
    });

    it('GetVersion should report version 1.0', function() {
        dbe.major.should.equal(1);
        dbe.minor.should.be.aboveOrEqual(0);
    });

    it('AllocateBackBufferName + GetBackBufferAttributes should round-trip the window', function(t, done) {
        backBuf = X.AllocID();
        dbe.AllocateBackBufferName(wid, backBuf, dbe.SwapAction.Undefined);
        dbe.GetBackBufferAttributes(backBuf, (err, attrs) => {
            should.not.exist(err);
            attrs.window.should.equal(wid);
            done();
        });
    });

    it('SwapBuffers should move back buffer contents to the front buffer', function(t, done) {
        // the back buffer is a drawable: paint it white with a core request
        X.PolyFillRectangle(backBuf, gc, [0, 0, W, H]);
        X.GetImage(2, backBuf, 0, 0, W, H, 0xffffffff, (err, imgBack) => {
            should.not.exist(err);
            X.GetImage(2, wid, 0, 0, W, H, 0xffffffff, (err, imgFrontBefore) => {
                should.not.exist(err);
                // front buffer still shows the black window background
                imgFrontBefore.data.equals(imgBack.data).should.be.false();
                dbe.SwapBuffers([{ window: wid, swapAction: dbe.SwapAction.Untouched }]);
                X.GetImage(2, wid, 0, 0, W, H, 0xffffffff, (err, imgFrontAfter) => {
                    should.not.exist(err);
                    imgFrontAfter.data.equals(imgBack.data).should.be.true();
                    done();
                });
            });
        });
    });

    it('GetVisualInfo should list double-buffer capable visuals for the root screen', function(t, done) {
        dbe.GetVisualInfo([root], (err, screens) => {
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

    it('BeginIdiom and EndIdiom should be accepted by the server', function(t, done) {
        dbe.BeginIdiom();
        dbe.EndIdiom();
        // round trip to make sure neither request produced an error
        dbe.GetVersion(1, 0, (err, vers) => {
            should.not.exist(err);
            vers[0].should.equal(1);
            done();
        });
    });

    it('DeallocateBackBufferName should invalidate the buffer name', function(t, done) {
        dbe.DeallocateBackBufferName(backBuf);
        dbe.GetBackBufferAttributes(backBuf, (err, attrs) => {
            should.not.exist(err);
            attrs.window.should.equal(0); // None: no longer attached to the window
            done();
        });
    });

    after(function(t, done) {
        X.FreeGC(gc);
        X.DestroyWindow(wid);
        X.terminate();
        X.on('end', done);
    });
});
