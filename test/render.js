const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('RENDER extension', () => {

    const W = 16;
    const H = 16;

    let display;
    let X;
    let root;
    let depth;
    let render;
    let bytesPP;

    before((t, done) => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            depth = display.screen[0].root_depth;
            bytesPP = depth <= 8 ? 1 : (depth <= 16 ? 2 : 4);
            X.require('render', (err, ext) => {
                if (err)
                    return done(err);
                render = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after((t, done) => {
        X.terminate();
        X.on('end', done);
        X = null;
        display = null;
    });

    function getPixel(imageData, x, y) {
        const off = (y * W + x) * bytesPP;
        let value = 0;
        for (let i = 0; i < bytesPP; ++i)
            value += imageData[off + i] << (8 * i);
        // depth-24 pixels travel as 4 bytes; the padding byte is undefined
        const mask = depth >= 32 ? 0xffffffff : (1 << depth) - 1;
        return (value & mask) >>> 0;
    }

    // channel helpers assume the standard 24/32-bit TrueColor layout Xvfb uses
    const red = v => (v >> 16) & 0xff;
    const blue = v => v & 0xff;

    // depth-24 pixmap wrapped into a picture, filled solid black
    function mkCanvas() {
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, depth, W, H);
        const pic = X.AllocID();
        render.CreatePicture(pic, pixmap, render.rgb24);
        render.FillRectangles(render.PictOp.Src, pic, [0, 0, 0, 1], [0, 0, W, H]);
        return {
            pixmap,
            pic,
            free: () => {
                render.FreePicture(pic);
                X.FreePixmap(pixmap);
            }
        };
    }

    function readBack(pixmap, cb) {
        X.GetImage(2, pixmap, 0, 0, W, H, 0xffffffff, (err, img) => {
            assert.ifError(err);
            cb(img.data);
        });
    }

    it('QueryPictFormats should list picture formats and init discovers standard ones', (t, done) => {
        assert.ok(render.rgb24 != null);
        assert.ok(render.rgba32 != null);
        assert.ok(render.a8 != null);
        render.QueryPictFormats((err, res) => {
            assert.ifError(err);
            assert.ok(Array.isArray(res.formats));
            assert.ok(res.formats.length > 0);
            assert.ok(res.formats.map(f => f[0]).includes(render.rgb24));
            done();
        });
    });

    it('QueryPictFormats should name the fields of every format entry', (t, done) => {
        render.QueryPictFormats((err, res) => {
            assert.ifError(err);
            const rgb24 = res.formats.find(f => f.id === render.rgb24);
            assert.ok(rgb24 != null);
            // named fields alias the positional ones, they are one entry
            assert.strictEqual(rgb24.id, rgb24[0]);
            assert.strictEqual(rgb24.type, rgb24[1]);
            assert.strictEqual(rgb24.depth, rgb24[2]);
            assert.strictEqual(rgb24.redShift, rgb24[3]);
            assert.strictEqual(rgb24.redMask, rgb24[4]);
            assert.strictEqual(rgb24.greenShift, rgb24[5]);
            assert.strictEqual(rgb24.greenMask, rgb24[6]);
            assert.strictEqual(rgb24.blueShift, rgb24[7]);
            assert.strictEqual(rgb24.blueMask, rgb24[8]);
            assert.strictEqual(rgb24.alphaShift, rgb24[9]);
            assert.strictEqual(rgb24.alphaMask, rgb24[10]);
            assert.strictEqual(rgb24.colormap, rgb24[11]);
            assert.strictEqual(rgb24.type, render.PictType.Direct);
            assert.strictEqual(rgb24.depth, 24);
            done();
        });
    });

    it('QueryPictFormats should decode the screens and subpixel sections', (t, done) => {
        render.QueryPictFormats((err, res) => {
            assert.ifError(err);
            assert.ok(Array.isArray(res.screens));
            assert.strictEqual(res.screens.length, display.screen.length);
            const ids = res.formats.map(f => f.id);
            res.screens.forEach(screen => {
                assert.ok(ids.includes(screen.fallback));
                assert.ok(Array.isArray(screen.depths));
                assert.ok(screen.depths.length > 0);
                screen.depths.forEach(d => {
                    assert.strictEqual(typeof d.depth, 'number');
                    d.visuals.forEach(v => {
                        assert.strictEqual(typeof v.visual, 'number');
                        assert.ok(ids.includes(v.format));
                    });
                });
            });
            // one subpixel order per screen since RENDER 0.6
            assert.ok(Array.isArray(res.subpixels));
            res.subpixels.forEach(s => {
                assert.ok(s >= render.Subpixel.Unknown && s <= render.Subpixel.None);
            });
            done();
        });
    });

    it('findVisualFormat should map the root visual to a format of its depth', () => {
        const format = render.findVisualFormat(display.screen[0].root_visual);
        assert.ok(format != null);
        const info = render.pictFormats.formats.find(f => f.id === format);
        assert.ok(info != null);
        assert.strictEqual(info.depth, depth);
        assert.ok(render.findVisualFormat(0xdeadbeef) == null);
    });

    it('findVisualFormat should cover every visual of the connection setup', () => {
        // the setup block lists the server's visuals; RENDER describes the
        // ones it can composite, and must not invent ids for the others
        const ids = render.pictFormats.formats.map(f => f.id);
        Object.keys(display.screen[0].depths).forEach(d => {
            Object.keys(display.screen[0].depths[d]).forEach(visual => {
                const format = render.findVisualFormat(Number(visual));
                if (format !== undefined)
                    assert.ok(ids.includes(format));
            });
        });
    });

    it('QueryPictIndexValues should return Match error for a direct (non-indexed) format', (t, done) => {
        // Xvfb only has TrueColor/direct formats, so the server must answer
        // with a Match error - proves the request is correctly formed
        render.QueryPictIndexValues(render.rgb24, err => {
            assert.ok(err != null);
            assert.strictEqual(err.error, 8); // Match
            done();
            return true; // error handled, don't emit on client
        });
    });

    it('CreateLinearGradient should composite a left-to-right color ramp', (t, done) => {
        const c = mkCanvas();
        const grad = X.AllocID();
        render.CreateLinearGradient(grad, [0, 0], [W, 0],
            [[0, [1, 0, 0, 1]], [1, [0, 0, 1, 1]]]); // red -> blue
        render.Composite(render.PictOp.Src, grad, 0, c.pic, 0, 0, 0, 0, 0, 0, W, H);
        readBack(c.pixmap, data => {
            const left = getPixel(data, 1, 8);
            const right = getPixel(data, 14, 8);
            assert.ok(red(left) > 180);
            assert.ok(blue(left) < 80);
            assert.ok(blue(right) > 180);
            assert.ok(red(right) < 80);
            render.FreePicture(grad);
            c.free();
            done();
        });
    });

    it('CreateRadialGradient should be white at center, dark at corners', (t, done) => {
        const c = mkCanvas();
        const grad = X.AllocID();
        render.CreateRadialGradient(grad, [W / 2, H / 2], [W / 2, H / 2], 0, W / 2,
            [[0, [1, 1, 1, 1]], [1, [0, 0, 0, 1]]]); // white -> black
        render.Composite(render.PictOp.Src, grad, 0, c.pic, 0, 0, 0, 0, 0, 0, W, H);
        readBack(c.pixmap, data => {
            const center = getPixel(data, W / 2, H / 2);
            const corner = getPixel(data, 0, 0);
            assert.ok(red(center) > 200);
            assert.ok(red(corner) < 60);
            render.FreePicture(grad);
            c.free();
            done();
        });
    });

    it('CreateConicalGradient with equal stops should fill uniformly', (t, done) => {
        const c = mkCanvas();
        const grad = X.AllocID();
        // both stops red - result is red everywhere, independent of angle math
        render.CreateConicalGradient(grad, [W / 2, H / 2], 45,
            [[0, [1, 0, 0, 1]], [1, [1, 0, 0, 1]]]);
        render.Composite(render.PictOp.Src, grad, 0, c.pic, 0, 0, 0, 0, 0, 0, W, H);
        readBack(c.pixmap, data => {
            assert.ok(red(getPixel(data, 4, 4)) > 200);
            assert.ok(red(getPixel(data, 12, 12)) > 200);
            assert.ok(blue(getPixel(data, 4, 4)) < 60);
            render.FreePicture(grad);
            c.free();
            done();
        });
    });

    it('ChangePicture should update the repeat attribute of a picture', (t, done) => {
        const c = mkCanvas();
        const spx = X.AllocID();
        X.CreatePixmap(spx, root, depth, 1, 1);
        const spic = X.AllocID();
        render.CreatePicture(spic, spx, render.rgb24);
        render.FillRectangles(render.PictOp.Src, spic, [1, 1, 1, 1], [0, 0, 1, 1]);
        // repeat defaults to None: only (0,0) gets painted
        render.Composite(render.PictOp.Over, spic, 0, c.pic, 0, 0, 0, 0, 0, 0, W, H);
        readBack(c.pixmap, data => {
            assert.strictEqual(getPixel(data, 0, 0), 0xffffff);
            assert.strictEqual(getPixel(data, 8, 8), 0);
            render.ChangePicture(spic, { repeat: render.Repeat.Normal });
            render.Composite(render.PictOp.Over, spic, 0, c.pic, 0, 0, 0, 0, 0, 0, W, H);
            readBack(c.pixmap, data2 => {
                assert.strictEqual(getPixel(data2, 8, 8), 0xffffff);
                assert.strictEqual(getPixel(data2, 15, 15), 0xffffff);
                render.FreePicture(spic);
                X.FreePixmap(spx);
                c.free();
                done();
            });
        });
    });

    it('SetPictureClipRectangles should restrict rendering to the clip list', (t, done) => {
        const c = mkCanvas();
        render.SetPictureClipRectangles(c.pic, 0, 0, [4, 4, 8, 8]);
        render.FillRectangles(render.PictOp.Src, c.pic, [1, 1, 1, 1], [0, 0, W, H]);
        readBack(c.pixmap, data => {
            assert.strictEqual(getPixel(data, 1, 1), 0); // outside clip
            assert.strictEqual(getPixel(data, 8, 8), 0xffffff); // inside clip
            assert.strictEqual(getPixel(data, 14, 14), 0); // outside clip
            // ChangePicture with clipMask None resets the clip
            render.ChangePicture(c.pic, { clipMask: 0 });
            render.FillRectangles(render.PictOp.Src, c.pic, [1, 1, 1, 1], [0, 0, W, H]);
            readBack(c.pixmap, data2 => {
                assert.strictEqual(getPixel(data2, 1, 1), 0xffffff);
                c.free();
                done();
            });
        });
    });

    it('FillRectangles should fill every rectangle in the list', (t, done) => {
        const c = mkCanvas();
        render.FillRectangles(render.PictOp.Src, c.pic, [1, 1, 1, 1],
            [0, 0, 4, 4, 12, 12, 4, 4]); // two separate rects
        readBack(c.pixmap, data => {
            assert.strictEqual(getPixel(data, 2, 2), 0xffffff);
            assert.strictEqual(getPixel(data, 13, 13), 0xffffff);
            assert.strictEqual(getPixel(data, 8, 8), 0);
            c.free();
            done();
        });
    });

    it('Trapezoids should render a trapezoid (regression: buffer overflow)', (t, done) => {
        const c = mkCanvas();
        const solid = X.AllocID();
        render.CreateSolidFill(solid, 1, 1, 1, 1);
        // axis-aligned trapezoid covering x 4..12, y 4..12:
        // top, bottom, left x1,y1,x2,y2, right x1,y1,x2,y2
        render.Trapezoids(render.PictOp.Over, solid, 0, 0, c.pic, 0,
            [4, 12, 4, 4, 4, 12, 12, 4, 12, 12]);
        readBack(c.pixmap, data => {
            assert.strictEqual(getPixel(data, 8, 8), 0xffffff); // inside
            assert.strictEqual(getPixel(data, 2, 8), 0); // outside
            render.FreePicture(solid);
            c.free();
            done();
        });
    });

    it('TriFan should render a triangle fan', (t, done) => {
        const c = mkCanvas();
        const solid = X.AllocID();
        render.CreateSolidFill(solid, 1, 1, 1, 1);
        // single triangle covering the upper-right half
        render.TriFan(render.PictOp.Over, solid, 0, 0, c.pic, 0, [0, 0, W, 0, W, H]);
        readBack(c.pixmap, data => {
            assert.strictEqual(getPixel(data, 12, 4), 0xffffff); // inside
            assert.strictEqual(getPixel(data, 3, 12), 0); // outside
            render.FreePicture(solid);
            c.free();
            done();
        });
    });

    it('TriStrip should render a triangle strip', (t, done) => {
        const c = mkCanvas();
        const solid = X.AllocID();
        render.CreateSolidFill(solid, 1, 1, 1, 1);
        // single triangle covering the upper-left half
        render.TriStrip(render.PictOp.Over, solid, 0, 0, c.pic, 0, [0, 0, W, 0, 0, H]);
        readBack(c.pixmap, data => {
            assert.strictEqual(getPixel(data, 4, 4), 0xffffff); // inside
            assert.strictEqual(getPixel(data, 13, 13), 0); // outside
            // two more points extend the strip over the whole square
            render.TriStrip(render.PictOp.Over, solid, 0, 0, c.pic, 0,
                [0, 0, W, 0, 0, H, W, H]);
            readBack(c.pixmap, data2 => {
                assert.strictEqual(getPixel(data2, 13, 13), 0xffffff);
                render.FreePicture(solid);
                c.free();
                done();
            });
        });
    });

    function mkArgbCursor(hotX, hotY) {
        const cpx = X.AllocID();
        X.CreatePixmap(cpx, root, 32, 8, 8);
        const cpic = X.AllocID();
        render.CreatePicture(cpic, cpx, render.rgba32);
        render.FillRectangles(render.PictOp.Src, cpic, [1, 0, 0, 1], [0, 0, 8, 8]);
        const cid = X.AllocID();
        render.CreateCursor(cid, cpic, hotX, hotY);
        render.FreePicture(cpic);
        X.FreePixmap(cpx);
        return cid;
    }

    it('CreateCursor should create a usable cursor from an ARGB32 picture', (t, done) => {
        const cid = mkArgbCursor(4, 4);
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0, { cursor: cid });
        // any of the above failing would error before this reply arrives
        X.GetWindowAttributes(wid, (err, attrs) => {
            assert.ifError(err);
            X.DestroyWindow(wid);
            X.FreeCursor(cid);
            done();
        });
    });

    it('CreateAnimCursor should create a usable animated cursor', (t, done) => {
        const cid1 = mkArgbCursor(0, 0);
        const cid2 = mkArgbCursor(4, 4);
        const anim = X.AllocID();
        render.CreateAnimCursor(anim, [[cid1, 50], [cid2, 50]]);
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0, { cursor: anim });
        X.GetWindowAttributes(wid, (err, attrs) => {
            assert.ifError(err);
            X.DestroyWindow(wid);
            X.FreeCursor(anim);
            X.FreeCursor(cid1);
            X.FreeCursor(cid2);
            done();
        });
    });

    it('FreeGlyphs should remove glyphs from a glyph set', (t, done) => {
        const c = mkCanvas();
        const solid = X.AllocID();
        render.CreateSolidFill(solid, 1, 1, 1, 1);
        const gsid = X.AllocID();
        render.CreateGlyphSet(gsid, render.a8);
        // 4x4 fully-opaque glyph for char code 65 ('A'), origin at its lower-left
        render.AddGlyphs(gsid, [{
            id: 65, width: 4, height: 4, x: 0, y: 4,
            offX: 4 * 64, offY: 0, image: Buffer.alloc(16, 255)
        }]);
        render.CompositeGlyphs8(render.PictOp.Over, solid, c.pic, 0, gsid, 0, 0,
            [[2, 6, 'A']]);
        readBack(c.pixmap, data => {
            assert.strictEqual(getPixel(data, 3, 4), 0xffffff); // glyph drawn
            // repaint black, free the glyph, draw again: nothing may appear
            render.FillRectangles(render.PictOp.Src, c.pic, [0, 0, 0, 1], [0, 0, W, H]);
            render.FreeGlyphs(gsid, [65]);
            render.CompositeGlyphs8(render.PictOp.Over, solid, c.pic, 0, gsid, 0, 0,
                [[2, 6, 'A']]);
            readBack(c.pixmap, data2 => {
                assert.strictEqual(getPixel(data2, 3, 4), 0); // freed glyph is skipped
                render.FreeGlyphSet(gsid);
                render.FreePicture(solid);
                c.free();
                done();
            });
        });
    });
});
