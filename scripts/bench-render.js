// Throughput benchmark for the JS X server's software RENDER compositor.
//
//   node scripts/bench-render.js [--json]
//
// The scenarios are the ones a real toolkit generates: solid fills, an
// opaque blit, an alpha blend, a scaled blit through the transform path, a
// gradient, and a clipped fill. Each reports megapixels per second, which
// is the number that decides whether a UI repaint fits in a frame — a
// window repaint is a few hundred thousand pixels, so 10 Mpx/s is a 30 ms
// frame and 100 Mpx/s is 3 ms.
//
// Composites are driven through the extension's own request handlers, so
// what is measured is the path the protocol actually takes.
'use strict';

const { createServer } = require('../lib/xserver');
const render = require('../lib/xserver/extensions/render');

const W = 640;
const H = 480;
const RUN_MS = Number(process.env.BENCH_MS || 400);

function boot() {
    const server = createServer({ width: W, height: H });
    // the extension keeps per-server state (format table, error base)
    const ext = server.extensions.get('RENDER');
    if (!ext)
        throw new Error('server has no RENDER extension');
    return server;
}

// ids have to sit in the fake client's resource range (server.js:
// checkIdFree tests xid & ~resourceMask against resourceBase)
const RESOURCE_BASE = 0x200000;
let nextId = RESOURCE_BASE;
const id = () => ++nextId;

// --- request builders (little-endian bodies, as the dispatcher sees them) ---

function bodyCreatePicture(pid, drawable, formatId) {
    const b = Buffer.alloc(16);
    b.writeUInt32LE(pid, 0);
    b.writeUInt32LE(drawable, 4);
    b.writeUInt32LE(formatId, 8);
    b.writeUInt32LE(0, 12); // value mask
    return b;
}

function bodyFillRectangles(op, dst, color, rects) {
    const b = Buffer.alloc(16 + rects.length * 8);
    b.writeUInt8(op, 0);
    b.writeUInt32LE(dst, 4);
    b.writeUInt16LE(color[0], 8); // red
    b.writeUInt16LE(color[1], 10);
    b.writeUInt16LE(color[2], 12);
    b.writeUInt16LE(color[3], 14); // alpha
    rects.forEach((r, i) => {
        const o = 16 + i * 8;
        b.writeInt16LE(r[0], o);
        b.writeInt16LE(r[1], o + 2);
        b.writeUInt16LE(r[2], o + 4);
        b.writeUInt16LE(r[3], o + 6);
    });
    return b;
}

function bodyComposite(op, src, mask, dst, sx, sy, mx, my, dx, dy, w, h) {
    const b = Buffer.alloc(32);
    b.writeUInt8(op, 0);
    b.writeUInt32LE(src, 4);
    b.writeUInt32LE(mask, 8);
    b.writeUInt32LE(dst, 12);
    b.writeInt16LE(sx, 16);
    b.writeInt16LE(sy, 18);
    b.writeInt16LE(mx, 20);
    b.writeInt16LE(my, 22);
    b.writeInt16LE(dx, 24);
    b.writeInt16LE(dy, 26);
    b.writeUInt16LE(w, 28);
    b.writeUInt16LE(h, 30);
    return b;
}

function bodyLinearGradient(pid, p1, p2, stops) {
    const b = Buffer.alloc(4 + 16 + 4 + stops.length * (4 + 8));
    let o = 0;
    b.writeUInt32LE(pid, o); o += 4;
    b.writeInt32LE(p1[0] * 65536, o); o += 4;
    b.writeInt32LE(p1[1] * 65536, o); o += 4;
    b.writeInt32LE(p2[0] * 65536, o); o += 4;
    b.writeInt32LE(p2[1] * 65536, o); o += 4;
    b.writeUInt32LE(stops.length, o); o += 4;
    for (const s of stops) {
        b.writeInt32LE(s.at * 65536, o); o += 4;
    }
    for (const s of stops) {
        b.writeUInt16LE(s.color[0], o); o += 2;
        b.writeUInt16LE(s.color[1], o); o += 2;
        b.writeUInt16LE(s.color[2], o); o += 2;
        b.writeUInt16LE(s.color[3], o); o += 2;
    }
    return b;
}

function bodySetClip(dst, rects) {
    const b = Buffer.alloc(8 + rects.length * 8);
    b.writeUInt32LE(dst, 0);
    b.writeInt16LE(0, 4);
    b.writeInt16LE(0, 6);
    rects.forEach((r, i) => {
        const o = 8 + i * 8;
        b.writeInt16LE(r[0], o);
        b.writeInt16LE(r[1], o + 2);
        b.writeUInt16LE(r[2], o + 4);
        b.writeUInt16LE(r[3], o + 6);
    });
    return b;
}

// minor opcodes, from the RENDER protocol
const REQ = {
    CreatePicture: 4,
    SetPictureClipRectangles: 6,
    Composite: 8,
    FillRectangles: 26,
    CreateLinearGradient: 34
};

// A pretend client: the handlers only use it for replies, which none of the
// benchmarked requests produce.
const client = {
    startReply() { return Buffer.alloc(32); },
    send() {},
    seq: 1,
    resourceBase: RESOURCE_BASE,
    resourceMask: 0x1fffff
};

function setup() {
    const server = boot();
    const call = (minor, body) => render.handleRequest(server, client, minor, body);

    // a depth-24 destination pixmap the size of a window
    const dstPix = id();
    server.resources.set(dstPix, makePixmap(server, W, H, 24));
    const dst = id();
    call(REQ.CreatePicture, bodyCreatePicture(dst, dstPix, 0x102 /* rgb24 */));

    // source pixmaps at least as large as the blitted region, which is what
    // a double-buffer flush or an image draw actually looks like
    const srcPix = id();
    const srcRaster = makePixmap(server, W, H, 24);
    server.resources.set(srcPix, srcRaster);
    for (let i = 0; i < srcRaster.raster.data.length; i++)
        srcRaster.raster.data[i] = (i * 2654435761) >>> 8;
    const src = id();
    call(REQ.CreatePicture, bodyCreatePicture(src, srcPix, 0x102));

    // a 32-bit source with alpha, for the blend path
    const argbPix = id();
    const argbRaster = makePixmap(server, W, H, 32);
    server.resources.set(argbPix, argbRaster);
    for (let i = 0; i < argbRaster.raster.data.length; i++)
        argbRaster.raster.data[i] = (0x80 << 24 | (i * 40503) & 0xffffff) >>> 0;
    const argb = id();
    call(REQ.CreatePicture, bodyCreatePicture(argb, argbPix, 0x101 /* rgba32 */));

    return { server, call, dst, src, argb };
}

const { Raster } = require('../lib/xserver/raster');

function makePixmap(server, w, h, depth) {
    return {
        type: 'pixmap',
        id: 0,
        width: w,
        height: h,
        depth,
        raster: new Raster(w, h, depth)
    };
}

function time(label, pixelsPerCall, fn) {
    // warm up so the measurement is of optimised code
    for (let i = 0; i < 5; i++) fn();
    const t0 = process.hrtime.bigint();
    let calls = 0;
    while (Number(process.hrtime.bigint() - t0) / 1e6 < RUN_MS) {
        fn();
        calls++;
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const mpxPerSec = (calls * pixelsPerCall) / (ms / 1000) / 1e6;
    return { label, calls, ms: +ms.toFixed(1), mpxPerSec: +mpxPerSec.toFixed(1) };
}

function main() {
    const { call, dst, src, argb } = setup();
    const AREA = 512 * 384; // a window-sized region
    const rows = [];

    rows.push(time('FillRectangles Src (opaque)', AREA, () =>
        call(REQ.FillRectangles, bodyFillRectangles(1, dst, [0x2980, 0x4040, 0xb9b9, 0xffff], [[0, 0, 512, 384]]))));

    rows.push(time('FillRectangles Over (alpha)', AREA, () =>
        call(REQ.FillRectangles, bodyFillRectangles(3, dst, [0x2980, 0x4040, 0xb9b9, 0x8000], [[0, 0, 512, 384]]))));

    rows.push(time('Composite Src, untransformed', AREA, () =>
        call(REQ.Composite, bodyComposite(1, src, 0, dst, 0, 0, 0, 0, 0, 0, 512, 384))));

    rows.push(time('Composite Over, untransformed', AREA, () =>
        call(REQ.Composite, bodyComposite(3, argb, 0, dst, 0, 0, 0, 0, 0, 0, 512, 384))));

    // gradient source
    const grad = id();
    call(REQ.CreateLinearGradient, bodyLinearGradient(grad, [0, 0], [512, 384], [
        { at: 0, color: [0xffff, 0, 0, 0xffff] },
        { at: 1, color: [0, 0, 0xffff, 0xffff] }
    ]));
    rows.push(time('Composite Over, linear gradient', AREA, () =>
        call(REQ.Composite, bodyComposite(3, grad, 0, dst, 0, 0, 0, 0, 0, 0, 512, 384))));

    // clipped fill: same area, but every pixel tested against a clip list
    call(REQ.SetPictureClipRectangles, bodySetClip(dst, [[0, 0, 256, 384], [256, 0, 256, 384]]));
    rows.push(time('FillRectangles Src, 2 clip rects', AREA, () =>
        call(REQ.FillRectangles, bodyFillRectangles(1, dst, [0, 0xffff, 0, 0xffff], [[0, 0, 512, 384]]))));

    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(rows, null, 2));
        return;
    }
    const width = Math.max(...rows.map(r => r.label.length));
    console.log('scenario'.padEnd(width) + '   Mpx/s      calls');
    for (const r of rows)
        console.log(`${r.label.padEnd(width)}   ${String(r.mpxPerSec).padStart(6)}   ${String(r.calls).padStart(8)}`);
}

main();
