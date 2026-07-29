// The compositor specialises the spans a toolkit actually emits — a solid
// fill, an untransformed blit — and those specialisations are only safe if
// they are indistinguishable from the general per-pixel loop.
//
// So this suite runs every scenario twice, once with the fast paths on and
// once with them off (the `_setFastPaths` test hook), and asserts the two
// destination images are identical. A specialisation that gets a rounding
// rule, an operator or an edge case wrong fails here rather than showing up
// as a subtly wrong colour somewhere downstream.
const assert = require('assert');
const { boot } = require('./boot');
const renderExt = require('../../lib/xserver/extensions/render');

const W = 24, H = 16;

// every operator the server implements, by name for readable failures
const OPS = [
    'Clear', 'Src', 'Dst', 'Over', 'OverReverse', 'In', 'InReverse',
    'Out', 'OutReverse', 'Atop', 'AtopReverse', 'Xor', 'Add', 'Saturate'
];

describe('xserver: RENDER fast paths', () => {

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
        renderExt._setFastPaths(true); // never leave it off for other suites
        X.terminate();
        server = display = X = render = null;
    });

    // depth-24 or depth-32 destination, seeded with a gradient-ish pattern so
    // that every destination channel (and, at depth 32, every destination
    // alpha) is exercised rather than a single flat value
    function mkDest(depth) {
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, depth, W, H);
        const pic = X.AllocID();
        render.CreatePicture(pic, pixmap, depth === 32 ? render.rgba32 : render.rgb24);
        const rects = [];
        for (let y = 0; y < H; y++)
            rects.push(0, y, W, 1);
        for (let y = 0; y < H; y++) {
            const v = Math.round((y / (H - 1)) * 65535);
            render.FillRectangles(render.PictOp.Src, pic,
                [v, 65535 - v, (v * 3) % 65535, depth === 32 ? v : 65535],
                [0, y, W, 1]);
        }
        return { pixmap, pic };
    }

    function mkSourcePixmap(depth, seed) {
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, depth, W, H);
        const pic = X.AllocID();
        render.CreatePicture(pic, pixmap, depth === 32 ? render.rgba32 : render.rgb24);
        for (let y = 0; y < H; y++) {
            const v = Math.round((((y * seed) % H) / (H - 1)) * 65535);
            render.FillRectangles(render.PictOp.Src, pic,
                [65535 - v, v, (v * 7) % 65535, depth === 32 ? (v + 20000) % 65535 : 65535],
                [0, y, W, 1]);
        }
        return { pixmap, pic };
    }

    // Runs `paint(pic)` against a fresh destination and returns its raster,
    // with the fast paths either enabled or disabled.
    function renderWith(fast, depth, paint, cb) {
        renderExt._setFastPaths(fast);
        const { pixmap, pic } = mkDest(depth);
        paint(pic);
        // read the server's raster directly: GetImage would mask depth-32
        // alpha away and hide exactly the kind of difference we are hunting
        X.GetInputFocus(() => {
            const res = server.resources.get(pixmap);
            cb(Uint32Array.from(res.raster.data));
        });
    }

    function bothAgree(depth, paint, label, done) {
        renderWith(true, depth, paint, fastData => {
            renderWith(false, depth, paint, slowData => {
                assert.strictEqual(fastData.length, slowData.length);
                for (let i = 0; i < fastData.length; i++) {
                    if (fastData[i] !== slowData[i]) {
                        const x = i % W, y = (i / W) | 0;
                        assert.fail(
                            `${label}: pixel (${x},${y}) differs — fast ` +
                            `0x${fastData[i].toString(16).padStart(8, '0')} vs general ` +
                            `0x${slowData[i].toString(16).padStart(8, '0')}`);
                    }
                }
                done();
            });
        });
    }

    describe('FillRectangles matches the general loop', () => {
        for (const depth of [24, 32]) {
            for (let op = 0; op < OPS.length; op++) {
                it(`${OPS[op]} on depth ${depth}`, done => {
                    bothAgree(depth, pic => {
                        render.FillRectangles(op, pic, [0x8000, 0x4000, 0xc000, 0xa000],
                            [2, 1, 9, 7, 12, 5, 8, 9]);
                    }, `FillRectangles ${OPS[op]} depth ${depth}`, done);
                });
            }
        }

        it('opaque fill covers exactly the rect and nothing else', done => {
            bothAgree(24, pic => {
                render.FillRectangles(render.PictOp.Src, pic, [0xffff, 0, 0, 0xffff],
                    [3, 2, 5, 4]);
            }, 'partial opaque fill', done);
        });

        it('a clip list still matches', done => {
            bothAgree(24, pic => {
                render.SetPictureClipRectangles(pic, 0, 0, [1, 1, 8, 6, 10, 4, 6, 8]);
                render.FillRectangles(render.PictOp.Src, pic, [0, 0xffff, 0, 0xffff],
                    [0, 0, W, H]);
            }, 'clipped fill', done);
        });

        // The fast path turns the clip into per-row spans, and overlapping
        // rectangles have to merge: drawing the overlap twice is invisible
        // for Src but wrong for every operator that is not idempotent.
        it('overlapping clip rectangles composite each pixel once', done => {
            bothAgree(24, pic => {
                render.SetPictureClipRectangles(pic, 0, 0, [2, 2, 10, 10, 6, 4, 10, 6]);
                render.FillRectangles(render.PictOp.Over, pic, [0x8000, 0, 0x4000, 0x8000],
                    [0, 0, W, H]);
            }, 'overlapping clip, Over', done);
        });

        it('clip rectangles given out of x order still match', done => {
            bothAgree(24, pic => {
                render.SetPictureClipRectangles(pic, 0, 0, [14, 1, 6, 12, 2, 3, 5, 9]);
                render.FillRectangles(render.PictOp.Over, pic, [0, 0x9000, 0x3000, 0xa000],
                    [0, 0, W, H]);
            }, 'unsorted clip', done);
        });

        it('a clip origin offset still matches', done => {
            bothAgree(24, pic => {
                render.SetPictureClipRectangles(pic, 3, 2, [0, 0, 8, 8]);
                render.FillRectangles(render.PictOp.Src, pic, [0xffff, 0xffff, 0, 0xffff],
                    [0, 0, W, H]);
            }, 'clip origin', done);
        });
    });

    describe('Composite matches the general loop', () => {
        for (const srcDepth of [24, 32]) {
            for (const dstDepth of [24, 32]) {
                for (const op of [0, 1, 3, 5, 9, 11, 12, 13]) {
                    it(`${OPS[op]}: depth ${srcDepth} source onto depth ${dstDepth}`, done => {
                        bothAgree(dstDepth, pic => {
                            const src = mkSourcePixmap(srcDepth, 3);
                            render.Composite(op, src.pic, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
                        }, `Composite ${OPS[op]} ${srcDepth}->${dstDepth}`, done);
                    });
                }
            }
        }

        it('a sub-rectangle blit at an offset matches', done => {
            bothAgree(24, pic => {
                const src = mkSourcePixmap(24, 5);
                render.Composite(render.PictOp.Src, src.pic, 0, pic, 2, 3, 0, 0, 5, 4, 10, 6);
            }, 'offset blit', done);
        });

        it('a solid source with no mask matches', done => {
            bothAgree(24, pic => {
                const solid = X.AllocID();
                render.CreateSolidFill(solid, [0x4000, 0x8000, 0x2000, 0xc000]);
                render.Composite(render.PictOp.Over, solid, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'solid source', done);
        });

        it('a source smaller than the region falls back and still matches', done => {
            bothAgree(24, pic => {
                const small = X.AllocID();
                X.CreatePixmap(small, root, 24, 4, 4);
                const smallPic = X.AllocID();
                render.CreatePicture(smallPic, small, render.rgb24);
                render.FillRectangles(render.PictOp.Src, smallPic, [0xffff, 0, 0xffff, 0xffff],
                    [0, 0, 4, 4]);
                render.ChangePicture(smallPic, { repeat: 1 });
                render.Composite(render.PictOp.Src, smallPic, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'repeating small source', done);
        });

        it('a transformed source falls back and still matches', done => {
            bothAgree(24, pic => {
                const src = mkSourcePixmap(24, 7);
                // the client encoder takes plain numbers and converts to 16.16
                render.SetPictureTransform(src.pic, [2, 0, 0, 0, 2, 0, 0, 0, 1]);
                render.Composite(render.PictOp.Src, src.pic, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'transformed source', done);
        });

        it('a clipped blit matches', done => {
            bothAgree(24, pic => {
                const src = mkSourcePixmap(24, 5);
                render.SetPictureClipRectangles(pic, 0, 0, [2, 2, 9, 9, 13, 5, 7, 7]);
                render.Composite(render.PictOp.Src, src.pic, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'clipped blit', done);
        });

        it('a clipped alpha blit onto depth 32 matches', done => {
            bothAgree(32, pic => {
                const src = mkSourcePixmap(32, 3);
                render.SetPictureClipRectangles(pic, 0, 0, [1, 1, 12, 12, 8, 6, 12, 8]);
                render.Composite(render.PictOp.Over, src.pic, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'clipped alpha blit', done);
        });

        it('a clipped solid source matches', done => {
            bothAgree(24, pic => {
                const solid = X.AllocID();
                render.CreateSolidFill(solid, [0x4000, 0x8000, 0x2000, 0x9000]);
                render.SetPictureClipRectangles(pic, 0, 0, [3, 1, 7, 11, 12, 2, 8, 9]);
                render.Composite(render.PictOp.Over, solid, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'clipped solid source', done);
        });

        it('an empty clip list draws nothing, both ways', done => {
            bothAgree(24, pic => {
                const src = mkSourcePixmap(24, 3);
                render.SetPictureClipRectangles(pic, 0, 0, []);
                render.Composite(render.PictOp.Src, src.pic, 0, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'empty clip', done);
        });

        it('a masked composite falls back and still matches', done => {
            bothAgree(24, pic => {
                const src = mkSourcePixmap(24, 3);
                const maskPixmap = X.AllocID();
                X.CreatePixmap(maskPixmap, root, 8, W, H);
                const mask = X.AllocID();
                render.CreatePicture(mask, maskPixmap, render.a8);
                render.FillRectangles(render.PictOp.Src, mask, [0, 0, 0, 0x8000], [0, 0, W, H]);
                render.Composite(render.PictOp.Over, src.pic, mask, pic, 0, 0, 0, 0, 0, 0, W, H);
            }, 'masked composite', done);
        });
    });
});
