'use strict';

// RENDER extension for the pure-JS X server.
//
// The wire decoder mirrors this repo's client encoder (lib/ext/render.js).
// Two deviations from stock renderproto follow from that:
//  - AddGlyphs images arrive with rows already padded to a 4-byte stride and
//    offX/offY already divided down to whole pixels by the client.
//  - AddTraps carries SPANFIX trapezoids (top l/r/y, bottom l/r/y), the same
//    layout Xorg uses for AddTraps.
//
// Pixel model: pictures composite in premultiplied ARGB over the server's
// Uint32 rasters. How the 32-bit cell maps to channels depends on the
// picture format depth:
//  - 32 (rgba32): full 0xAARRGGBB, premultiplied.
//  - 24 (rgb24):  0x00RRGGBB; alpha reads as 255, writes drop alpha and keep
//    the top byte 0 - the core server (compose(), GetImage, PutImage) only
//    understands the low 24 bits, so we must not invent data up there.
//  -  8 (a8):     alpha in the low byte, color reads as premultiplied black.
//  -  1 (mono1):  alpha in bit 0.

const { XError, codes } = require('../errors');

// RENDER errors, as offsets from the extension's firstError
const ERR_PICTFORMAT = 0;
const ERR_PICTURE = 1;
const ERR_PICTOP = 2;
const ERR_GLYPHSET = 3;
const ERR_GLYPH = 4;

const FIXED = 65536; // 16.16 fixed point
const pad4 = n => (n + 3) & ~3;

// picture format ids: arbitrary XIDs outside any client's resource range.
// The descriptors are exactly what the client's require('render') handshake
// looks for to derive Render.rgba32 / rgb24 / a8 / mono1.
const FORMAT_LIST = [
    { id: 0x101, depth: 32, r: [16, 255], g: [8, 255], b: [0, 255], a: [24, 255] }, // rgba32
    { id: 0x102, depth: 24, r: [16, 255], g: [8, 255], b: [0, 255], a: [0, 0] },    // rgb24
    { id: 0x103, depth: 8, r: [0, 0], g: [0, 0], b: [0, 0], a: [0, 255] },          // a8
    { id: 0x104, depth: 1, r: [0, 0], g: [0, 0], b: [0, 0], a: [0, 1] }             // mono1
];
const RGB24_ID = 0x102;
const formats = new Map();
for (const f of FORMAT_LIST)
    formats.set(f.id, f);

// per-server firstError (error codes are allocated at registration time)
const firstErrors = new WeakMap();
const renderError = (server, offset, badValue) =>
    new XError(firstErrors.get(server) + offset, badValue);

// wire COLOR (4 x CARD16 in r/g/b/a order, premultiplied) -> [a, r, g, b]
// floats 0..255. 65535 / 255 === 257 exactly.
function readColor(body, off) {
    return [
        body.readUInt16LE(off + 6) / 257,
        body.readUInt16LE(off) / 257,
        body.readUInt16LE(off + 2) / 257,
        body.readUInt16LE(off + 4) / 257
    ];
}

// ---------------------------------------------------------------------
// raster channel access (see the pixel-model note above)

function readPx(raster, depth, x, y, out) {
    const p = raster.data[y * raster.width + x];
    switch (depth) {
        case 32:
            out[0] = (p >>> 24) & 0xff;
            out[1] = (p >>> 16) & 0xff;
            out[2] = (p >>> 8) & 0xff;
            out[3] = p & 0xff;
            return out;
        case 24:
            out[0] = 255;
            out[1] = (p >>> 16) & 0xff;
            out[2] = (p >>> 8) & 0xff;
            out[3] = p & 0xff;
            return out;
        case 8:
            out[0] = p & 0xff;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            return out;
        default: // 1
            out[0] = (p & 1) * 255;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            return out;
    }
}

const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

function writePx(raster, depth, x, y, a, r, g, b) {
    const i = y * raster.width + x;
    switch (depth) {
        case 32:
            raster.data[i] =
                ((clamp255(a) << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)) >>> 0;
            return;
        case 24:
            raster.data[i] = ((clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)) >>> 0;
            return;
        case 8:
            raster.data[i] = clamp255(a);
            return;
        default: // 1
            raster.data[i] = a >= 128 ? 1 : 0;
    }
}

// ---------------------------------------------------------------------
// Porter-Duff (premultiplied). Returns [Fa, Fb] for src/dst contribution;
// result channel = src*Fa + dst*Fb, alphas included.

function blendFactors(op, as, ad) {
    switch (op) {
        case 0: return [0, 0];                 // Clear
        case 1: return [1, 0];                 // Src
        case 2: return [0, 1];                 // Dst
        case 3: return [1, 1 - as];            // Over
        case 4: return [1 - ad, 1];            // OverReverse
        case 5: return [ad, 0];                // In
        case 6: return [0, as];                // InReverse
        case 7: return [1 - ad, 0];            // Out
        case 8: return [0, 1 - as];            // OutReverse
        case 9: return [ad, 1 - as];           // Atop
        case 10: return [1 - ad, as];          // AtopReverse
        case 11: return [1 - ad, 1 - as];      // Xor
        case 12: return [1, 1];                // Add
        case 13: return [as > 0 ? Math.min(1, (1 - ad) / as) : 1, 1]; // Saturate
        default: return null;                  // caller raises BadPictOp
    }
}

// ---------------------------------------------------------------------
// antialiased coverage accumulation, shared by AddTraps, Trapezoids and the
// triangle requests.
//
// One trapezoid = linear left edge (tlx,ty)-(blx,by) and right edge
// (trx,ty)-(brx,by). Horizontal coverage per column is analytic (exact);
// vertically each pixel row is split into SUB sub-bands sampled at their
// midpoints - combined that comfortably exceeds the 4x4-supersampling
// quality bar while staying O(covered pixels).

const SUB = 4;

function accumulateTrap(cov, W, H, tlx, trx, ty, blx, brx, by) {
    if (!(by > ty))
        return;
    const yStart = Math.max(0, Math.floor(ty));
    const yEnd = Math.min(H, Math.ceil(by));
    const invH = 1 / (by - ty);
    for (let Y = yStart; Y < yEnd; Y++) {
        const bandTop = Math.max(ty, Y);
        const bandBot = Math.min(by, Y + 1);
        if (!(bandBot > bandTop))
            continue;
        const step = (bandBot - bandTop) / SUB;
        const rowBase = Y * W;
        for (let s = 0; s < SUB; s++) {
            const t = (bandTop + (s + 0.5) * step - ty) * invH;
            let lx = tlx + (blx - tlx) * t;
            let rx = trx + (brx - trx) * t;
            if (rx < lx) {
                const tmp = lx;
                lx = rx;
                rx = tmp;
            }
            if (rx <= 0 || lx >= W)
                continue;
            if (lx < 0)
                lx = 0;
            if (rx > W)
                rx = W;
            const x0 = Math.floor(lx);
            const x1 = Math.ceil(rx);
            for (let X = x0; X < x1; X++) {
                const covered = Math.min(X + 1, rx) - Math.max(X, lx);
                if (covered > 0)
                    cov[rowBase + X] += covered * step;
            }
        }
    }
}

// ---------------------------------------------------------------------
// gradient color lookup. Stops are [{offset, color: [a,r,g,b]}] sorted by
// offset; t outside the stop range clamps to the edge stops (pad).

function gradientAt(stops, t) {
    if (stops.length === 0)
        return [0, 0, 0, 0];
    if (!(t > stops[0].offset))
        return stops[0].color;
    const last = stops[stops.length - 1];
    if (!(t < last.offset))
        return last.color;
    for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i].offset) {
            const a = stops[i - 1];
            const b = stops[i];
            const span = b.offset - a.offset;
            const f = span > 0 ? (t - a.offset) / span : 0;
            return [
                a.color[0] + (b.color[0] - a.color[0]) * f,
                a.color[1] + (b.color[1] - a.color[1]) * f,
                a.color[2] + (b.color[2] - a.color[2]) * f,
                a.color[3] + (b.color[3] - a.color[3]) * f
            ];
        }
    }
    return last.color;
}

function getPicture(server, xid) {
    const res = server.resources.get(xid);
    if (!res || res.type !== 'picture')
        throw renderError(server, ERR_PICTURE, xid);
    return res;
}

function getGlyphset(server, xid) {
    const res = server.resources.get(xid);
    if (!res || res.type !== 'glyphset')
        throw renderError(server, ERR_GLYPHSET, xid);
    return res;
}

// pictures with backing storage (as opposed to solid/gradient sources)
function targetRaster(pict) {
    if (!pict.drawable)
        throw new XError(codes.Match, pict.id);
    return pict.drawable.raster; // read per-op: window rasters are replaced on resize
}

function damage(server, pict) {
    if (pict.drawable && pict.drawable.type === 'window')
        server.damageWindow(pict.drawable);
}

// clip set by SetPictureClipRectangles: null (no clip) or rects in drawable
// coordinates. All write loops test destination pixels against it.
function inClip(pict, x, y) {
    const clip = pict.clip;
    if (!clip)
        return true;
    for (let i = 0; i < clip.length; i++) {
        const r = clip[i];
        if (x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height)
            return true;
    }
    return false;
}

// -------------------------------------------------------------------
// sampling: (x, y) are source-space coordinates at pixel centers
// (caller passes srcX + i + 0.5). The picture transform maps them into
// texture space, then the filter fetches texels honoring `repeat`.

function fetchTexel(pict, ix, iy, out) {
    const raster = pict.drawable.raster;
    const W = raster.width;
    const H = raster.height;
    switch (pict.repeat) {
        case 1: // Normal: tile
            ix = ((ix % W) + W) % W;
            iy = ((iy % H) + H) % H;
            break;
        case 2: // Pad: clamp to edge
            ix = ix < 0 ? 0 : ix >= W ? W - 1 : ix;
            iy = iy < 0 ? 0 : iy >= H ? H - 1 : iy;
            break;
        case 3: { // Reflect
            ix = ((ix % (2 * W)) + 2 * W) % (2 * W);
            if (ix >= W)
                ix = 2 * W - 1 - ix;
            iy = ((iy % (2 * H)) + 2 * H) % (2 * H);
            if (iy >= H)
                iy = 2 * H - 1 - iy;
            break;
        }
        default: // None: outside is transparent black
            if (ix < 0 || iy < 0 || ix >= W || iy >= H) {
                out[0] = out[1] = out[2] = out[3] = 0;
                return out;
            }
    }
    return readPx(raster, pict.format.depth, ix, iy, out);
}

function applyTransform(pict, x, y, out2) {
    const m = pict.transform;
    if (!m) {
        out2[0] = x;
        out2[1] = y;
        return out2;
    }
    const w = m[6] * x + m[7] * y + m[8];
    const inv = w !== 0 ? 1 / w : 0;
    out2[0] = (m[0] * x + m[1] * y + m[2]) * inv;
    out2[1] = (m[3] * x + m[4] * y + m[5]) * inv;
    return out2;
}

function gradientParam(pict, x, y) {
    switch (pict.kind) {
        case 'linear': {
            const dx = pict.p2[0] - pict.p1[0];
            const dy = pict.p2[1] - pict.p1[1];
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0)
                return 0;
            return ((x - pict.p1[0]) * dx + (y - pict.p1[1]) * dy) / lenSq;
        }
        case 'radial': {
            // two-circle gradient (canvas createRadialGradient semantics):
            // largest s with |P - lerp(c1,c2,s)| = lerp(r1,r2,s)
            const cdx = pict.p2[0] - pict.p1[0];
            const cdy = pict.p2[1] - pict.p1[1];
            const dr = pict.r2 - pict.r1;
            const pdx = x - pict.p1[0];
            const pdy = y - pict.p1[1];
            const a = cdx * cdx + cdy * cdy - dr * dr;
            const b = pdx * cdx + pdy * cdy + pict.r1 * dr;
            const c = pdx * pdx + pdy * pdy - pict.r1 * pict.r1;
            if (Math.abs(a) < 1e-9)
                return b !== 0 ? c / (2 * b) : 0;
            const disc = b * b - a * c;
            if (disc < 0)
                return 0;
            // largest root of a*s^2 - 2b*s + c = 0; for a < 0 (always the
            // case for concentric canvas-style gradients, where
            // a = -dr^2) that is the (b - sqrt)/a branch
            const sq = Math.sqrt(disc);
            return a > 0 ? (b + sq) / a : (b - sq) / a;
        }
        default: { // conical; angle is in degrees per renderproto
            const ang = Math.atan2(y - pict.p1[1], x - pict.p1[0]);
            let t = (ang - (pict.angle * Math.PI) / 180) / (2 * Math.PI);
            t -= Math.floor(t);
            return t;
        }
    }
}

// returns sample(x, y, out) -> out = [a, r, g, b] floats 0..255
function makeSampler(pict) {
    if (pict.kind === 'solid') {
        const c = pict.color;
        return (x, y, out) => {
            out[0] = c[0];
            out[1] = c[1];
            out[2] = c[2];
            out[3] = c[3];
            return out;
        };
    }
    if (pict.kind === 'linear' || pict.kind === 'radial' || pict.kind === 'conical') {
        const pos = [0, 0];
        return (x, y, out) => {
            applyTransform(pict, x, y, pos);
            const c = gradientAt(pict.stops, gradientParam(pict, pos[0], pos[1]));
            out[0] = c[0];
            out[1] = c[1];
            out[2] = c[2];
            out[3] = c[3];
            return out;
        };
    }

    // drawable-backed picture
    const pos = [0, 0];
    const filter = pict.filter;
    if (filter === 'bilinear') {
        const t00 = [0, 0, 0, 0];
        const t10 = [0, 0, 0, 0];
        const t01 = [0, 0, 0, 0];
        const t11 = [0, 0, 0, 0];
        return (x, y, out) => {
            applyTransform(pict, x, y, pos);
            const u = pos[0] - 0.5;
            const v = pos[1] - 0.5;
            const x0 = Math.floor(u);
            const y0 = Math.floor(v);
            const fx = u - x0;
            const fy = v - y0;
            fetchTexel(pict, x0, y0, t00);
            fetchTexel(pict, x0 + 1, y0, t10);
            fetchTexel(pict, x0, y0 + 1, t01);
            fetchTexel(pict, x0 + 1, y0 + 1, t11);
            for (let c = 0; c < 4; c++) {
                const top = t00[c] + (t10[c] - t00[c]) * fx;
                const bot = t01[c] + (t11[c] - t01[c]) * fx;
                out[c] = top + (bot - top) * fy;
            }
            return out;
        };
    }
    if (filter === 'convolution' && pict.filterParams && pict.filterParams.length > 2) {
        const kw = Math.max(1, Math.round(pict.filterParams[0]));
        const kh = Math.max(1, Math.round(pict.filterParams[1]));
        const kernel = pict.filterParams.slice(2);
        const tex = [0, 0, 0, 0];
        return (x, y, out) => {
            applyTransform(pict, x, y, pos);
            const x0 = Math.floor(pos[0] - kw / 2 + 0.5);
            const y0 = Math.floor(pos[1] - kh / 2 + 0.5);
            out[0] = out[1] = out[2] = out[3] = 0;
            for (let j = 0; j < kh; j++) {
                for (let i = 0; i < kw; i++) {
                    const k = kernel[j * kw + i];
                    if (k === 0)
                        continue;
                    fetchTexel(pict, x0 + i, y0 + j, tex);
                    out[0] += tex[0] * k;
                    out[1] += tex[1] * k;
                    out[2] += tex[2] * k;
                    out[3] += tex[3] * k;
                }
            }
            return out;
        };
    }
    // nearest (also the stand-in for fast/good/best/binomial/gaussian)
    return (x, y, out) => {
        applyTransform(pict, x, y, pos);
        return fetchTexel(pict, Math.floor(pos[0]), Math.floor(pos[1]), out);
    };
}

// -------------------------------------------------------------------
// the core composite loop, shared by Composite / the coverage requests /
// glyphs. `coverage(i, j)` (0..1) modulates the source like a
// non-component-alpha mask; op is applied across the whole region, per
// RENDER's dst = op(src IN mask, dst) - including where coverage is 0.

function compositeSpan(server, op, sample, srcX, srcY, mask, dst, dstX, dstY, w, h, coverage) {
    const raster = targetRaster(dst);
    const depth = dst.format.depth;
    const W = raster.width;
    const H = raster.height;
    const s = [0, 0, 0, 0];
    const m = [0, 0, 0, 0];
    const d = [0, 0, 0, 0];
    for (let j = 0; j < h; j++) {
        const Y = dstY + j;
        if (Y < 0 || Y >= H)
            continue;
        for (let i = 0; i < w; i++) {
            const X = dstX + i;
            if (X < 0 || X >= W || !inClip(dst, X, Y))
                continue;
            sample(srcX + i + 0.5, srcY + j + 0.5, s);
            let f = 1;
            if (mask) {
                mask.sample(mask.x + i + 0.5, mask.y + j + 0.5, m);
                f = m[0] / 255;
            }
            if (coverage)
                f *= coverage(i, j);
            const sa = s[0] * f;
            const sr = s[1] * f;
            const sg = s[2] * f;
            const sb = s[3] * f;
            readPx(raster, depth, X, Y, d);
            const factors = blendFactors(op, sa / 255, d[0] / 255);
            if (!factors)
                throw renderError(server, ERR_PICTOP, op);
            const [fa, fb] = factors;
            writePx(
                raster, depth, X, Y,
                sa * fa + d[0] * fb,
                sr * fa + d[1] * fb,
                sg * fa + d[2] * fb,
                sb * fa + d[3] * fb
            );
        }
    }
}

// -------------------------------------------------------------------
// request handlers

function createPicture(server, client, body) {
    const pid = body.readUInt32LE(0);
    const drawable = server.getDrawable(body.readUInt32LE(4));
    const format = formats.get(body.readUInt32LE(8));
    if (!format)
        throw renderError(server, ERR_PICTFORMAT, body.readUInt32LE(8));
    if (format.depth !== drawable.depth)
        throw new XError(codes.Match, drawable.id);
    server.checkIdFree(client, pid);
    const pict = {
        type: 'picture',
        id: pid,
        owner: client,
        kind: 'drawable',
        drawable,
        format,
        repeat: 0,
        componentAlpha: 0,
        transform: null,
        filter: 'nearest',
        filterParams: null,
        clip: null
    };
    applyPictureValues(pict, body, 12);
    server.resources.set(pid, pict);
}

// CreatePicture/ChangePicture LISTofVALUE, in the protocol's bit order.
// Only repeat, clipMask=None (clears the clip list) and componentAlpha
// affect rendering here; polyEdge/polyMode (always-antialiased
// rasterization), alpha-map and pixmap clip-mask values are accepted and
// ignored.
function applyPictureValues(pict, body, maskOff) {
    const mask = body.readUInt32LE(maskOff);
    let off = maskOff + 4;
    for (let bit = 0; bit < 13; bit++) {
        if (!(mask & (1 << bit)))
            continue;
        if (bit === 0)
            pict.repeat = body.readUInt8(off);
        else if (bit === 6 && body.readUInt32LE(off) === 0)
            pict.clip = null; // clipMask None
        else if (bit === 12)
            pict.componentAlpha = body.readUInt8(off);
        off += 4;
    }
}

function setPictureClipRectangles(server, body) {
    const pict = getPicture(server, body.readUInt32LE(0));
    const ox = body.readInt16LE(4);
    const oy = body.readInt16LE(6);
    const rects = [];
    for (let off = 8; off + 8 <= body.length; off += 8)
        rects.push({
            x: ox + body.readInt16LE(off),
            y: oy + body.readInt16LE(off + 2),
            width: body.readUInt16LE(off + 4),
            height: body.readUInt16LE(off + 6)
        });
    pict.clip = rects;
}

function queryPictFormats(server, client) {
    // 4 formats + one screen section binding the root visual to rgb24 +
    // one subpixel entry. The client handshake only walks the format list,
    // but the sections are emitted per spec for other consumers.
    const nFormats = FORMAT_LIST.length;
    const screenBytes = 8 /* nDepth+fallback */ + 8 /* one PICTDEPTH */ + 8; /* one PICTVISUAL */
    const payload = nFormats * 28 + screenBytes + 4;
    const b = client.startReply(payload / 4, 0);
    b.writeUInt32LE(nFormats, 8);
    b.writeUInt32LE(1, 12);  // screens
    b.writeUInt32LE(1, 16);  // depths
    b.writeUInt32LE(1, 20);  // visuals
    b.writeUInt32LE(1, 24);  // subpixel entries
    let o = 32;
    for (const f of FORMAT_LIST) {
        b.writeUInt32LE(f.id, o);
        b.writeUInt8(1, o + 4);        // type: Direct
        b.writeUInt8(f.depth, o + 5);
        b.writeUInt16LE(f.r[0], o + 8);
        b.writeUInt16LE(f.r[1], o + 10);
        b.writeUInt16LE(f.g[0], o + 12);
        b.writeUInt16LE(f.g[1], o + 14);
        b.writeUInt16LE(f.b[0], o + 16);
        b.writeUInt16LE(f.b[1], o + 18);
        b.writeUInt16LE(f.a[0], o + 20);
        b.writeUInt16LE(f.a[1], o + 22);
        b.writeUInt32LE(0, o + 24);    // colormap: None
        o += 28;
    }
    // PICTSCREEN: one depth (24) with the root visual bound to rgb24
    b.writeUInt32LE(1, o);                          // nDepth
    b.writeUInt32LE(RGB24_ID, o + 4);               // fallback format
    b.writeUInt8(24, o + 8);                        // PICTDEPTH.depth
    b.writeUInt16LE(1, o + 10);                     // nPictVisuals
    b.writeUInt32LE(server.rootVisual >>> 0, o + 16);
    b.writeUInt32LE(RGB24_ID, o + 20);
    o += 24;
    b.writeUInt32LE(0, o);                          // subpixel: Unknown
    client.send(b);
}

function queryFilters(client) {
    const names = ['nearest', 'bilinear', 'convolution', 'fast', 'good', 'best'];
    let strBytes = 0;
    for (const n of names)
        strBytes += 1 + n.length;
    const payload = pad4(names.length * 2 + strBytes);
    const b = client.startReply(payload / 4, 0);
    b.writeUInt32LE(names.length, 8);  // aliases (one per filter, none set)
    b.writeUInt32LE(names.length, 12); // filters
    let o = 32;
    for (let i = 0; i < names.length; i++) {
        b.writeUInt16LE(0xffff, o);
        o += 2;
    }
    for (const n of names) {
        b.writeUInt8(n.length, o++);
        b.write(n, o, 'latin1');
        o += n.length;
    }
    client.send(b);
}

function composite(server, body) {
    const op = body.readUInt8(0);
    const src = getPicture(server, body.readUInt32LE(4));
    const maskId = body.readUInt32LE(8);
    const dst = getPicture(server, body.readUInt32LE(12));
    const srcX = body.readInt16LE(16);
    const srcY = body.readInt16LE(18);
    const maskX = body.readInt16LE(20);
    const maskY = body.readInt16LE(22);
    const dstX = body.readInt16LE(24);
    const dstY = body.readInt16LE(26);
    const w = body.readUInt16LE(28);
    const h = body.readUInt16LE(30);
    const mask = maskId
        ? { sample: makeSampler(getPicture(server, maskId)), x: maskX, y: maskY }
        : null;
    compositeSpan(server, op, makeSampler(src), srcX, srcY, mask, dst, dstX, dstY, w, h, null);
    damage(server, dst);
}

function fillRectangles(server, body) {
    const op = body.readUInt8(0);
    const dst = getPicture(server, body.readUInt32LE(4));
    const color = readColor(body, 8);
    const raster = targetRaster(dst);
    const depth = dst.format.depth;
    const d = [0, 0, 0, 0];
    for (let off = 16; off + 8 <= body.length; off += 8) {
        const rx = body.readInt16LE(off);
        const ry = body.readInt16LE(off + 2);
        const rw = body.readUInt16LE(off + 4);
        const rh = body.readUInt16LE(off + 6);
        const x0 = Math.max(0, rx);
        const y0 = Math.max(0, ry);
        const x1 = Math.min(raster.width, rx + rw);
        const y1 = Math.min(raster.height, ry + rh);
        for (let Y = y0; Y < y1; Y++) {
            for (let X = x0; X < x1; X++) {
                if (!inClip(dst, X, Y))
                    continue;
                readPx(raster, depth, X, Y, d);
                const factors = blendFactors(op, color[0] / 255, d[0] / 255);
                if (!factors)
                    throw renderError(server, ERR_PICTOP, op);
                const [fa, fb] = factors;
                writePx(
                    raster, depth, X, Y,
                    color[0] * fa + d[0] * fb,
                    color[1] * fa + d[1] * fb,
                    color[2] * fa + d[2] * fb,
                    color[3] * fa + d[3] * fb
                );
            }
        }
    }
    damage(server, dst);
}

// shared tail of Trapezoids/Triangles/TriStrip/TriFan: accumulate the
// spanfix `traps` into one coverage buffer over their extents and composite
// through it. Per Xorg, the source aligns srcX/srcY with (alignX, alignY),
// the integer position of the request's first point (a no-op for repeating
// solid sources with srcX/srcY 0).
function compositeCoverage(server, op, src, srcX, srcY, dst, traps, alignX, alignY) {
    if (traps.length === 0)
        return;
    const raster = targetRaster(dst);
    const W = raster.width;
    const H = raster.height;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of traps) {
        // left/right edges may cross (accumulateTrap swaps them per
        // scanline), so both x bounds consider all four fields
        minX = Math.min(minX, t.tlx, t.trx, t.blx, t.brx);
        maxX = Math.max(maxX, t.tlx, t.trx, t.blx, t.brx);
        minY = Math.min(minY, t.ty);
        maxY = Math.max(maxY, t.by);
    }

    // extents of the implicit mask, clipped to the destination
    const ex0 = Math.max(0, Math.floor(minX));
    const ey0 = Math.max(0, Math.floor(minY));
    const ex1 = Math.min(W, Math.ceil(maxX));
    const ey1 = Math.min(H, Math.ceil(maxY));
    if (ex1 <= ex0 || ey1 <= ey0)
        return;
    const ew = ex1 - ex0;
    const eh = ey1 - ey0;

    const cov = new Float32Array(ew * eh);
    for (const t of traps)
        accumulateTrap(cov, ew, eh, t.tlx - ex0, t.trx - ex0, t.ty - ey0,
            t.blx - ex0, t.brx - ex0, t.by - ey0);

    compositeSpan(
        server, op, makeSampler(src),
        srcX + ex0 - Math.floor(alignX), srcY + ey0 - Math.floor(alignY),
        null, dst, ex0, ey0, ew, eh,
        (i, j) => Math.min(1, cov[j * ew + i])
    );
    damage(server, dst);
}

// sort the three vertices by y and split at the middle one: each half is a
// trapezoid with linear left/right edges
function triangleTraps(traps, x1, y1, x2, y2, x3, y3) {
    const v = [[x1, y1], [x2, y2], [x3, y3]].sort((p, q) => p[1] - q[1]);
    const [v0, v1, v2] = v;
    if (v2[1] <= v0[1])
        return; // degenerate
    const xm = v0[0] + ((v2[0] - v0[0]) * (v1[1] - v0[1])) / (v2[1] - v0[1]);
    traps.push({ tlx: v0[0], trx: v0[0], ty: v0[1], blx: v1[0], brx: xm, by: v1[1] });
    traps.push({ tlx: v1[0], trx: xm, ty: v1[1], blx: v2[0], brx: v2[0], by: v2[1] });
}

// Triangles(11) / TriStrip(12) / TriFan(13) share the header; they differ
// only in how the point list forms triangles
function triangleRequest(server, body, mode) {
    const op = body.readUInt8(0);
    const src = getPicture(server, body.readUInt32LE(4));
    const dst = getPicture(server, body.readUInt32LE(8));
    // maskFormat (offset 12) only picks the coverage precision; coverage is
    // always accumulated at 8 bits here
    const srcX = body.readInt16LE(16);
    const srcY = body.readInt16LE(18);
    const pts = [];
    for (let off = 20; off + 8 <= body.length; off += 8)
        pts.push([body.readInt32LE(off) / FIXED, body.readInt32LE(off + 4) / FIXED]);

    const traps = [];
    if (mode === 'list') {
        for (let i = 0; i + 3 <= pts.length; i += 3)
            triangleTraps(traps, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1],
                pts[i + 2][0], pts[i + 2][1]);
    } else if (mode === 'strip') {
        for (let i = 0; i + 3 <= pts.length; i++)
            triangleTraps(traps, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1],
                pts[i + 2][0], pts[i + 2][1]);
    } else { // fan
        for (let i = 1; i + 2 <= pts.length; i++)
            triangleTraps(traps, pts[0][0], pts[0][1], pts[i][0], pts[i][1],
                pts[i + 1][0], pts[i + 1][1]);
    }
    if (pts.length === 0)
        return;
    compositeCoverage(server, op, src, srcX, srcY, dst, traps, pts[0][0], pts[0][1]);
}

// Trapezoids (10): classic renderproto trapezoid - top/bottom y plus left
// and right edge lines; converted to spanfix by intersecting the edges with
// the top and bottom scanlines
function trapezoids(server, body) {
    const op = body.readUInt8(0);
    const src = getPicture(server, body.readUInt32LE(4));
    const dst = getPicture(server, body.readUInt32LE(8));
    const srcX = body.readInt16LE(16);
    const srcY = body.readInt16LE(18);
    const traps = [];
    let alignX = 0;
    let alignY = 0;
    for (let off = 20; off + 40 <= body.length; off += 40) {
        const top = body.readInt32LE(off) / FIXED;
        const bot = body.readInt32LE(off + 4) / FIXED;
        const l = [
            body.readInt32LE(off + 8) / FIXED, body.readInt32LE(off + 12) / FIXED,
            body.readInt32LE(off + 16) / FIXED, body.readInt32LE(off + 20) / FIXED
        ];
        const r = [
            body.readInt32LE(off + 24) / FIXED, body.readInt32LE(off + 28) / FIXED,
            body.readInt32LE(off + 32) / FIXED, body.readInt32LE(off + 36) / FIXED
        ];
        if (!(bot > top) || l[3] === l[1] || r[3] === r[1])
            continue; // empty or horizontal edge lines
        const xAt = (e, y) => e[0] + ((e[2] - e[0]) * (y - e[1])) / (e[3] - e[1]);
        const trap = {
            tlx: xAt(l, top), trx: xAt(r, top), ty: top,
            blx: xAt(l, bot), brx: xAt(r, bot), by: bot
        };
        if (traps.length === 0) {
            alignX = trap.tlx;
            alignY = trap.ty;
        }
        traps.push(trap);
    }
    compositeCoverage(server, op, src, srcX, srcY, dst, traps, alignX, alignY);
}

function addTraps(server, body) {
    const dst = getPicture(server, body.readUInt32LE(0));
    const offX = body.readInt16LE(4);
    const offY = body.readInt16LE(6);
    const raster = targetRaster(dst);
    const W = raster.width;
    const H = raster.height;
    const depth = dst.format.depth;

    // accumulate the whole request into one float coverage buffer before
    // the saturating add: traps produced by slab decomposition share
    // fractional edges, and per-trap rounding would leave seams
    const cov = new Float32Array(W * H);
    let minY = H;
    let maxY = 0;
    for (let off = 8; off + 24 <= body.length; off += 24) {
        const tlx = body.readInt32LE(off) / FIXED + offX;
        const trx = body.readInt32LE(off + 4) / FIXED + offX;
        const ty = body.readInt32LE(off + 8) / FIXED + offY;
        const blx = body.readInt32LE(off + 12) / FIXED + offX;
        const brx = body.readInt32LE(off + 16) / FIXED + offX;
        const by = body.readInt32LE(off + 20) / FIXED + offY;
        accumulateTrap(cov, W, H, tlx, trx, ty, blx, brx, by);
        const y0 = Math.max(0, Math.floor(ty));
        const y1 = Math.min(H, Math.ceil(by));
        if (y0 < minY)
            minY = y0;
        if (y1 > maxY)
            maxY = y1;
    }

    const d = [0, 0, 0, 0];
    for (let Y = minY; Y < maxY; Y++) {
        for (let X = 0; X < W; X++) {
            const c = cov[Y * W + X];
            if (c <= 0 || !inClip(dst, X, Y))
                continue;
            readPx(raster, depth, X, Y, d);
            const add = Math.min(1, c) * 255;
            writePx(raster, depth, X, Y, Math.min(255, d[0] + add), d[1], d[2], d[3]);
        }
    }
    damage(server, dst);
}

function setPictureTransform(server, body) {
    const pict = getPicture(server, body.readUInt32LE(0));
    const m = new Array(9);
    let identity = true;
    for (let i = 0; i < 9; i++) {
        m[i] = body.readInt32LE(4 + i * 4) / FIXED;
        const expect = i === 0 || i === 4 || i === 8 ? 1 : 0;
        if (m[i] !== expect)
            identity = false;
    }
    pict.transform = identity ? null : m;
}

function setPictureFilter(server, body) {
    const pict = getPicture(server, body.readUInt32LE(0));
    const nameLen = body.readUInt16LE(4);
    const name = body.toString('latin1', 8, 8 + nameLen);
    const known = ['nearest', 'bilinear', 'convolution', 'fast', 'good', 'best', 'binomial', 'gaussian'];
    if (!known.includes(name))
        throw new XError(codes.Value, 0);
    const params = [];
    for (let off = 8 + pad4(nameLen); off + 4 <= body.length; off += 4)
        params.push(body.readInt32LE(off) / FIXED);
    pict.filter = name;
    pict.filterParams = params.length ? params : null;
}

function readStops(body, off) {
    const n = body.readUInt32LE(off);
    const stops = [];
    const colorsOff = off + 4 + n * 4;
    for (let i = 0; i < n; i++) {
        stops.push({
            offset: body.readInt32LE(off + 4 + i * 4) / FIXED,
            color: readColor(body, colorsOff + i * 8)
        });
    }
    return stops;
}

function createSourcePicture(server, client, pid, props) {
    server.checkIdFree(client, pid);
    server.resources.set(pid, Object.assign({
        type: 'picture',
        id: pid,
        owner: client,
        drawable: null,
        format: FORMAT_LIST[0], // sources behave as rgba32
        repeat: 0,
        componentAlpha: 0,
        transform: null,
        filter: 'nearest',
        filterParams: null,
        clip: null
    }, props));
}

function addGlyphs(server, body) {
    const gs = getGlyphset(server, body.readUInt32LE(0));
    const n = body.readUInt32LE(4);
    const idsOff = 8;
    const infoOff = idsOff + n * 4;
    let imgOff = infoOff + n * 12;
    for (let i = 0; i < n; i++) {
        const id = body.readUInt32LE(idsOff + i * 4);
        const o = infoOff + i * 12;
        const width = body.readUInt16LE(o);
        const height = body.readUInt16LE(o + 2);
        const stride = pad4(width); // a8 scanlines are 4-byte padded on the wire
        const len = stride * height;
        if (imgOff + len > body.length)
            throw new XError(codes.Length, len);
        const data = new Uint8Array(len);
        data.set(body.subarray(imgOff, imgOff + len));
        gs.glyphs.set(id, {
            width,
            height,
            stride,
            x: body.readInt16LE(o + 4),
            y: body.readInt16LE(o + 6),
            offX: body.readInt16LE(o + 8),
            offY: body.readInt16LE(o + 10),
            data
        });
        imgOff += len;
    }
}

function compositeGlyphs(server, body, idBytes) {
    const op = body.readUInt8(0);
    const src = getPicture(server, body.readUInt32LE(4));
    const dst = getPicture(server, body.readUInt32LE(8));
    // maskFormat (offset 12): each glyph is composited individually, which
    // is identical for Over/opaque-src draws and avoids a second coverage
    // pass
    let gs = getGlyphset(server, body.readUInt32LE(16));
    const srcX = body.readInt16LE(20);
    const srcY = body.readInt16LE(22);

    const raster = targetRaster(dst);
    const depth = dst.format.depth;
    const W = raster.width;
    const H = raster.height;
    const sample = makeSampler(src);
    const s = [0, 0, 0, 0];
    const d = [0, 0, 0, 0];

    let penX = 0;
    let penY = 0;
    let srcOffX = 0; // srcX/srcY align the source with the first glyph origin
    let srcOffY = 0;
    let first = true;

    let off = 24;
    while (off + 8 <= body.length) {
        const n = body.readUInt8(off);
        if (n === 255) { // glyphset switch elt
            gs = getGlyphset(server, body.readUInt32LE(off + 8));
            off += 12;
            continue;
        }
        penX += body.readInt16LE(off + 4);
        penY += body.readInt16LE(off + 6);
        off += 8;
        for (let k = 0; k < n; k++) {
            const id =
                idBytes === 1 ? body.readUInt8(off + k) :
                idBytes === 2 ? body.readUInt16LE(off + k * 2) :
                body.readUInt32LE(off + k * 4);
            const g = gs.glyphs.get(id);
            if (!g)
                throw renderError(server, ERR_GLYPH, id);
            if (first) {
                first = false;
                srcOffX = srcX - penX;
                srcOffY = srcY - penY;
            }
            // glyph image origin: pen - (info.x, info.y)
            const gx = penX - g.x;
            const gy = penY - g.y;
            for (let row = 0; row < g.height; row++) {
                const Y = gy + row;
                if (Y < 0 || Y >= H)
                    continue;
                for (let col = 0; col < g.width; col++) {
                    const X = gx + col;
                    if (X < 0 || X >= W || !inClip(dst, X, Y))
                        continue;
                    const c = g.data[row * g.stride + col];
                    if (c === 0 && (op === 3 || op === 12))
                        continue; // Over/Add: no-op
                    const f = c / 255;
                    sample(X + srcOffX + 0.5, Y + srcOffY + 0.5, s);
                    readPx(raster, depth, X, Y, d);
                    const factors = blendFactors(op, (s[0] * f) / 255, d[0] / 255);
                    if (!factors)
                        throw renderError(server, ERR_PICTOP, op);
                    const [fa, fb] = factors;
                    writePx(
                        raster, depth, X, Y,
                        s[0] * f * fa + d[0] * fb,
                        s[1] * f * fa + d[1] * fb,
                        s[2] * f * fa + d[2] * fb,
                        s[3] * f * fa + d[3] * fb
                    );
                }
            }
            penX += g.offX;
            penY += g.offY;
        }
        off += pad4(n * idBytes);
    }
    damage(server, dst);
}

// CreateCursor (27): snapshot the ARGB32 source picture so the backing
// pixmap can be freed. The JS server has no visible cursor; the resource
// exists so core requests (ChangeWindowAttributes cursor, FreeCursor) and
// clients that define cursors keep working.
function createCursor(server, client, body) {
    const cid = body.readUInt32LE(0);
    const src = getPicture(server, body.readUInt32LE(4));
    const raster = targetRaster(src);
    server.checkIdFree(client, cid);
    server.resources.set(cid, {
        type: 'cursor',
        id: cid,
        owner: client,
        width: raster.width,
        height: raster.height,
        x: body.readUInt16LE(8),
        y: body.readUInt16LE(10),
        pixels: raster.data.slice()
    });
}

function createAnimCursor(server, client, body) {
    const cid = body.readUInt32LE(0);
    const frames = [];
    for (let off = 4; off + 8 <= body.length; off += 8) {
        const xid = body.readUInt32LE(off);
        const cursor = server.resources.get(xid);
        if (!cursor || cursor.type !== 'cursor')
            throw new XError(codes.Cursor, xid);
        frames.push({ cursor: xid, delay: body.readUInt32LE(off + 4) });
    }
    server.checkIdFree(client, cid);
    server.resources.set(cid, { type: 'cursor', id: cid, owner: client, frames });
}

module.exports = {
    name: 'RENDER',
    eventsCount: 0,
    errorsCount: 5, // PictFormat, Picture, PictOp, GlyphSet, Glyph

    init(server, extInfo) {
        firstErrors.set(server, extInfo.firstError);
    },

    handleRequest(server, client, minor, body) {
        switch (minor) {
            case 0: { // QueryVersion -> 0.11
                const b = client.startReply(0, 0);
                b.writeUInt32LE(0, 8);
                b.writeUInt32LE(11, 12);
                client.send(b);
                return;
            }
            case 1: // QueryPictFormats
                return queryPictFormats(server, client);
            case 2: // QueryPictIndexValues: no indexed formats on this server
                throw new XError(codes.Match, body.readUInt32LE(0));
            case 4: // CreatePicture
                return createPicture(server, client, body);
            case 5: { // ChangePicture
                const pict = getPicture(server, body.readUInt32LE(0));
                applyPictureValues(pict, body, 4);
                return;
            }
            case 6: // SetPictureClipRectangles
                return setPictureClipRectangles(server, body);
            case 7: { // FreePicture
                const pict = getPicture(server, body.readUInt32LE(0));
                server.resources.delete(pict.id);
                return;
            }
            case 8: // Composite
                return composite(server, body);
            case 10: // Trapezoids
                return trapezoids(server, body);
            case 11: // Triangles
                return triangleRequest(server, body, 'list');
            case 12: // TriStrip
                return triangleRequest(server, body, 'strip');
            case 13: // TriFan
                return triangleRequest(server, body, 'fan');
            case 17: { // CreateGlyphSet
                const gsid = body.readUInt32LE(0);
                const format = formats.get(body.readUInt32LE(4));
                if (!format)
                    throw renderError(server, ERR_PICTFORMAT, body.readUInt32LE(4));
                if (format.depth !== 8)
                    throw new XError(codes.Match, format.id); // a8 only
                server.checkIdFree(client, gsid);
                server.resources.set(gsid, {
                    type: 'glyphset',
                    id: gsid,
                    owner: client,
                    glyphs: new Map()
                });
                return;
            }
            case 18: { // ReferenceGlyphSet: new id sharing the same glyphs
                const gsid = body.readUInt32LE(0);
                const existing = getGlyphset(server, body.readUInt32LE(4));
                server.checkIdFree(client, gsid);
                server.resources.set(gsid, {
                    type: 'glyphset',
                    id: gsid,
                    owner: client,
                    glyphs: existing.glyphs
                });
                return;
            }
            case 19: { // FreeGlyphSet
                const gs = getGlyphset(server, body.readUInt32LE(0));
                server.resources.delete(gs.id);
                return;
            }
            case 20: // AddGlyphs
                return addGlyphs(server, body);
            case 22: { // FreeGlyphs
                const gs = getGlyphset(server, body.readUInt32LE(0));
                for (let off = 4; off + 4 <= body.length; off += 4)
                    gs.glyphs.delete(body.readUInt32LE(off));
                return;
            }
            case 23: // CompositeGlyphs8
                return compositeGlyphs(server, body, 1);
            case 24: // CompositeGlyphs16
                return compositeGlyphs(server, body, 2);
            case 25: // CompositeGlyphs32
                return compositeGlyphs(server, body, 4);
            case 26: // FillRectangles
                return fillRectangles(server, body);
            case 27: // CreateCursor
                return createCursor(server, client, body);
            case 28: // SetPictureTransform
                return setPictureTransform(server, body);
            case 29: // QueryFilters
                return queryFilters(client);
            case 30: // SetPictureFilter
                return setPictureFilter(server, body);
            case 31: // CreateAnimCursor
                return createAnimCursor(server, client, body);
            case 32: // AddTraps
                return addTraps(server, body);
            case 33: // CreateSolidFill
                return createSourcePicture(server, client, body.readUInt32LE(0), {
                    kind: 'solid',
                    color: readColor(body, 4)
                });
            case 34: // CreateLinearGradient
                return createSourcePicture(server, client, body.readUInt32LE(0), {
                    kind: 'linear',
                    p1: [body.readInt32LE(4) / FIXED, body.readInt32LE(8) / FIXED],
                    p2: [body.readInt32LE(12) / FIXED, body.readInt32LE(16) / FIXED],
                    stops: readStops(body, 20)
                });
            case 35: // CreateRadialGradient
                return createSourcePicture(server, client, body.readUInt32LE(0), {
                    kind: 'radial',
                    p1: [body.readInt32LE(4) / FIXED, body.readInt32LE(8) / FIXED],
                    p2: [body.readInt32LE(12) / FIXED, body.readInt32LE(16) / FIXED],
                    r1: body.readInt32LE(20) / FIXED,
                    r2: body.readInt32LE(24) / FIXED,
                    stops: readStops(body, 28)
                });
            case 36: // CreateConicalGradient
                return createSourcePicture(server, client, body.readUInt32LE(0), {
                    kind: 'conical',
                    p1: [body.readInt32LE(4) / FIXED, body.readInt32LE(8) / FIXED],
                    angle: body.readInt32LE(12) / FIXED,
                    stops: readStops(body, 16)
                });
            default:
                // AddGlyphsFromPicture(21) is unimplemented everywhere;
                // 3/9/14-16 are unused in renderproto
                throw new XError(codes.Implementation, 0, minor);
        }
    }
};
