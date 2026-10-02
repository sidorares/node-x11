// Trapezoids, Triangles, TriStrip, TriFan and AddTraps on the real server,
// against lib/render-raster.js and against the JS server (lib/xserver) given
// the same requests: random geometry, over and beyond the picture, and the
// masks must come out the same to the byte. The real server is whatever
// $DISPLAY names — Xvfb in CI, which rasterizes with pixman like Xorg,
// Xwayland and XQuartz.
const assert = require('assert');
const x11 = require('../lib');
const raster = require('../lib/render-raster');
const { boot } = require('./xserver/boot');

const W = 64;
const H = 48;
// per test; RENDER_PRECISE_DRAWINGS=2000 for a long soak
const DRAWINGS = Number(process.env.RENDER_PRECISE_DRAWINGS) || 30;

describe('RENDER Precise rasterization against the real server', () => {

    let real;
    let js;

    function setUp(display, cb) {
        const X = display.client;
        X.require('render', (err, R) => {
            if (err)
                return cb(err);
            const ctx = { display, X, R, root: display.screen[0].root };
            ctx.black = X.AllocID();
            R.CreateSolidFill(ctx.black, 0, 0, 0, 1);
            ctx.white = X.AllocID();
            R.CreateSolidFill(ctx.white, 1, 1, 1, 1);
            // a patterned 7x5 tile, to see where each shape registers its
            // source. Channels 0 or 1: the servers convert other 16-bit
            // colours to 8 bits differently
            const tile = X.AllocID();
            X.CreatePixmap(tile, ctx.root, 24, 7, 5);
            ctx.tile = X.AllocID();
            R.CreatePicture(ctx.tile, tile, R.rgb24, { repeat: R.Repeat.Normal });
            for (let y = 0; y < 5; y++)
                for (let x = 0; x < 7; x++)
                    R.FillRectangles(R.PictOp.Src, ctx.tile,
                        [x & 1, (x >> 1) & 1, y & 1, 1], [x, y, 1, 1]);
            cb(null, ctx);
        });
    }

    before(done => {
        x11.createClient((err, display) => {
            if (err)
                return done(err);
            setUp(display, (err2, ctx) => {
                if (err2)
                    return done(err2);
                real = ctx;
                boot((err3, booted) => {
                    if (err3)
                        return done(err3);
                    setUp(booted.display, (err4, ctx2) => {
                        js = ctx2;
                        done(err4);
                    });
                });
            });
        });
    });

    after(() => {
        for (const ctx of [real, js])
            if (ctx)
                ctx.X.terminate();
    });

    // A picture of `depth` (1, 8 or 24) cleared to `fill`, drawn on, and
    // read back as bytes. A depth-1 picture is read through an a8 one it is
    // copied into, so that every scene reads back one byte or word a pixel.
    function scene(ctx, depth, fill, values, draw) {
        const { X, R, root } = ctx;
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, depth, W, H);
        const pic = X.AllocID();
        R.CreatePicture(pic, pixmap, { 1: R.mono1, 8: R.a8, 24: R.rgb24 }[depth], values);
        R.FillRectangles(R.PictOp.Src, pic, fill, [0, 0, W, H]);
        draw(pic);
        if (depth === 1) {
            return scene(ctx, 8, [0, 0, 0, 0], {}, a8 =>
                R.Composite(R.PictOp.Src, pic, 0, a8, 0, 0, 0, 0, 0, 0, W, H))
                .then(data => {
                    R.FreePicture(pic);
                    X.FreePixmap(pixmap);
                    return data;
                });
        }
        return new Promise((resolve, reject) => {
            X.GetImage(2, pixmap, 0, 0, W, H, 0xffffffff, (err, img) => {
                R.FreePicture(pic);
                X.FreePixmap(pixmap);
                if (err)
                    return reject(err);
                const data = Buffer.from(img.data);
                if (depth === 24) // the pad byte of a 32-bit pixel is undefined
                    for (let i = 3; i < data.length; i += 4)
                        data[i] = 0;
                resolve(data);
            });
        });
    }

    // the same scene on both servers
    function both(depth, fill, values, draw) {
        return Promise.all([real, js].map(ctx => scene(ctx, depth, fill, values, pic => draw(ctx, pic))));
    }

    function firstDifference(want, got, stride = 1) {
        for (let i = 0; i < want.length; i++) {
            if (want[i] !== got[i]) {
                const p = Math.floor(i / stride);
                return `pixel ${p % W},${Math.floor(p / W)} is ${got[i]}, the server drew ${want[i]}`;
            }
        }
        return null;
    }

    let seed = 294;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;
    // coordinates on the 16.16 grid, a third of the picture beyond each side
    const fx = v => Math.trunc(v * 65536) / 65536;
    const randX = () => fx((rnd() * 1.6 - 0.3) * W);
    const randY = () => fx((rnd() * 1.6 - 0.3) * H);
    const fixed = list => list.map(v => v * 65536);

    function randomTriangles() {
        const tris = [];
        for (let i = 0, n = 3 * (1 + Math.floor(rnd() * 6)); i < n; i++)
            tris.push(randX(), randY());
        return tris;
    }

    function randomTrapezoids() {
        // each side a line through two points anywhere, most of them not on
        // the top or the bottom, now and then a horizontal one
        const traps = [];
        for (let i = 0, n = 1 + Math.floor(rnd() * 5); i < n; i++) {
            const top = randY();
            const ly = randY();
            traps.push(top, top + fx(rnd() * H * 0.8),
                randX(), ly, randX(), rnd() < 0.1 ? ly : randY(),
                randX() + W / 2, randY(), randX() + W / 2, randY());
        }
        return traps;
    }

    function randomTraps() {
        const traps = [];
        for (let i = 0, n = 1 + Math.floor(rnd() * 8); i < n; i++) {
            const y = randY();
            const x = randX();
            traps.push(x, x + fx(rnd() * 20), y, randX(), randX() + fx(rnd() * 30), y + fx(rnd() * 30));
        }
        return traps;
    }

    // What an X server draws from Trapezoids with Add, an opaque source and
    // `bits` of mask onto a cleared picture: pixman_composite_trapezoids'
    // mask, which spans the trapezoids' extents, where it meets the picture.
    function predictComposite(traps, bits) {
        const out = new Uint8Array(W * H);
        const box = raster.trapezoidExtents(traps);
        if (!box)
            return out;
        const x0 = Math.max(box.x1, 0);
        const y0 = Math.max(box.y1, 0);
        const w = Math.min(box.x2, W) - x0;
        const h = Math.min(box.y2, H) - y0;
        if (w <= 0 || h <= 0)
            return out;
        const mask = new Uint8Array(w * h);
        raster.addTrapezoids({
            data: mask, width: box.x2 - box.x1, height: box.y2 - box.y1, bits,
            window: { x: x0 - box.x1, y: y0 - box.y1, width: w, height: h }
        }, -box.x1, -box.y1, traps);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++)
                out[(y + y0) * W + x + x0] = bits === 1 ? mask[y * w + x] * 255 : mask[y * w + x];
        return out;
    }

    async function each(name, make, check) {
        for (let k = 0; k < DRAWINGS; k++) {
            const shapes = make();
            const message = await check(shapes);
            if (message)
                assert.fail(`${name}, drawing ${k}: ${message}`);
        }
    }

    it('Triangles: the module and the JS server draw the server\'s masks', async () => {
        for (const bits of [8, 1]) {
            await each(`a${bits} mask`, randomTriangles, async tris => {
                const [want, got] = await both(8, [0, 0, 0, 0], {}, (ctx, pic) =>
                    ctx.R.Triangles(ctx.R.PictOp.Add, ctx.black, 0, 0, pic,
                        bits === 8 ? ctx.R.a8 : ctx.R.mono1, tris));
                return firstDifference(want, predictComposite(raster.trianglesToTrapezoids(fixed(tris)), bits)) ||
                    firstDifference(want, got);
            });
        }
    });

    it('Trapezoids: sides extended through their points, as the server does', async () => {
        await each('Trapezoids', randomTrapezoids, async traps => {
            const [want, got] = await both(8, [0, 0, 0, 0], {}, (ctx, pic) =>
                ctx.R.Trapezoids(ctx.R.PictOp.Add, ctx.black, 0, 0, pic, ctx.R.a8, traps));
            return firstDifference(want, predictComposite(fixed(traps), 8)) || firstDifference(want, got);
        });
    });

    it('TriStrip and TriFan: as their triangles', async () => {
        await each('TriStrip/TriFan', () => randomTriangles().slice(0, 12), async points => {
            for (const req of ['TriStrip', 'TriFan']) {
                const [want, got] = await both(8, [0, 0, 0, 0], {}, (ctx, pic) =>
                    ctx.R[req](ctx.R.PictOp.Add, ctx.black, 0, 0, pic, ctx.R.a8, points));
                const tris = req === 'TriStrip'
                    ? raster.stripToTriangles(fixed(points))
                    : raster.fanToTriangles(fixed(points));
                const message = firstDifference(want, predictComposite(raster.trianglesToTrapezoids(tris), 8)) ||
                    firstDifference(want, got);
                if (message)
                    return `${req}: ${message}`;
            }
            return null;
        });
    });

    it('AddTraps: into a8 and a1 pictures, at whole-pixel offsets', async () => {
        await each('AddTraps', randomTraps, async traps => {
            const off = [Math.floor(rnd() * 20) - 10, Math.floor(rnd() * 20) - 10];
            for (const depth of [8, 1]) {
                const [want, got] = await both(depth, [0, 0, 0, 0], {}, (ctx, pic) =>
                    ctx.R.AddTraps(pic, off[0], off[1], traps));
                const local = new Uint8Array(W * H);
                raster.addTraps({ data: local, width: W, height: H, bits: depth }, off[0], off[1], fixed(traps));
                if (depth === 1)
                    local.forEach((v, i) => { local[i] = v * 255; });
                const message = firstDifference(want, local) || firstDifference(want, got);
                if (message)
                    return `depth ${depth}: ${message}`;
            }
            return null;
        });
    });

    it('the JS server composites through them as the server does', async () => {
        // Operators whose arithmetic the two servers share exactly: Add and
        // Over of an opaque source, and the operators that reach past the
        // shapes to the whole picture, onto a half-covered one
        await each('compositing', randomTriangles, async tris => {
            const traps = randomTrapezoids();
            const sx = Math.floor(rnd() * 20) - 10;
            const sy = Math.floor(rnd() * 20) - 10;
            const scenes = {
                'Over, no maskFormat, Sharp edges': [24, [0, 0, 0, 1], {}, (ctx, pic) =>
                    ctx.R.Triangles(ctx.R.PictOp.Over, ctx.white, 0, 0, pic, 0, tris)],
                'Over, no maskFormat, Smooth edges': [24, [0, 0, 0, 1], { polyEdge: 1 }, (ctx, pic) =>
                    ctx.R.Triangles(ctx.R.PictOp.Over, ctx.white, 0, 0, pic, 0, tris)],
                'Src': [8, [0, 0, 0, 0.6], {}, (ctx, pic) =>
                    ctx.R.Triangles(ctx.R.PictOp.Src, ctx.black, 0, 0, pic, ctx.R.a8, tris)],
                'In': [8, [0, 0, 0, 0.6], {}, (ctx, pic) =>
                    ctx.R.Triangles(ctx.R.PictOp.In, ctx.black, 0, 0, pic, ctx.R.a8, tris)],
                'Trapezoids Src from a tile': [24, [0, 0, 0, 1], {}, (ctx, pic) =>
                    ctx.R.Trapezoids(ctx.R.PictOp.Src, ctx.tile, sx, sy, pic, ctx.R.a8, traps)],
                'Triangles Src from a tile': [24, [0, 0, 0, 1], {}, (ctx, pic) =>
                    ctx.R.Triangles(ctx.R.PictOp.Src, ctx.tile, sx, sy, pic, ctx.R.a8, tris)]
            };
            for (const [name, [depth, fill, values, draw]] of Object.entries(scenes)) {
                const [want, got] = await both(depth, fill, values, draw);
                const message = firstDifference(want, got, depth === 24 ? 4 : 1);
                if (message)
                    return `${name}: ${message}`;
            }
            return null;
        });
    });
});
