// RENDER's Precise rasterization: lib/render-raster.js, and the JS server's
// Trapezoids/Triangles/AddTraps drawn with it. The goldens are what a pixman
// server (XQuartz, which rasterizes as Xvfb, Xorg and Xwayland do) drew for
// each shape on a 16x12 a8 pixmap — the same set ntk's
// test/raster-precise.test.js checks its own rasterizer against.
// test/render-precise.js compares against a real server on random geometry.
const assert = require('assert');
const { boot } = require('./boot');
const raster = require('../../lib/render-raster');

const W = 16;
const H = 12;
const fixed = v => Math.trunc(v * 65536);

// Triangles requests, as float coordinates on the client side
const TRIANGLES = {
    'a triangle': [1.3, 0.7, 14.6, 3.2, 5.1, 11.4],
    'a near-horizontal sliver': [0.2, 5.01, 15.9, 5.3, 15.9, 5.31],
    'past the top and left': [-3.5, -2.25, 9.75, 1.5, 4.125, 14.9],
    'past the right': [10.5, 1, 20.25, 6, 9.9, 11],
    'overlaps saturate': [2, 2, 12, 2, 7, 10, 3, 3, 13, 4, 6, 11]
};

// AddTraps requests in 16.16, six per trap: the trapezoids ntk's
// trapezoidize makes of a polygon
const TRAPS = {
    // a heptagon, nonzero
    'a heptagon': [
        453550, 453550, 67690, 369447, 747405, 134761,
        369447, 747405, 134761, 217898, 805606, 255617,
        217898, 805606, 255617, 217898, 878182, 406323,
        217898, 878182, 406323, 217898, 805606, 557028,
        217898, 805606, 557028, 369447, 747405, 677885,
        369447, 747405, 677885, 453550, 453550, 744955
    ],
    // a ring, even-odd
    'a ring': [
        81920, 966656, 32768, 81920, 966656, 222822,
        81920, 301465, 222822, 81920, 301465, 563609,
        747110, 966656, 222822, 747110, 966656, 563609,
        81920, 966656, 563609, 81920, 966656, 753664
    ]
};

// one 16-pixel row per line, hex
const GOLDEN = {
    'a triangle': [
        '00251200000000000000000000000000',
        '0069ffe1b18154230100000000000000',
        '0014fafffffffffff1c2926232060000',
        '0000b4ffffffffffffffffffffee3000',
        '00005affffffffffffffffffe5320000',
        '00000bf4ffffffffffffffd21d000000',
        '000000a2ffffffffffffb90d00000000',
        '00000048ffffffffff9a040000000000',
        '00000004e9fffffe7700000000000000',
        '0000000093fff7540000000000000000',
        '0000000039ea39000000000000000000',
        '00000000011f00000000000000000000'
    ],
    'a near-horizontal sliver': [
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00010000020100000500000205000009',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000'
    ],
    'past the top and left': [
        'fffffffff5b56c240000000000000000',
        'ffffffffffffffffdb67000000000000',
        'ffffffffffffffffff55000000000000',
        'ffffffffffffffffe404000000000000',
        'ffffffffffffffff7c00000000000000',
        'f6fffffffffffff91900000000000000',
        '9affffffffffffa60000000000000000',
        '2afeffffffffff3b0000000000000000',
        '00b8ffffffffce000000000000000000',
        '0047ffffffff65000000000000000000',
        '0001d5ffffef09000000000000000000',
        '000065ffff8c00000000000000000000'
    ],
    'past the right': [
        '00000000000000000000000000000000',
        '00000000000000000000777c0d000000',
        '0000000000000000000097ffeb760a00',
        '00000000000000000000a6ffffffe86f',
        '00000000000000000000b5ffffffffff',
        '00000000000000000000c4ffffffffff',
        '00000000000000000000d4ffffffffff',
        '00000000000000000000e3ffffffffff',
        '00000000000000000000f2ffffffc74b',
        '00000000000000000003ffffbe420000',
        '00000000000000000011b63a00000000',
        '00000000000000000000000000000000'
    ],
    'overlaps saturate': [
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '0000b0ffffffffffffffffb000000000',
        '00001cffffffffffffffff440b000000',
        '000000deffffffffffffffff80000000',
        '00000018ffffffffffffff8000000000',
        '00000000e2ffffffffff800000000000',
        '000000004fffffffff80000000000000',
        '0000000005f6ffff8c00000000000000',
        '000000000090ffcf0000000000000000',
        '00000000002f80000000000000000000',
        '00000000000000000000000000000000'
    ],
    'a heptagon': [
        '00000000000000000000000000000000',
        '000000000008a0d69b5f260000000000',
        '000000001ecdffffffffff9c00000000',
        '0000003feafffffffffffffa1f000000',
        '000000a5ffffffffffffffff95000000',
        '000000a5fffffffffffffffff6190000',
        '000000a5ffffffffffffffffff3d0000',
        '000000a5ffffffffffffffffc5000000',
        '00000081ffffffffffffffff4b000000',
        '000000006ffbffffffffffcf01000000',
        '000000000040eafff8c58c2e00000000',
        '0000000000001c3d0900000000000000'
    ],
    'a ring': [
        '00688888888888888888888888886800',
        '00c3ffffffffffffffffffffffffc300',
        '00c3ffffffffffffffffffffffffc300',
        '00c3ffffc0666666666666c0ffffc300',
        '00c3ffff9600000000000096ffffc300',
        '00c3ffff9600000000000096ffffc300',
        '00c3ffff9600000000000096ffffc300',
        '00c3ffff9600000000000096ffffc300',
        '00c3ffffc0666666666666c0ffffc300',
        '00c3ffffffffffffffffffffffffc300',
        '00c3ffffffffffffffffffffffffc300',
        '005b7777777777777777777777775b00'
    ]
};

const golden = name => GOLDEN[name].join('');

// the shape's mask, rasterized by the module over `box` of the 16x12 image:
// a mask of its own at that offset, or with `window`, that part of the whole
function local(name, box = { x: 0, y: 0, w: W, h: H }, window = false) {
    const data = new Uint8Array(box.w * box.h);
    const mask = window
        ? { data, width: W, height: H, window: { x: box.x, y: box.y, width: box.w, height: box.h } }
        : { data, width: box.w, height: box.h };
    const dx = window ? 0 : -box.x;
    const dy = window ? 0 : -box.y;
    if (TRIANGLES[name])
        raster.addTriangles(mask, dx, dy, TRIANGLES[name].map(fixed));
    else
        raster.addTraps(mask, dx, dy, TRAPS[name]);
    return Buffer.from(data);
}

describe('render-raster: Precise rasterization, as pixman does it', () => {

    for (const name of Object.keys(GOLDEN)) {
        it(`${name} comes out as a pixman server drew it`, () => {
            assert.strictEqual(local(name).toString('hex'), golden(name));
        });
    }

    it('a window onto the mask is that part of it, to the byte', () => {
        for (const name of Object.keys(GOLDEN)) {
            const whole = local(name);
            for (const box of [
                { x: 3, y: 2, w: 9, h: 7 },
                { x: 0, y: 5, w: 16, h: 7 },
                { x: 7, y: 0, w: 5, h: 12 },
                { x: 15, y: 11, w: 1, h: 1 }
            ]) {
                for (const window of [true, false]) {
                    const part = local(name, box, window);
                    for (let y = 0; y < box.h; y++) {
                        for (let x = 0; x < box.w; x++) {
                            assert.strictEqual(part[y * box.w + x], whole[(y + box.y) * W + x + box.x],
                                `${name}, ${window ? 'window' : 'mask'} at ${box.x},${box.y}: pixel ${x},${y}`);
                        }
                    }
                }
            }
        }
    });

    it('a shape moved by whole pixels is the same bytes moved', () => {
        for (const name of Object.keys(TRIANGLES)) {
            const moved = TRIANGLES[name].map((v, i) => fixed(v) + (i % 2 ? 300 : -500) * 65536);
            const data = new Uint8Array(W * H);
            raster.addTriangles({ data, width: W, height: H }, 500, -300, moved);
            assert.strictEqual(Buffer.from(data).toString('hex'), golden(name), name);
        }
    });

    it('a mask cut across a shape is not always that part of the whole; a window is', () => {
        // pixman_edge_step leaves the error term alone when a step carries
        // nothing, so an edge entered part-way down is not quite where it
        // would be stepped there row by row. This triangle, cut 35 rows
        // down, is one level off at one pixel; a window keeps the shape's
        // own top, as a server's mask over the shape's extents does.
        const tris = [2701713, 949813, 2704660, 3174996, 3739022, 507253];
        const whole = new Uint8Array(64 * 64);
        raster.addTriangles({ data: whole, width: 64, height: 64 }, 0, 0, tris);
        const cut = new Uint8Array(64 * 29);
        raster.addTriangles({ data: cut, width: 64, height: 29 }, 0, -35, tris);
        const win = new Uint8Array(64 * 29);
        raster.addTriangles({ data: win, width: 64, height: 64, window: { x: 0, y: 35, width: 64, height: 29 } },
            0, 0, tris);
        assert.deepStrictEqual(win, whole.subarray(35 * 64));
        assert.strictEqual(whole[35 * 64 + 617], 189);
        assert.strictEqual(cut[617], 188);
    });

    it('a pixel is its count of covered samples, 17 across and 15 down', () => {
        // a rectangle on pixel boundaries covers whole pixels
        const data = new Uint8Array(W * H);
        raster.addTraps({ data, width: W, height: H }, 0, 0, [2, 10, 3, 2, 10, 9].map(fixed));
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                assert.strictEqual(data[y * W + x], x >= 2 && x < 10 && y >= 3 && y < 9 ? 255 : 0);
        // an edge at x = 4.5 runs through pixel 4's ninth sample column,
        // which counts for the shape on its left: 8 columns to the right, 9
        // to the left, and the two abut to the whole pixel
        const right = new Uint8Array(W * H);
        raster.addTraps({ data: right, width: W, height: H }, 0, 0, [4.5, 12, 0, 4.5, 12, 12].map(fixed));
        const left = new Uint8Array(W * H);
        raster.addTraps({ data: left, width: W, height: H }, 0, 0, [1, 4.5, 0, 1, 4.5, 12].map(fixed));
        assert.strictEqual(right[5 * W + 4], 8 * 15);
        assert.strictEqual(left[5 * W + 4], 9 * 15);
        // and a top edge at y = 6.5 through row 6's eighth sample row,
        // which counts for the shape below it: 8 rows of the 15
        const below = new Uint8Array(W * H);
        raster.addTraps({ data: below, width: W, height: H }, 0, 0, [0, 16, 6.5, 0, 16, 12].map(fixed));
        assert.strictEqual(below[6 * W + 3], 8 * 17);
    });

    it('adds saturate, onto what the mask held', () => {
        const data = new Uint8Array(W * H).fill(200);
        raster.addTraps({ data, width: W, height: H }, 0, 0, [0, 8.5, 0, 0, 8.5, 12].map(fixed));
        assert.strictEqual(data[3 * W + 2], 255);
        assert.strictEqual(data[3 * W + 8], 255); // 200 + 9 * 15
        assert.strictEqual(data[3 * W + 9], 200);
        // and only the low byte is alpha, as in the JS server's rasters
        const cells = new Uint32Array(4).fill(0x1200);
        raster.addTraps({ data: cells, width: 4, height: 1 }, 0, 0, [0, 1.5, 0, 0, 1.5, 1].map(fixed));
        assert.deepStrictEqual([...cells], [255, 9 * 15, 0x1200, 0x1200]);
    });

    it('one sample per pixel at 1 bit, a centre on an edge going right', () => {
        const data = new Uint8Array(W * H);
        // left edge through the centres of column 2, right edge through
        // those of column 9
        raster.addTraps({ data, width: W, height: H, bits: 1 }, 0, 0, [2.5, 9.5, 3, 2.5, 9.5, 9].map(fixed));
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
                assert.strictEqual(data[y * W + x], x >= 2 && x < 9 && y >= 3 && y < 9 ? 1 : 0, `pixel ${x},${y}`);
    });

    it('Trapezoids sides are whole lines, cut at top and bottom', () => {
        // the left line is given by two points below the trapezoid, the
        // right one by two points beyond its bottom: both extend
        const trap = [2, 10, 4, 6, 4, 8, 12, 14, 12, 20].map(fixed);
        const data = new Uint8Array(W * H);
        raster.addTrapezoids({ data, width: W, height: H }, 0, 0, trap);
        const want = new Uint8Array(W * H);
        raster.addTraps({ data: want, width: W, height: H }, 0, 0, [4, 12, 2, 4, 12, 10].map(fixed));
        assert.deepStrictEqual(data, want);
        // a horizontal side, or a bottom not below the top, draws nothing
        const none = new Uint8Array(W * H);
        raster.addTrapezoids({ data: none, width: W, height: H }, 0, 0,
            [2, 10, 4, 6, 9, 6, 12, 14, 12, 20, 5, 5, 0, 0, 0, 16, 12, 0, 12, 16].map(fixed));
        assert.ok(none.every(v => v === 0));
    });

    it('triangles split into the two trapezoids pixman makes', () => {
        const t = raster.trianglesToTrapezoids([1, 0, 0, 4, 3, 2].map(fixed));
        assert.deepStrictEqual([...t].map(v => v / 65536), [
            0, 2, 1, 0, 0, 4, 1, 0, 3, 2, // top to the right point
            2, 4, 1, 0, 0, 4, 3, 2, 0, 4  // on, the right side turning
        ]);
        assert.deepStrictEqual([...raster.stripToTriangles([0, 1, 2, 3, 4, 5, 6, 7])],
            [0, 1, 2, 3, 4, 5, 2, 3, 4, 5, 6, 7]);
        assert.deepStrictEqual([...raster.fanToTriangles([0, 1, 2, 3, 4, 5, 6, 7])],
            [0, 1, 2, 3, 4, 5, 0, 1, 4, 5, 6, 7]);
        assert.strictEqual(raster.stripToTriangles([0, 1, 2, 3]).length, 0);
    });

    it('the extents are of the line points, in whole pixels', () => {
        const box = raster.trapezoidExtents([2.5, 9.25, 4, 1, 3.5, 20, 12.1, -3, 13, 30].map(fixed));
        assert.deepStrictEqual(box, { x1: 3, y1: 2, x2: 13, y2: 10 });
        assert.strictEqual(raster.trapezoidExtents([5, 5, 0, 0, 0, 1, 1, 0, 1, 1].map(fixed)), null);
    });

    it('rejects a window outside the mask', () => {
        assert.throws(() => raster.addTraps({ data: new Uint8Array(4), width: 2, height: 2,
            window: { x: 1, y: 0, width: 2, height: 2 } }, 0, 0, []), RangeError);
        assert.throws(() => raster.addTraps({ data: new Uint8Array(4), width: 2, height: 2, bits: 4 },
            0, 0, []), RangeError);
    });
});

describe('xserver: RENDER rasterizes Precise, as pixman does', () => {

    let display, X, root, render, solid;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ display, X } = ctx);
            root = display.screen[0].root;
            X.require('render', (err2, ext) => {
                if (err2) return done(err2);
                render = ext;
                solid = X.AllocID();
                render.CreateSolidFill(solid, 0, 0, 0, 1);
                done();
            });
        });
    });

    afterEach(() => {
        X.terminate();
        display = X = render = null;
    });

    // an a8 pixmap cleared to 0, `draw(pic)`, and its bytes
    function drawA8(w, h, draw, cb) {
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, 8, w, h);
        const pic = X.AllocID();
        render.CreatePicture(pic, pixmap, render.a8);
        render.FillRectangles(render.PictOp.Src, pic, [0, 0, 0, 0], [0, 0, w, h]);
        draw(pic);
        X.GetImage(2, pixmap, 0, 0, w, h, 0xffffffff, (err, img) => {
            if (err) throw err;
            cb(Buffer.from(img.data));
        });
    }

    for (const name of Object.keys(TRIANGLES)) {
        it(`Triangles: ${name} comes out as a pixman server drew it`, done => {
            drawA8(W, H, pic => render.Triangles(render.PictOp.Add, solid, 0, 0, pic, render.a8,
                TRIANGLES[name]), data => {
                assert.strictEqual(data.toString('hex'), golden(name));
                done();
            });
        });
    }

    for (const name of Object.keys(TRAPS)) {
        it(`AddTraps: ${name} comes out as a pixman server drew it`, done => {
            drawA8(W, H, pic => render.AddTraps(pic, 0, 0, TRAPS[name].map(v => v / 65536)), data => {
                assert.strictEqual(data.toString('hex'), golden(name));
                done();
            });
        });
    }

    it('AddTraps offsets are whole pixels', done => {
        const moved = TRAPS['a heptagon'].map((v, i) => (v - ((i % 3 === 2) ? 7 : 3) * 65536) / 65536);
        drawA8(W, H, pic => render.AddTraps(pic, 3, 7, moved), data => {
            assert.strictEqual(data.toString('hex'), golden('a heptagon'));
            done();
        });
    });

    it('TriStrip and TriFan are their triangles', done => {
        const pts = [1.3, 0.7, 14.6, 3.2, 5.1, 11.4, 13.25, 10.5];
        const want = new Uint8Array(W * H);
        raster.addTriangles({ data: want, width: W, height: H }, 0, 0,
            raster.stripToTriangles(pts.map(fixed)));
        drawA8(W, H, pic => render.TriStrip(render.PictOp.Add, solid, 0, 0, pic, render.a8, pts), strip => {
            assert.deepStrictEqual(new Uint8Array(strip), want);
            want.fill(0);
            raster.addTriangles({ data: want, width: W, height: H }, 0, 0,
                raster.fanToTriangles(pts.map(fixed)));
            drawA8(W, H, pic => render.TriFan(render.PictOp.Add, solid, 0, 0, pic, render.a8, pts), fan => {
                assert.deepStrictEqual(new Uint8Array(fan), want);
                done();
            });
        });
    });

    it('a shape that starts above the pixmap keeps its own top', done => {
        // the triangle from the quirk test above, drawn 35 rows up: the
        // server's mask spans the triangle's extents, so the pixmap gets the
        // whole's rows, not a mask cut at its top edge
        const tris = [2701713, 949813 - 35 * 65536, 2704660, 3174996 - 35 * 65536, 3739022, 507253 - 35 * 65536];
        const whole = new Uint8Array(64 * 64);
        raster.addTriangles({ data: whole, width: 64, height: 64 }, 0, 0,
            [2701713, 949813, 2704660, 3174996, 3739022, 507253]);
        drawA8(64, 29, pic => render.Triangles(render.PictOp.Add, solid, 0, 0, pic, render.a8,
            tris.map(v => v / 65536)), data => {
            assert.deepStrictEqual(new Uint8Array(data), whole.subarray(35 * 64));
            assert.strictEqual(data[617], 189);
            done();
        });
    });
});
