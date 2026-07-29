const assert = require('assert');
const { boot } = require('./boot');

const W = 16, H = 16;
const WHITE = 0xffffff;
const BLACK = 0;

describe('xserver: RENDER', () => {

    let server, display, X, root, render;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            X.require('render', (err2, ext) => {
                if (err2) return done(err2);
                render = ext;
                done();
            });
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = render = null;
    });

    // depth-24 pixmap wrapped in an rgb24 picture, filled solid black
    function mkCanvas() {
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, 24, W, H);
        const pic = X.AllocID();
        render.CreatePicture(pic, pixmap, render.rgb24);
        render.FillRectangles(render.PictOp.Src, pic, [0, 0, 0, 1], [0, 0, W, H]);
        return { pixmap, pic };
    }

    // a8 pixmap wrapped in a picture, cleared to alpha 0
    function mkMask() {
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, 8, W, H);
        const pic = X.AllocID();
        render.CreatePicture(pic, pixmap, render.a8);
        render.FillRectangles(render.PictOp.Src, pic, [0, 0, 0, 0], [0, 0, W, H]);
        return { pixmap, pic };
    }

    function readBack(drawable, cb) {
        X.GetImage(2, drawable, 0, 0, W, H, 0xffffffff, (err, img) => {
            if (err) throw err;
            cb(img.data);
        });
    }

    function px(data, x, y) {
        return data.readUInt32LE((y * W + x) * 4) & 0xffffff;
    }

    const red = v => (v >> 16) & 0xff;
    const green = v => (v >> 8) & 0xff;
    const blue = v => v & 0xff;

    function approx(actual, expected, tol, msg) {
        assert.ok(Math.abs(actual - expected) <= tol,
            `${msg || 'value'}: ${actual} not within ${tol} of ${expected}`);
    }

    describe('handshake', () => {

        it('QueryVersion reports 0.11', done => {
            render.QueryVersion(0, 11, (err, ver) => {
                if (err) return done(err);
                assert.deepStrictEqual(ver, [0, 11]);
                done();
            });
        });

        it('require() derives the standard picture formats', () => {
            assert.ok(render.rgba32, 'rgba32');
            assert.ok(render.rgb24, 'rgb24');
            assert.ok(render.a8, 'a8');
            assert.ok(render.mono1, 'mono1');
        });

        it('QueryFilters lists nearest/bilinear/convolution', done => {
            render.QueryFilters((err, res) => {
                if (err) return done(err);
                const filters = res[1];
                for (const f of ['nearest', 'bilinear', 'convolution'])
                    assert.ok(filters.includes(f), f);
                done();
            });
        });

        it('QueryPictIndexValues answers with Match (no indexed formats)', done => {
            render.QueryPictIndexValues(render.rgb24, err => {
                assert.strictEqual(err.error, 8); // BadMatch
                done();
                return true;
            });
        });
    });

    describe('FillRectangles', () => {

        it('Src fills exactly the requested rect', done => {
            const { pixmap, pic } = mkCanvas();
            render.FillRectangles(render.PictOp.Src, pic, [1, 0, 0, 1], [2, 3, 4, 5]);
            readBack(pixmap, data => {
                for (let y = 0; y < H; y++)
                    for (let x = 0; x < W; x++) {
                        const inside = x >= 2 && x < 6 && y >= 3 && y < 8;
                        assert.strictEqual(px(data, x, y), inside ? 0xff0000 : BLACK,
                            `pixel ${x},${y}`);
                    }
                done();
            });
        });

        it('Over blends premultiplied color with the destination', done => {
            const { pixmap, pic } = mkCanvas();
            render.FillRectangles(render.PictOp.Src, pic, [1, 1, 1, 1], [0, 0, W, H]);
            // premultiplied half-transparent red over white
            render.FillRectangles(render.PictOp.Over, pic, [0.5, 0, 0, 0.5], [0, 0, W, H]);
            readBack(pixmap, data => {
                const v = px(data, 4, 4);
                approx(red(v), 255, 2, 'red');
                approx(green(v), 127, 2, 'green');
                approx(blue(v), 127, 2, 'blue');
                done();
            });
        });

        it('Clear zeroes the rect regardless of color', done => {
            const { pixmap, pic } = mkCanvas();
            render.FillRectangles(render.PictOp.Src, pic, [1, 1, 1, 1], [0, 0, W, H]);
            render.FillRectangles(render.PictOp.Clear, pic, [1, 1, 1, 1], [0, 0, 4, 4]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 1, 1), BLACK);
                assert.strictEqual(px(data, 5, 5), WHITE);
                done();
            });
        });
    });

    describe('Composite', () => {

        it('solid fill source composites into the destination region', done => {
            const { pixmap, pic } = mkCanvas();
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 0, 1, 0, 1);
            render.Composite(render.PictOp.Over, solid, 0, pic, 0, 0, 0, 0, 2, 2, 5, 5);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 3, 3), 0x00ff00);
                assert.strictEqual(px(data, 1, 1), BLACK);
                assert.strictEqual(px(data, 7, 7), BLACK);
                done();
            });
        });

        it('a8 mask gates the source', done => {
            const { pixmap, pic } = mkCanvas();
            const mask = mkMask();
            render.FillRectangles(render.PictOp.Src, mask.pic, [0, 0, 0, 1], [4, 4, 4, 4]);
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 0, 0, 1, 1);
            render.Composite(render.PictOp.Over, solid, mask.pic, pic, 0, 0, 0, 0, 0, 0, W, H);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 5, 5), 0x0000ff);
                assert.strictEqual(px(data, 2, 2), BLACK);
                assert.strictEqual(px(data, 9, 9), BLACK);
                done();
            });
        });

        it('depth-32 source keeps PutImage alpha (premultiplied Over)', done => {
            const { pixmap, pic } = mkCanvas();
            render.FillRectangles(render.PictOp.Src, pic, [1, 1, 1, 1], [0, 0, W, H]);
            const src = X.AllocID();
            X.CreatePixmap(src, root, 32, 4, 4);
            const gc = X.AllocID();
            X.CreateGC(gc, src);
            // premultiplied half-transparent red: a=0x80, r=0x80
            const data = Buffer.alloc(4 * 4 * 4);
            for (let i = 0; i < 16; i++)
                data.writeUInt32LE(0x80800000, i * 4);
            X.PutImage(2, src, gc, 4, 4, 0, 0, 0, 32, data);
            const srcPic = X.AllocID();
            render.CreatePicture(srcPic, src, render.rgba32);
            render.Composite(render.PictOp.Over, srcPic, 0, pic, 0, 0, 0, 0, 0, 0, 4, 4);
            readBack(pixmap, out => {
                const v = px(out, 1, 1);
                approx(red(v), 255, 2, 'red');
                approx(green(v), 127, 2, 'green');
                approx(blue(v), 127, 2, 'blue');
                assert.strictEqual(px(out, 5, 5), WHITE);
                done();
            });
        });

        it('repeat Normal tiles the source', done => {
            const { pixmap, pic } = mkCanvas();
            const src = X.AllocID();
            X.CreatePixmap(src, root, 24, 2, 2);
            const gc = X.AllocID();
            X.CreateGC(gc, src, { foreground: WHITE });
            X.PolyFillRectangle(src, gc, [0, 0, 2, 2]);
            X.ChangeGC(gc, { foreground: BLACK });
            X.PolyPoint(0, src, gc, [1, 0, 0, 1]); // checker: white on the main diagonal
            const srcPic = X.AllocID();
            render.CreatePicture(srcPic, src, render.rgb24, { repeat: render.Repeat.Normal });
            render.Composite(render.PictOp.Src, srcPic, 0, pic, 0, 0, 0, 0, 0, 0, 8, 8);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 0, 0), WHITE);
                assert.strictEqual(px(data, 1, 0), BLACK);
                assert.strictEqual(px(data, 4, 4), WHITE);
                assert.strictEqual(px(data, 5, 4), BLACK);
                assert.strictEqual(px(data, 6, 6), WHITE);
                done();
            });
        });

        it('SetPictureTransform maps destination into source space', done => {
            const { pixmap, pic } = mkCanvas();
            const src = X.AllocID();
            X.CreatePixmap(src, root, 24, 8, 8);
            const gc = X.AllocID();
            X.CreateGC(gc, src, { foreground: BLACK });
            X.PolyFillRectangle(src, gc, [0, 0, 8, 8]);
            X.ChangeGC(gc, { foreground: WHITE });
            X.PolyPoint(0, src, gc, [7, 7]);
            const srcPic = X.AllocID();
            render.CreatePicture(srcPic, src, render.rgb24);
            render.SetPictureTransform(srcPic, [2, 0, 0, 0, 2, 0, 0, 0, 1]);
            render.Composite(render.PictOp.Src, srcPic, 0, pic, 0, 0, 0, 0, 0, 0, 4, 4);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 3, 3), WHITE); // (3.5, 3.5) -> src (7, 7)
                assert.strictEqual(px(data, 2, 2), BLACK);
                done();
            });
        });

        it('bilinear filter interpolates between texels', done => {
            const { pixmap, pic } = mkCanvas();
            const src = X.AllocID();
            X.CreatePixmap(src, root, 24, 2, 1);
            const gc = X.AllocID();
            X.CreateGC(gc, src, { foreground: BLACK });
            X.PolyFillRectangle(src, gc, [0, 0, 2, 1]);
            X.ChangeGC(gc, { foreground: WHITE });
            X.PolyPoint(0, src, gc, [1, 0]);
            const srcPic = X.AllocID();
            render.CreatePicture(srcPic, src, render.rgb24, { repeat: render.Repeat.Pad });
            render.SetPictureTransform(srcPic, [0.5, 0, 0, 0, 0.5, 0, 0, 0, 1]);
            render.SetPictureFilter(srcPic, 'bilinear');
            render.Composite(render.PictOp.Src, srcPic, 0, pic, 0, 0, 0, 0, 0, 0, 4, 1);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 0, 0), BLACK);
                assert.strictEqual(px(data, 3, 0), WHITE);
                const a = red(px(data, 1, 0));
                const b = red(px(data, 2, 0));
                assert.ok(a > 30 && a < 100, `quarter blend, got ${a}`);
                assert.ok(b > 155 && b < 225, `three-quarter blend, got ${b}`);
                done();
            });
        });
    });

    describe('gradients', () => {

        it('linear gradient ramps between the stops', done => {
            const { pixmap, pic } = mkCanvas();
            const grad = X.AllocID();
            render.LinearGradient(grad, [0, 0], [W, 0],
                [[0, [0, 0, 0, 1]], [1, [1, 1, 1, 1]]]);
            render.Composite(render.PictOp.Src, grad, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            readBack(pixmap, data => {
                assert.ok(red(px(data, 0, 8)) < 20, 'left edge dark');
                assert.ok(red(px(data, 15, 8)) > 235, 'right edge bright');
                const mid = red(px(data, 8, 8));
                assert.ok(mid > 100 && mid < 160, `midpoint gray, got ${mid}`);
                done();
            });
        });

        it('radial gradient is bright at the center, dark at the rim', done => {
            const { pixmap, pic } = mkCanvas();
            const grad = X.AllocID();
            render.RadialGradient(grad, [8, 8], [8, 8], 0, 8,
                [[0, [1, 1, 1, 1]], [1, [0, 0, 0, 1]]]);
            render.Composite(render.PictOp.Src, grad, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            readBack(pixmap, data => {
                assert.ok(red(px(data, 8, 8)) > 200, 'center bright');
                assert.ok(red(px(data, 0, 0)) < 30, 'corner dark');
                done();
            });
        });

        it('conical gradient varies with the angle around the center', done => {
            const { pixmap, pic } = mkCanvas();
            const grad = X.AllocID();
            render.ConicalGradient(grad, [8, 8], 0,
                [[0, [0, 0, 0, 1]], [1, [1, 1, 1, 1]]]);
            render.Composite(render.PictOp.Src, grad, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            readBack(pixmap, data => {
                assert.ok(red(px(data, 12, 8)) < 30, 'angle ~0 near the first stop');
                const left = red(px(data, 4, 8));
                assert.ok(left > 100 && left < 155, `angle ~pi mid-ramp, got ${left}`);
                done();
            });
        });
    });

    describe('geometry', () => {

        it('Triangles fills with antialiased edges', done => {
            const { pixmap, pic } = mkCanvas();
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.Triangles(render.PictOp.Over, solid, 0, 0, pic, 0,
                [0, 0, 8, 0, 0, 8]);
            readBack(pixmap, data => {
                assert.ok(red(px(data, 1, 1)) > 200, 'inside');
                assert.strictEqual(px(data, 7, 7), BLACK);
                const edge = red(px(data, 3, 4)); // hypotenuse crosses this pixel
                assert.ok(edge > 0 && edge < 255, `antialiased edge, got ${edge}`);
                done();
            });
        });

        it('Trapezoids with vertical edges fills the exact rect', done => {
            const { pixmap, pic } = mkCanvas();
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            // top 3, bottom 8, left line x=2, right line x=6
            render.Trapezoids(render.PictOp.Over, solid, 0, 0, pic, 0,
                [3, 8, 2, 3, 2, 8, 6, 3, 6, 8]);
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

        it('TriStrip covers the quad', done => {
            const { pixmap, pic } = mkCanvas();
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.TriStrip(render.PictOp.Over, solid, 0, 0, pic, 0,
                [2, 2, 6, 2, 2, 6, 6, 6]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 3, 3), WHITE);
                assert.strictEqual(px(data, 4, 4), WHITE);
                assert.strictEqual(px(data, 0, 0), BLACK);
                assert.strictEqual(px(data, 7, 7), BLACK);
                done();
            });
        });

        it('TriFan covers the quad', done => {
            const { pixmap, pic } = mkCanvas();
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.TriFan(render.PictOp.Over, solid, 0, 0, pic, 0,
                [2, 2, 6, 2, 6, 6, 2, 6]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 3, 3), WHITE);
                assert.strictEqual(px(data, 4, 4), WHITE);
                assert.strictEqual(px(data, 0, 0), BLACK);
                assert.strictEqual(px(data, 7, 7), BLACK);
                done();
            });
        });

        it('AddTraps accumulates coverage into an a8 picture', done => {
            const { pixmap, pic } = mkCanvas();
            const mask = mkMask();
            // spanfix rect [1..5) x [2..6): top l/r/y, bottom l/r/y
            render.AddTraps(mask.pic, 0, 0, [1, 5, 2, 1, 5, 6]);
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 0, 0, 1);
            render.Composite(render.PictOp.Over, solid, mask.pic, pic, 0, 0, 0, 0, 0, 0, W, H);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 2, 3), 0xff0000);
                assert.strictEqual(px(data, 0, 0), BLACK);
                assert.strictEqual(px(data, 6, 3), BLACK);
                done();
            });
        });
    });

    describe('glyphs', () => {

        function addGlyph(gsid, id, value, offX) {
            render.AddGlyphs(gsid, [{
                id,
                width: 4,
                height: 4,
                x: 0,
                y: 4,
                offX: (offX || 0) * 64,
                offY: 0,
                image: Buffer.alloc(16, value)
            }]);
        }

        it('CompositeGlyphs8 draws added glyphs at the pen position', done => {
            const { pixmap, pic } = mkCanvas();
            const gs = X.AllocID();
            render.CreateGlyphSet(gs, render.a8);
            addGlyph(gs, 65, 255);
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.CompositeGlyphs8(render.PictOp.Over, solid, pic, 0, gs, 0, 0,
                [[2, 8, 'A']]);
            readBack(pixmap, data => {
                // image origin: pen (2,8) - (x=0, y=4) -> cols 2..6, rows 4..8
                assert.strictEqual(px(data, 3, 5), WHITE);
                assert.strictEqual(px(data, 1, 5), BLACK);
                assert.strictEqual(px(data, 3, 3), BLACK);
                assert.strictEqual(px(data, 3, 8), BLACK);
                done();
            });
        });

        it('glyphset-switch elements and glyph advances apply', done => {
            const { pixmap, pic } = mkCanvas();
            const gs1 = X.AllocID();
            const gs2 = X.AllocID();
            render.CreateGlyphSet(gs1, render.a8);
            render.CreateGlyphSet(gs2, render.a8);
            addGlyph(gs1, 65, 255, 4);
            addGlyph(gs2, 66, 128, 4);
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.CompositeGlyphs8(render.PictOp.Over, solid, pic, 0, gs1, 0, 0,
                [[2, 8, 'A'], gs2, [0, 0, 'B']]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 3, 5), WHITE);        // 'A' at pen (2,8)
                const v = red(px(data, 7, 5));                    // 'B' at pen (6,8), alpha 128
                approx(v, 128, 4, 'half-coverage glyph');
                done();
            });
        });

        it('CompositeGlyphs32 accepts wide ids', done => {
            const { pixmap, pic } = mkCanvas();
            const gs = X.AllocID();
            render.CreateGlyphSet(gs, render.a8);
            addGlyph(gs, 0xbeef, 255);
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.CompositeGlyphs32(render.PictOp.Over, solid, pic, 0, gs, 0, 0,
                [[2, 8, String.fromCharCode(0xbeef)]]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 3, 5), WHITE);
                done();
            });
        });

        it('ReferenceGlyphSet shares glyphs with the original set', done => {
            const { pixmap, pic } = mkCanvas();
            const gs = X.AllocID();
            render.CreateGlyphSet(gs, render.a8);
            addGlyph(gs, 65, 255);
            const ref = X.AllocID();
            render.ReferenceGlyphSet(ref, gs);
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.CompositeGlyphs8(render.PictOp.Over, solid, pic, 0, ref, 0, 0,
                [[2, 8, 'A']]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 3, 5), WHITE);
                done();
            });
        });

        it('FreeGlyphs makes the glyph undefined (Glyph error)', done => {
            const { pic } = mkCanvas();
            const gs = X.AllocID();
            render.CreateGlyphSet(gs, render.a8);
            addGlyph(gs, 65, 255);
            render.FreeGlyphs(gs, [65]);
            const solid = X.AllocID();
            render.CreateSolidFill(solid, 1, 1, 1, 1);
            render.CompositeGlyphs8(render.PictOp.Over, solid, pic, 0, gs, 0, 0, ['A']);
            X.once('error', err => {
                assert.strictEqual(err.error, render.firstError + 4); // BadGlyph
                done();
            });
        });
    });

    describe('clip rectangles', () => {

        it('SetPictureClipRectangles restricts rendering', done => {
            const { pixmap, pic } = mkCanvas();
            render.SetPictureClipRectangles(pic, 0, 0, [1, 1, 4, 4]);
            render.FillRectangles(render.PictOp.Src, pic, [1, 1, 1, 1], [0, 0, W, H]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 2, 2), WHITE);
                assert.strictEqual(px(data, 0, 0), BLACK);
                assert.strictEqual(px(data, 6, 6), BLACK);
                done();
            });
        });

        it('clip origin offsets the rectangles; clipMask None clears', done => {
            const { pixmap, pic } = mkCanvas();
            render.SetPictureClipRectangles(pic, 8, 8, [0, 0, 2, 2]);
            render.FillRectangles(render.PictOp.Src, pic, [1, 1, 1, 1], [0, 0, W, H]);
            render.ChangePicture(pic, { clipMask: 0 });
            render.FillRectangles(render.PictOp.Src, pic, [1, 0, 0, 1], [0, 0, 4, 4]);
            readBack(pixmap, data => {
                assert.strictEqual(px(data, 8, 8), WHITE);   // clipped fill landed here
                assert.strictEqual(px(data, 4, 4), BLACK);   // outside the clip
                assert.strictEqual(px(data, 1, 1), 0xff0000); // clip cleared
                done();
            });
        });
    });

    describe('cursors', () => {

        it('CreateCursor and CreateAnimCursor from an rgba32 picture', done => {
            const src = X.AllocID();
            X.CreatePixmap(src, root, 32, 8, 8);
            const srcPic = X.AllocID();
            render.CreatePicture(srcPic, src, render.rgba32);
            render.FillRectangles(render.PictOp.Src, srcPic, [0, 0, 1, 1], [0, 0, 8, 8]);
            const cur = X.AllocID();
            render.CreateCursor(cur, srcPic, 1, 1);
            const anim = X.AllocID();
            render.CreateAnimCursor(anim, [[cur, 100]]);
            X.FreeCursor(anim);
            X.FreeCursor(cur);
            X.on('error', done);
            X.GetInputFocus(() => done());
        });
    });

    describe('core support for RENDER', () => {

        it('depth-8 pixmap PutImage/GetImage round-trip', done => {
            const pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, 8, W, 4);
            const gc = X.AllocID();
            X.CreateGC(gc, pixmap);
            const data = Buffer.alloc(W * 4);
            for (let i = 0; i < data.length; i++)
                data[i] = (i * 7) & 0xff;
            X.PutImage(2, pixmap, gc, W, 4, 0, 0, 0, 8, data);
            X.GetImage(2, pixmap, 0, 0, W, 4, 0xffffffff, (err, img) => {
                if (err) return done(err);
                assert.ok(img.data.subarray(0, data.length).equals(data));
                done();
            });
        });

        it('depth-32 pixmap PutImage/GetImage keeps the alpha byte', done => {
            const pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, 32, 4, 4);
            const gc = X.AllocID();
            X.CreateGC(gc, pixmap);
            const data = Buffer.alloc(4 * 4 * 4);
            for (let i = 0; i < 16; i++)
                data.writeUInt32LE((0xab000000 + i * 0x010203) >>> 0, i * 4);
            X.PutImage(2, pixmap, gc, 4, 4, 0, 0, 0, 32, data);
            X.GetImage(2, pixmap, 0, 0, 4, 4, 0xffffffff, (err, img) => {
                if (err) return done(err);
                assert.ok(img.data.equals(data));
                done();
            });
        });
    });

    describe('colour range', () => {

        // Components are floats 0..1, premultiplied. A 16-bit value like
        // 0xffff clamps, which used to be silent — every example in this repo
        // that wrote stops that way rendered fully opaque instead of
        // translucent, for years, with nothing to notice it by.
        it('clamps out-of-range components and warns once', done => {
            const warnings = [];
            const realWarn = console.warn;
            console.warn = msg => warnings.push(String(msg));

            const { pic, pixmap } = mkCanvas();
            // 0x8000 as "half" is the classic mistake: it saturates to full.
            render.FillRectangles(render.PictOp.Src, pic, [0x8000, 0, 0, 0xffff],
                [0, 0, W, H]);
            render.FillRectangles(render.PictOp.Src, pic, [0xffff, 0, 0, 0xffff],
                [0, 0, 1, 1]);

            readBack(pixmap, data => {
                console.warn = realWarn;
                // clamped to full red, not half
                assert.strictEqual(px(data, 5, 5), 0xff0000);
                // two offending requests, one warning: the flag lives on the
                // extension instance, and beforeEach gives each test a fresh
                // connection, so this is exact rather than order-dependent
                assert.strictEqual(warnings.length, 1,
                    `expected exactly one warning, got ${warnings.length}`);
                assert.match(warnings[0], /outside 0\.\.1/);
                assert.match(warnings[0], /premultiplied/);
                done();
            });
        });

        it('strictColors turns an out-of-range component into a throw', () => {
            const { pic } = mkCanvas();
            render.strictColors = true;
            try {
                assert.throws(
                    () => render.FillRectangles(render.PictOp.Src, pic,
                        [0xffff, 0, 0, 0xffff], [0, 0, W, H]),
                    /outside 0\.\.1/);
                // NaN is caught by the same guard rather than writing garbage
                assert.throws(
                    () => render.FillRectangles(render.PictOp.Src, pic,
                        [NaN, 0, 0, 1], [0, 0, W, H]),
                    /outside 0\.\.1/);
                // and valid values still go through untouched
                assert.doesNotThrow(
                    () => render.FillRectangles(render.PictOp.Src, pic,
                        [0.5, 0.25, 0.5, 0.5], [0, 0, W, H]));
            } finally {
                render.strictColors = false;
            }
        });

        it('CreateSolidFill and gradient stops use the same guard', () => {
            render.strictColors = true;
            try {
                assert.throws(() => render.CreateSolidFill(X.AllocID(), 0xffff, 0, 0, 0xffff),
                    /outside 0\.\.1/);
                assert.throws(() => render.CreateLinearGradient(X.AllocID(), [0, 0], [W, 0],
                    [[0, [0xffff, 0, 0, 0xffff]], [1, [0, 0, 0xffff, 0xffff]]]),
                    /outside 0\.\.1/);
            } finally {
                render.strictColors = false;
            }
        });
    });

    describe('errors', () => {

        it('bad picture ids raise the Picture error', done => {
            render.FreePicture(0xbadf00d);
            X.once('error', err => {
                assert.strictEqual(err.error, render.firstError + 1); // BadPicture
                assert.strictEqual(err.badParam, 0xbadf00d);
                done();
            });
        });

        it('CreatePicture with mismatched depth raises Match', done => {
            const pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, 24, 4, 4);
            const pic = X.AllocID();
            render.CreatePicture(pic, pixmap, render.a8);
            X.once('error', err => {
                assert.strictEqual(err.error, 8); // BadMatch
                done();
            });
        });

        it('bad glyphset ids raise the GlyphSet error', done => {
            render.FreeGlyphSet(0xbadbad);
            X.once('error', err => {
                assert.strictEqual(err.error, render.firstError + 3); // BadGlyphSet
                done();
            });
        });

        it('AddGlyphsFromPicture is unimplemented', done => {
            const gs = X.AllocID();
            render.CreateGlyphSet(gs, render.a8);
            render.AddGlyphsFromPicture(gs, 0, []);
            X.once('error', err => {
                assert.strictEqual(err.error, 17); // BadImplementation
                done();
            });
        });
    });
});
