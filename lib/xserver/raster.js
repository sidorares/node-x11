'use strict';

// Pure-JS pixel raster used for every drawable (windows and pixmaps) of the
// JS X server. Works on Uint32Array pixels (X pixel values, 0xRRGGBB for the
// 24-bit TrueColor visual). Wire formats (ZPixmap packing, XYBitmap, byte
// order, scanline padding) are the server core's job: this module only ever
// sees plain pixel values.
//
// Every drawing op takes a `gc` state object (see DESIGN.md):
//   { func, planeMask, foreground, background, lineWidth, fillStyle,
//     arcMode, clip, clipXOrigin, clipYOrigin }
// `clip` is null (no clipping) or an array of {x, y, width, height} rects in
// drawable coordinates (clip origin already applied by the caller).

const font8x8 = require('./font8x8');

// GC functions (X protocol GXcopy etc.)
const GX = {
    clear: 0, and: 1, andReverse: 2, copy: 3, andInverted: 4, noop: 5,
    xor: 6, or: 7, nor: 8, equiv: 9, invert: 10, orReverse: 11,
    copyInverted: 12, orInverted: 13, nand: 14, set: 15
};

function combine(func, src, dst) {
    switch (func) {
        case GX.clear:        return 0;
        case GX.and:          return src & dst;
        case GX.andReverse:   return src & ~dst;
        case GX.copy:         return src;
        case GX.andInverted:  return ~src & dst;
        case GX.noop:         return dst;
        case GX.xor:          return src ^ dst;
        case GX.or:           return src | dst;
        case GX.nor:          return ~(src | dst);
        case GX.equiv:        return ~(src ^ dst);
        case GX.invert:       return ~dst;
        case GX.orReverse:    return src | ~dst;
        case GX.copyInverted: return ~src;
        case GX.orInverted:   return ~src | dst;
        case GX.nand:         return ~(src & dst);
        case GX.set:          return 0xffffffff;
        default:              return src;
    }
}

class Raster {
    constructor(width, height, depth) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.data = new Uint32Array(width * height);
    }

    _inClip(gc, x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height)
            return false;
        const clip = gc && gc.clip;
        if (!clip)
            return true;
        for (let i = 0; i < clip.length; i++) {
            const r = clip[i];
            if (x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height)
                return true;
        }
        return false;
    }

    // core pixel writer: clip, function, plane mask
    setPixel(gc, x, y, src) {
        if (!this._inClip(gc, x, y))
            return;
        const idx = y * this.width + x;
        const dst = this.data[idx];
        const mask = (gc && gc.planeMask !== undefined) ? gc.planeMask : 0xffffffff;
        const func = (gc && gc.func !== undefined) ? gc.func : GX.copy;
        const val = combine(func, src, dst);
        this.data[idx] = ((val & mask) | (dst & ~mask)) >>> 0;
    }

    // raw read (no gc)
    getPixel(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height)
            return 0;
        return this.data[y * this.width + x];
    }

    fillRect(gc, x, y, width, height, pixel) {
        const px = pixel !== undefined ? pixel : gc.foreground;
        const x1 = Math.max(0, x), y1 = Math.max(0, y);
        const x2 = Math.min(this.width, x + width), y2 = Math.min(this.height, y + height);
        for (let yy = y1; yy < y2; yy++)
            for (let xx = x1; xx < x2; xx++)
                this.setPixel(gc, xx, yy, px);
    }

    fillRects(gc, rects) {
        for (const r of rects)
            this.fillRect(gc, r.x, r.y, r.width, r.height);
    }

    drawRects(gc, rects) {
        for (const r of rects) {
            this.drawLine(gc, r.x, r.y, r.x + r.width, r.y);
            this.drawLine(gc, r.x + r.width, r.y, r.x + r.width, r.y + r.height);
            this.drawLine(gc, r.x + r.width, r.y + r.height, r.x, r.y + r.height);
            this.drawLine(gc, r.x, r.y + r.height, r.x, r.y);
        }
    }

    drawPoints(gc, points, coordMode) {
        let px = 0, py = 0;
        for (const p of points) {
            const x = coordMode === 1 ? px + p.x : p.x;
            const y = coordMode === 1 ? py + p.y : p.y;
            this.setPixel(gc, x, y, gc.foreground);
            px = x; py = y;
        }
    }

    // Bresenham; lineWidth 0/1 (wide lines drawn as repeated offsets, an
    // approximation good enough for demos)
    drawLine(gc, x1, y1, x2, y2) {
        const lw = Math.max(1, gc.lineWidth || 0);
        const half = Math.floor((lw - 1) / 2);
        const steep = Math.abs(y2 - y1) > Math.abs(x2 - x1);
        for (let off = -half; off < lw - half; off++) {
            let ox1 = x1, oy1 = y1, ox2 = x2, oy2 = y2;
            if (steep) { ox1 += off; ox2 += off; } else { oy1 += off; oy2 += off; }
            this._thinLine(gc, ox1, oy1, ox2, oy2);
        }
    }

    _thinLine(gc, x1, y1, x2, y2) {
        const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        let x = x1, y = y1;
        for (;;) {
            this.setPixel(gc, x, y, gc.foreground);
            if (x === x2 && y === y2)
                break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
    }

    drawLines(gc, points, coordMode) {
        if (points.length === 0)
            return;
        let x = points[0].x, y = points[0].y;
        for (let i = 1; i < points.length; i++) {
            const nx = coordMode === 1 ? x + points[i].x : points[i].x;
            const ny = coordMode === 1 ? y + points[i].y : points[i].y;
            this.drawLine(gc, x, y, nx, ny);
            x = nx; y = ny;
        }
        if (points.length === 1)
            this.setPixel(gc, x, y, gc.foreground);
    }

    drawSegments(gc, segments) {
        for (const s of segments)
            this.drawLine(gc, s.x1, s.y1, s.x2, s.y2);
    }

    // X arcs: bounding box + start/extent angles in 1/64 degree, y axis down,
    // 0 degrees = 3 o'clock, positive = counter-clockwise
    _arcPoints(arc, closed) {
        const cx = arc.x + arc.width / 2;
        const cy = arc.y + arc.height / 2;
        const rx = arc.width / 2, ry = arc.height / 2;
        const a1 = (arc.angle1 / 64) * Math.PI / 180;
        let sweep = (arc.angle2 / 64) * Math.PI / 180;
        if (sweep > 2 * Math.PI) sweep = 2 * Math.PI;
        if (sweep < -2 * Math.PI) sweep = -2 * Math.PI;
        const steps = Math.max(8, Math.ceil(Math.abs(sweep) * Math.max(rx, ry)));
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const a = a1 + sweep * (i / steps);
            pts.push({ x: Math.round(cx + rx * Math.cos(a)),
                       y: Math.round(cy - ry * Math.sin(a)) });
        }
        if (closed === 'pie')
            pts.push({ x: Math.round(cx), y: Math.round(cy) });
        return pts;
    }

    drawArcs(gc, arcs) {
        for (const arc of arcs) {
            const pts = this._arcPoints(arc);
            for (let i = 1; i < pts.length; i++)
                this.drawLine(gc, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
        }
    }

    fillArcs(gc, arcs) {
        // arcMode: 0 = Chord, 1 = PieSlice (GC default)
        const mode = gc.arcMode === 0 ? 'chord' : 'pie';
        for (const arc of arcs)
            this.fillPolyPoints(gc, this._arcPoints(arc, mode === 'pie' ? 'pie' : undefined));
    }

    // even-odd scanline polygon fill
    fillPolyPoints(gc, pts) {
        if (pts.length < 3)
            return;
        let minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }
        minY = Math.max(0, Math.floor(minY));
        maxY = Math.min(this.height - 1, Math.ceil(maxY));
        for (let y = minY; y <= maxY; y++) {
            const xs = [];
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
                    const t = (y - a.y) / (b.y - a.y);
                    xs.push(a.x + t * (b.x - a.x));
                }
            }
            xs.sort((p, q) => p - q);
            for (let i = 0; i + 1 < xs.length; i += 2) {
                const x1 = Math.round(xs[i]), x2 = Math.round(xs[i + 1]);
                for (let x = x1; x <= x2; x++)
                    this.setPixel(gc, x, y, gc.foreground);
            }
        }
    }

    fillPoly(gc, points, shape, coordMode) {
        const abs = [];
        let x = 0, y = 0;
        for (let i = 0; i < points.length; i++) {
            x = (coordMode === 1 && i > 0) ? x + points[i].x : points[i].x;
            y = (coordMode === 1 && i > 0) ? y + points[i].y : points[i].y;
            abs.push({ x, y });
        }
        this.fillPolyPoints(gc, abs);
    }

    // pixels: Uint32Array of length width*height (already decoded by caller)
    putPixels(gc, dstX, dstY, width, height, pixels) {
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++)
                this.setPixel(gc, dstX + x, dstY + y, pixels[y * width + x]);
    }

    // bitmap put (XYBitmap / stipple-style): bits as Uint8Array rows padded
    // to whole bytes, bit 0 = leftmost when leftPad = 0
    putBitmap(gc, dstX, dstY, width, height, bytesPerRow, bits, opaque) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const byte = bits[y * bytesPerRow + (x >> 3)];
                const set = (byte >> (x & 7)) & 1;
                if (set)
                    this.setPixel(gc, dstX + x, dstY + y, gc.foreground);
                else if (opaque)
                    this.setPixel(gc, dstX + x, dstY + y, gc.background);
            }
        }
    }

    // returns Uint32Array width*height (out-of-bounds pixels read as 0)
    getPixels(x, y, width, height) {
        const out = new Uint32Array(width * height);
        for (let yy = 0; yy < height; yy++)
            for (let xx = 0; xx < width; xx++)
                out[yy * width + xx] = this.getPixel(x + xx, y + yy);
        return out;
    }

    copyArea(src, gc, srcX, srcY, dstX, dstY, width, height) {
        // snapshot first: handles overlapping copies within the same raster
        const pixels = src.getPixels(srcX, srcY, width, height);
        this.putPixels(gc, dstX, dstY, width, height, pixels);
    }

    copyPlane(src, gc, srcX, srcY, dstX, dstY, width, height, bitPlane) {
        for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
                const bit = (src.getPixel(srcX + x, srcY + y) & bitPlane) ? 1 : 0;
                this.setPixel(gc, dstX + x, dstY + y, bit ? gc.foreground : gc.background);
            }
    }

    // text via the built-in 8x8 font; (x, y) is the baseline origin.
    // opaque = ImageText semantics (paint background cell first).
    // returns final x position
    drawText(gc, x, y, text, opaque) {
        // ImageText ignores the GC function: always copy
        if (opaque)
            gc = Object.assign({}, gc, { func: GX.copy });
        const top = y - font8x8.ASCENT;
        for (let i = 0; i < text.length; i++) {
            const glyph = font8x8.glyph(text.charCodeAt(i));
            for (let gy = 0; gy < font8x8.HEIGHT; gy++) {
                const rowBits = glyph.length ? glyph[gy] : 0;
                for (let gx = 0; gx < font8x8.WIDTH; gx++) {
                    const set = (rowBits >> gx) & 1;
                    if (set)
                        this.setPixel(gc, x + gx, top + gy, gc.foreground);
                    else if (opaque)
                        this.setPixel(gc, x + gx, top + gy, gc.background);
                }
            }
            x += font8x8.WIDTH;
        }
        return x;
    }
}

module.exports = { Raster, GX, combine };
