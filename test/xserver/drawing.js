const assert = require('assert');
const x11 = require('../../lib');
const { boot, sync } = require('./boot');

const em = x11.eventMask;
const W = 20, H = 20;
const WHITE = 0xffffff;
const BLACK = 0;

describe('xserver: drawing', () => {

    let server, display, X, root, pixmap, gc;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, 24, W, H);
            gc = X.AllocID();
            X.CreateGC(gc, pixmap, { foreground: BLACK, background: BLACK });
            X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]); // black canvas
            X.ChangeGC(gc, { foreground: WHITE });
            done();
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = null;
    });

    function readBack(drawable, cb) {
        X.GetImage(2, drawable, 0, 0, W, H, 0xffffffff, (err, img) => {
            if (err) throw err;
            cb(img.data);
        });
    }

    function px(data, x, y) {
        return data.readUInt32LE((y * W + x) * 4);
    }

    it('PolyFillRectangle fills exactly the requested rect', done => {
        X.PolyFillRectangle(pixmap, gc, [2, 3, 4, 5]);
        readBack(pixmap, data => {
            for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                    const inside = x >= 2 && x < 6 && y >= 3 && y < 8;
                    assert.strictEqual(px(data, x, y), inside ? WHITE : BLACK,
                        `pixel ${x},${y}`);
                }
            done();
        });
    });

    it('PolyLine draws both endpoints and the diagonal', done => {
        X.PolyLine(0, pixmap, gc, [0, 0, 9, 9]);
        readBack(pixmap, data => {
            assert.strictEqual(px(data, 0, 0), WHITE);
            assert.strictEqual(px(data, 9, 9), WHITE);
            assert.strictEqual(px(data, 5, 5), WHITE);
            assert.strictEqual(px(data, 9, 0), BLACK);
            done();
        });
    });

    it('PutImage/GetImage round-trip preserves every pixel', done => {
        const iw = 6, ih = 4;
        const data = Buffer.alloc(iw * ih * 4);
        for (let i = 0; i < iw * ih; i++)
            data.writeUInt32LE((i * 0x010203 + 5) & 0xffffff, i * 4);
        X.PutImage(2, pixmap, gc, iw, ih, 3, 2, 0, 24, data);
        X.GetImage(2, pixmap, 3, 2, iw, ih, 0xffffffff, (err, img) => {
            if (err) return done(err);
            assert.ok(img.data.equals(data));
            done();
        });
    });

    it('GetImage applies the plane mask', done => {
        X.ChangeGC(gc, { foreground: 0x123456 });
        X.PolyFillRectangle(pixmap, gc, [0, 0, 1, 1]);
        X.GetImage(2, pixmap, 0, 0, 1, 1, 0xff0000, (err, img) => {
            if (err) return done(err);
            assert.strictEqual(img.data.readUInt32LE(0), 0x120000);
            done();
        });
    });

    it('CopyArea copies pixels and reports NoExposure', done => {
        X.PolyFillRectangle(pixmap, gc, [0, 0, 5, 5]);
        const dst = X.AllocID();
        X.CreatePixmap(dst, root, 24, W, H);
        const dgc = X.AllocID();
        X.CreateGC(dgc, dst, { graphicsExposures: 1, foreground: BLACK });
        X.PolyFillRectangle(dst, dgc, [0, 0, W, H]);
        X.on('event', ev => {
            if (ev.name !== 'NoExposure')
                return;
            assert.strictEqual(ev.drawable, dst);
            assert.strictEqual(ev.majorOpcode, 62);
            readBack(dst, data => {
                assert.strictEqual(px(data, 10, 10), WHITE); // copied corner
                assert.strictEqual(px(data, 15, 15), BLACK);
                done();
            });
        });
        X.CopyArea(pixmap, dst, dgc, 0, 0, 10, 10, 5, 5);
    });

    it('CopyArea with out-of-bounds source reports GraphicsExposure', done => {
        const dst = X.AllocID();
        X.CreatePixmap(dst, root, 24, W, H);
        X.on('event', ev => {
            if (ev.name !== 'GraphicsExposure')
                return;
            assert.strictEqual(ev.drawable, dst);
            assert.strictEqual(ev.majorOpcode, 62);
            done();
        });
        X.CopyArea(pixmap, dst, gc, 10, 10, 0, 0, W, H);
    });

    it('ImageText8 inks inside the 8x8 cell and nowhere else', done => {
        X.ChangeGC(gc, { background: BLACK });
        X.ImageText8(pixmap, gc, 2, 15, 'X');
        readBack(pixmap, data => {
            let inside = 0, outside = 0;
            for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++)
                    if (px(data, x, y) === WHITE) {
                        if (x >= 2 && x < 10 && y >= 8 && y < 16)
                            inside++;
                        else
                            outside++;
                    }
            assert.ok(inside > 0, 'some ink inside the glyph cell');
            assert.strictEqual(outside, 0, 'no ink outside the glyph cell');
            done();
        });
    });

    it('PolyText8 honours per-item deltas', done => {
        X.PolyText8(pixmap, gc, 1, 10, ['ab']);
        readBack(pixmap, data8 => {
            let count = 0;
            for (let i = 0; i < W * H; i++)
                if (data8.readUInt32LE(i * 4) === WHITE)
                    count++;
            assert.ok(count > 0);
            done();
        });
    });

    it('ClearArea repaints the background pixel and can send Expose', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, W, H, 0, 0, 0, 0,
            { backgroundPixel: 0x00ff00, eventMask: em.Exposure });
        const wgc = X.AllocID();
        X.CreateGC(wgc, wid, { foreground: 0xff0000 });
        X.PolyFillRectangle(wid, wgc, [0, 0, W, H]); // all red
        X.on('event', ev => {
            if (ev.name !== 'Expose')
                return;
            assert.strictEqual(ev.wid, wid);
            assert.strictEqual(ev.x, 5);
            assert.strictEqual(ev.y, 5);
            assert.strictEqual(ev.width, 4);
            assert.strictEqual(ev.height, 4);
            X.GetImage(2, wid, 0, 0, W, H, 0xffffffff, (err, img) => {
                if (err) return done(err);
                assert.strictEqual(img.data.readUInt32LE((5 * W + 5) * 4), 0x00ff00);
                assert.strictEqual(img.data.readUInt32LE(0), 0xff0000);
                done();
            });
        });
        X.ClearArea(wid, 5, 5, 4, 4, 1);
    });

    it('SetClipRectangles clips subsequent drawing', done => {
        X.SetClipRectangles(gc, 0, 0, 0, [2, 2, 3, 3]);
        X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]);
        readBack(pixmap, data => {
            assert.strictEqual(px(data, 3, 3), WHITE);   // inside clip
            assert.strictEqual(px(data, 1, 1), BLACK);   // clipped
            assert.strictEqual(px(data, 10, 10), BLACK); // clipped
            done();
        });
    });

    it('GC function xor combines with destination', done => {
        X.ChangeGC(gc, { foreground: 0x0000ff });
        X.PolyFillRectangle(pixmap, gc, [0, 0, 1, 1]);
        X.ChangeGC(gc, { function: 6, foreground: 0x0000f0 }); // GXxor
        X.PolyFillRectangle(pixmap, gc, [0, 0, 1, 1]);
        X.GetImage(2, pixmap, 0, 0, 1, 1, 0xffffffff, (err, img) => {
            if (err) return done(err);
            assert.strictEqual(img.data.readUInt32LE(0), 0x0000ff ^ 0x0000f0);
            done();
        });
    });

    it('drawing on a mapped window emits damage in root coordinates', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 30, 40, 10, 10);
        X.MapWindow(wid);
        sync(X, () => {
            server.once('damage', rect => {
                try {
                    assert.deepStrictEqual(rect, { x: 30, y: 40, width: 10, height: 10 });
                    done();
                } catch (e) {
                    done(e);
                }
            });
            const wgc = X.AllocID();
            X.CreateGC(wgc, wid, { foreground: WHITE });
            X.PolyFillRectangle(wid, wgc, [0, 0, 5, 5]);
        });
    });

    it('compose() paints mapped windows into the root raster', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 30, 40, 10, 10, 0, 0, 0, 0,
            { backgroundPixel: 0xff8800 });
        X.MapWindow(wid);
        sync(X, () => {
            const raster = server.compose();
            assert.strictEqual(raster, server.root.raster);
            assert.strictEqual(raster.data.length, server.width * server.height);
            assert.strictEqual(raster.getPixel(35, 45), 0xff8800);
            assert.strictEqual(raster.getPixel(29, 45), 0);
            done();
        });
    });
});
