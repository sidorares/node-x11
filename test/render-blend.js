// RENDER 0.11's blend operators, Multiply to HSLLuminosity, on the real
// server and on the JS server (lib/xserver) given the same requests: random
// premultiplied pixels, through Composite, an a8 mask, FillRectangles and
// Triangles, onto rgba32 and rgb24. The real server is whatever $DISPLAY
// names — Xvfb in CI, which composites with pixman like Xorg, Xwayland and
// XQuartz.
//
// pixman runs ColorDodge, ColorBurn, SoftLight and the four HSL modes in
// single-precision floats, and truncates the result to 8 bits, so where the
// true value falls on a 1/256 step the two servers can land either side of
// it: those may be one apart, now and then. The rest are 8-bit integer
// arithmetic and come out the same to the bit.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const x11 = require('../lib');
const { boot } = require('./xserver/boot');
const { isWideBlend } = require('../lib/xserver/extensions/render-blend');

const N = 32; // a picture is N x N random pixels
// per operator and scene; RENDER_BLEND_ROUNDS=50 for a long soak
const ROUNDS = Number(process.env.RENDER_BLEND_ROUNDS) || 2;

// mulberry32: every number it makes is a good one
function mulberry32(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('RENDER blend operators against the real server', () => {

    let real;
    let js;
    let supported = false;

    function setUp(display, cb) {
        const X = display.client;
        X.require('render', (err, R) => {
            if (err)
                return cb(err);
            R.QueryVersion(0, 11, (err2, version) => {
                if (err2)
                    return cb(err2);
                cb(null, { display, X, R, root: display.screen[0].root, version });
            });
        });
    }

    before((t, done) => {
        x11.createClient((err, display) => {
            if (err)
                return done(err);
            setUp(display, (err2, ctx) => {
                if (err2)
                    return done(err2);
                real = ctx;
                supported = ctx.version[0] > 0 || ctx.version[1] >= 11;
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

    // N x N premultiplied 0xAARRGGBB pixels, a share of them opaque and some
    // transparent, little-endian as a ZPixmap of depth 32 carries them
    function randomPixels(rnd, opaque) {
        const bytes = Buffer.alloc(N * N * 4);
        for (let i = 0; i < N * N; i++) {
            const k = rnd();
            const a = k < opaque ? 255 : k < opaque + 0.05 ? 0 : Math.floor(rnd() * 256);
            const c = () => Math.floor(rnd() * (a + 1));
            bytes.writeUInt32LE(((a << 24) | (c() << 16) | (c() << 8) | c()) >>> 0, i * 4);
        }
        return bytes;
    }

    function picture(ctx, depth, bytes) {
        const { X, R, root } = ctx;
        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, depth, N, N);
        const gc = X.AllocID();
        X.CreateGC(gc, pixmap);
        X.PutImage(2, pixmap, gc, N, N, 0, 0, 0, depth, bytes);
        X.FreeGC(gc);
        const pic = X.AllocID();
        R.CreatePicture(pic, pixmap, { 32: R.rgba32, 24: R.rgb24, 8: R.a8 }[depth]);
        return { pixmap, pic };
    }

    // what `draw` makes of the backdrop, read back, on one server
    function scene(ctx, depth, backdrop, draw) {
        const { X, R } = ctx;
        const dst = picture(ctx, depth, backdrop);
        draw(ctx, dst.pic);
        return new Promise((resolve, reject) => {
            X.GetImage(2, dst.pixmap, 0, 0, N, N, 0xffffffff, (err, img) => {
                R.FreePicture(dst.pic);
                X.FreePixmap(dst.pixmap);
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

    const BLENDS = () => Object.entries(real.R.PictOp)
        .filter(([name, op]) => op >= real.R.PictOp.BlendMinimum &&
            op <= real.R.PictOp.BlendMaximum && !name.startsWith('Blend'));

    // Every channel of every pixel the same, or for a wide mode within one,
    // and seldom that: a slip that is one too many in every pixel is not
    // single precision.
    async function compare(name, op, depth, backdrop, draw) {
        const [want, got] = await Promise.all([real, js].map(ctx => scene(ctx, depth, backdrop, draw)));
        let near = 0;
        for (let i = 0; i < want.length; i++) {
            const off = Math.abs(want[i] - got[i]);
            if (off === 0)
                continue;
            const p = i >> 2;
            if (off > 1 || !isWideBlend(op)) {
                assert.fail(`${name}: pixel ${p % N},${Math.floor(p / N)} channel ${i & 3} ` +
                    `is ${got[i]}, the server drew ${want[i]}`);
            }
            near++;
        }
        assert.ok(near <= want.length / 100, `${name}: ${near} channels one away from the server's`);
    }

    // pixman's HSL modes through a mask scaled green by the mask twice and
    // blue not at all, a typo in pixman-combine-float.c's
    // MAKE_NON_SEPARABLE_PDF_COMBINERS. Debian bookworm's pixman, which CI's
    // Xvfb runs, has it, and XQuartz's 0.46.4 does not, drawing what the JS
    // server does. Over a transparent backdrop an HSL mode through a mask is
    // the masked source alone, so the typo shows as a blue the mask left
    // whole; where it does, the masked scenes leave the HSL modes out.
    let hslMaskTypo = null;
    async function hasHslMaskTypo() {
        if (hslMaskTypo !== null)
            return hslMaskTypo;
        const src = Buffer.alloc(N * N * 4);
        for (let i = 0; i < N * N; i++)
            src.writeUInt32LE(0xffc8c8c8, i * 4);
        const mask = Buffer.alloc(N * N, 128);
        const out = await scene(real, 32, Buffer.alloc(N * N * 4), (ctx, pic) => {
            const s = picture(ctx, 32, src);
            const m = picture(ctx, 8, mask);
            ctx.R.Composite(ctx.R.PictOp.HSLColor, s.pic, m.pic, pic, 0, 0, 0, 0, 0, 0, N, N);
        });
        const [b, g, r] = out;
        // 200 through a mask of 128 is 100, and through it twice 50
        const is = (v, want) => Math.abs(v - want) <= 1;
        if (is(r, 100) && is(g, 100) && is(b, 100))
            hslMaskTypo = false;
        else if (is(r, 100) && is(g, 50) && is(b, 200))
            hslMaskTypo = true;
        else
            assert.fail(`HSLColor of 200 through a mask of 128 over nothing came to ${r},${g},${b}`);
        return hslMaskTypo;
    }

    // a masked scene of `op` is left out where the server's pixman has the typo
    async function skipsMasked(t, name, op) {
        if (op < real.R.PictOp.HSLHue || !(await hasHslMaskTypo()))
            return false;
        t.diagnostic(`${name} through a mask left out: the server's pixman masks green twice and blue not at all`);
        return true;
    }

    it('Composite, onto rgba32 and rgb24', async t => {
        if (!supported)
            return t.skip('the server has no RENDER 0.11');
        for (const [name, op] of BLENDS()) {
            const rnd = mulberry32(op);
            for (let k = 0; k < ROUNDS; k++) {
                const src = randomPixels(rnd, 0.3);
                for (const depth of [32, 24]) {
                    const backdrop = randomPixels(rnd, depth === 24 ? 1 : 0.3);
                    await compare(`${name} onto depth ${depth}`, op, depth, backdrop, (ctx, pic) => {
                        const s = picture(ctx, 32, src);
                        ctx.R.Composite(op, s.pic, 0, pic, 0, 0, 0, 0, 0, 0, N, N);
                    });
                }
            }
        }
    });

    it('Composite through an a8 mask', async t => {
        if (!supported)
            return t.skip('the server has no RENDER 0.11');
        for (const [name, op] of BLENDS()) {
            if (await skipsMasked(t, name, op))
                continue;
            const rnd = mulberry32(op + 100);
            for (let k = 0; k < ROUNDS; k++) {
                const src = randomPixels(rnd, 0.3);
                const backdrop = randomPixels(rnd, 0.3);
                // an a8 row is N bytes, which N being a multiple of 4 pads
                const mask = Buffer.alloc(N * N);
                for (let i = 0; i < mask.length; i++)
                    mask[i] = rnd() < 0.2 ? 255 : Math.floor(rnd() * 256);
                await compare(`${name} through a mask`, op, 32, backdrop, (ctx, pic) => {
                    const s = picture(ctx, 32, src);
                    const m = picture(ctx, 8, mask);
                    ctx.R.Composite(op, s.pic, m.pic, pic, 0, 0, 0, 0, 0, 0, N, N);
                });
            }
        }
    });

    it('FillRectangles and Triangles', async t => {
        if (!supported)
            return t.skip('the server has no RENDER 0.11');
        for (const [name, op] of BLENDS()) {
            const rnd = mulberry32(op + 200);
            for (let k = 0; k < ROUNDS; k++) {
                const backdrop = randomPixels(rnd, 0.3);
                // a colour a row, each channel a whole 8-bit value, which
                // both servers take from 16 bits the same way
                const colours = randomPixels(rnd, 0.3);
                const colour = y => {
                    const p = colours.readUInt32LE(y * N * 4);
                    return [16, 8, 0, 24].map(shift => ((p >>> shift) & 0xff) / 255);
                };
                await compare(`${name} FillRectangles`, op, 32, backdrop, (ctx, pic) => {
                    for (let y = 0; y < N; y++)
                        ctx.R.FillRectangles(op, pic, colour(y), [0, y, N, 1]);
                });
                const tris = [];
                for (let i = 0; i < 6; i++)
                    tris.push(Math.trunc(rnd() * N * 65536) / 65536, Math.trunc(rnd() * N * 65536) / 65536);
                const c = colour(0);
                // a triangle's coverage is a mask, to pixman
                if (await skipsMasked(t, name, op))
                    continue;
                await compare(`${name} Triangles`, op, 32, backdrop, (ctx, pic) => {
                    const solid = ctx.X.AllocID();
                    ctx.R.CreateSolidFill(solid, ...c);
                    ctx.R.Triangles(op, solid, 0, 0, pic, ctx.R.a8, tris);
                });
            }
        }
    });
});
