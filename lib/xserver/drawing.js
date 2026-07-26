'use strict';

// Pixmaps (53-54) and all drawing requests (61-77). Pixel work is delegated
// to Raster; this module packs/unpacks the ZPixmap/XYBitmap wire formats.

const { Raster } = require('./raster');
const { XError, codes } = require('./errors');
const { padLength } = require('./util');
const { builders, deliver } = require('./events');
const { eventMask } = require('../eventmask');

class Pixmap {
    constructor(id, depth, width, height, owner) {
        this.type = 'pixmap';
        this.id = id;
        this.depth = depth;
        this.raster = new Raster(width, height, depth);
        this.owner = owner;
    }
}

function readPoints(body, offset) {
    const points = [];
    for (let off = offset; off + 4 <= body.length; off += 4)
        points.push({ x: body.readInt16LE(off), y: body.readInt16LE(off + 2) });
    return points;
}

function readRects(body, offset) {
    const rects = [];
    for (let off = offset; off + 8 <= body.length; off += 8)
        rects.push({
            x: body.readInt16LE(off),
            y: body.readInt16LE(off + 2),
            width: body.readUInt16LE(off + 4),
            height: body.readUInt16LE(off + 6)
        });
    return rects;
}

function readArcs(body, offset) {
    const arcs = [];
    for (let off = offset; off + 12 <= body.length; off += 12)
        arcs.push({
            x: body.readInt16LE(off),
            y: body.readInt16LE(off + 2),
            width: body.readUInt16LE(off + 4),
            height: body.readUInt16LE(off + 6),
            angle1: body.readInt16LE(off + 8),
            angle2: body.readInt16LE(off + 10)
        });
    return arcs;
}

// scanline byte count for `bits` bits at scanline-pad 32
function padded32(bits) {
    return ((bits + 31) >> 5) << 2;
}

function install(server) {
    const h = server.handlers;

    // target = drawable + its raster; damage the screen when it's a window
    const target = xid => server.getDrawable(xid);
    const done = t => {
        if (t.type === 'window')
            server.damageWindow(t);
    };

    // CreatePixmap (53)
    h[53] = (client, depth, body) => {
        const pid = body.readUInt32LE(0);
        server.getDrawable(body.readUInt32LE(4));
        const width = body.readUInt16LE(8);
        const height = body.readUInt16LE(10);
        if (depth !== 1 && depth !== 24 && depth !== 32)
            throw new XError(codes.Value, depth);
        if (width === 0 || height === 0)
            throw new XError(codes.Value, 0);
        server.checkIdFree(client, pid);
        server.resources.set(pid, new Pixmap(pid, depth, width, height, client));
    };

    // FreePixmap (54)
    h[54] = (client, detail, body) => {
        const xid = body.readUInt32LE(0);
        const res = server.resources.get(xid);
        if (!res || res.type !== 'pixmap')
            throw new XError(codes.Pixmap, xid);
        server.resources.delete(xid);
    };

    // ClearArea (61)
    h[61] = (client, exposures, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const x = body.readInt16LE(4);
        const y = body.readInt16LE(6);
        let width = body.readUInt16LE(8);
        let height = body.readUInt16LE(10);
        if (width === 0)
            width = Math.max(0, win.width - x);
        if (height === 0)
            height = Math.max(0, win.height - y);
        win.raster.fillRect(null, x, y, width, height, win.backgroundPixel);
        if (exposures)
            deliver(win, eventMask.Exposure, builders.expose(win.id, x, y, width, height, 0));
        done(win);
    };

    // CopyArea (62)
    h[62] = (client, detail, body) => {
        const src = target(body.readUInt32LE(0));
        const dst = target(body.readUInt32LE(4));
        const gc = server.getGC(body.readUInt32LE(8));
        const srcX = body.readInt16LE(12);
        const srcY = body.readInt16LE(14);
        const dstX = body.readInt16LE(16);
        const dstY = body.readInt16LE(18);
        const width = body.readUInt16LE(20);
        const height = body.readUInt16LE(22);
        dst.raster.copyArea(src.raster, gc.rasterGC(), srcX, srcY, dstX, dstY, width, height);
        if (gc.values.graphicsExposures) {
            const oob = srcX < 0 || srcY < 0 ||
                srcX + width > src.raster.width || srcY + height > src.raster.height;
            client.sendEvent(oob
                ? builders.graphicsExposure(dst.id, dstX, dstY, width, height, 62, 0)
                : builders.noExposure(dst.id, 62));
        }
        done(dst);
    };

    // CopyPlane (63)
    h[63] = (client, detail, body) => {
        const src = target(body.readUInt32LE(0));
        const dst = target(body.readUInt32LE(4));
        const gc = server.getGC(body.readUInt32LE(8));
        const srcX = body.readInt16LE(12);
        const srcY = body.readInt16LE(14);
        const dstX = body.readInt16LE(16);
        const dstY = body.readInt16LE(18);
        const width = body.readUInt16LE(20);
        const height = body.readUInt16LE(22);
        const bitPlane = body.readUInt32LE(24);
        dst.raster.copyPlane(src.raster, gc.rasterGC(), srcX, srcY, dstX, dstY, width, height, bitPlane);
        if (gc.values.graphicsExposures)
            client.sendEvent(builders.noExposure(dst.id, 63));
        done(dst);
    };

    // PolyPoint (64)
    h[64] = (client, coordMode, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        t.raster.drawPoints(gc.rasterGC(), readPoints(body, 8), coordMode);
        done(t);
    };

    // PolyLine (65)
    h[65] = (client, coordMode, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        t.raster.drawLines(gc.rasterGC(), readPoints(body, 8), coordMode);
        done(t);
    };

    // PolySegment (66)
    h[66] = (client, detail, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        const segments = [];
        for (let off = 8; off + 8 <= body.length; off += 8)
            segments.push({
                x1: body.readInt16LE(off),
                y1: body.readInt16LE(off + 2),
                x2: body.readInt16LE(off + 4),
                y2: body.readInt16LE(off + 6)
            });
        t.raster.drawSegments(gc.rasterGC(), segments);
        done(t);
    };

    // PolyRectangle (67)
    h[67] = (client, detail, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        t.raster.drawRects(gc.rasterGC(), readRects(body, 8));
        done(t);
    };

    // PolyArc (68)
    h[68] = (client, detail, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        t.raster.drawArcs(gc.rasterGC(), readArcs(body, 8));
        done(t);
    };

    // FillPoly (69)
    h[69] = (client, detail, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        const shape = body.readUInt8(8);
        const coordMode = body.readUInt8(9);
        t.raster.fillPoly(gc.rasterGC(), readPoints(body, 12), shape, coordMode);
        done(t);
    };

    // PolyFillRectangle (70)
    h[70] = (client, detail, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        t.raster.fillRects(gc.rasterGC(), readRects(body, 8));
        done(t);
    };

    // PolyFillArc (71)
    h[71] = (client, detail, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        t.raster.fillArcs(gc.rasterGC(), readArcs(body, 8));
        done(t);
    };

    // PutImage (72)
    h[72] = (client, format, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        const width = body.readUInt16LE(8);
        const height = body.readUInt16LE(10);
        const dstX = body.readInt16LE(12);
        const dstY = body.readInt16LE(14);
        const leftPad = body.readUInt8(16);
        const depth = body.readUInt8(17);
        const data = body.subarray(20);
        const rgc = gc.rasterGC();

        if (format === 2) { // ZPixmap
            if (depth !== t.depth && !(t.depth === 24 && depth === 32))
                throw new XError(codes.Match, depth);
            if (depth === 1) {
                const rowBytes = padded32(width);
                if (data.length < rowBytes * height)
                    throw new XError(codes.Length, data.length);
                t.raster.putBitmap(rgc, dstX, dstY, width, height, rowBytes, data, true);
            } else {
                if (leftPad !== 0)
                    throw new XError(codes.Match, leftPad);
                const rowBytes = width * 4;
                if (data.length < rowBytes * height)
                    throw new XError(codes.Length, data.length);
                const pixels = new Uint32Array(width * height);
                for (let y = 0; y < height; y++)
                    for (let x = 0; x < width; x++)
                        pixels[y * width + x] = data.readUInt32LE(y * rowBytes + x * 4) & 0xffffff;
                t.raster.putPixels(rgc, dstX, dstY, width, height, pixels);
            }
        } else if (format === 0 || (format === 1 && depth === 1)) {
            // XYBitmap (and single-plane XYPixmap): bit -> fg/bg
            if (format === 0 && depth !== 1)
                throw new XError(codes.Match, depth);
            const rowBytes = padded32(width + leftPad);
            if (data.length < rowBytes * height)
                throw new XError(codes.Length, data.length);
            if (leftPad === 0) {
                t.raster.putBitmap(rgc, dstX, dstY, width, height, rowBytes, data, true);
            } else {
                for (let y = 0; y < height; y++)
                    for (let x = 0; x < width; x++) {
                        const bit = x + leftPad;
                        const set = (data[y * rowBytes + (bit >> 3)] >> (bit & 7)) & 1;
                        t.raster.setPixel(rgc, dstX + x, dstY + y,
                            set ? rgc.foreground : rgc.background);
                    }
            }
        } else {
            throw new XError(codes.Implementation, format);
        }
        done(t);
    };

    // GetImage (73)
    h[73] = (client, format, body) => {
        if (format !== 2)
            throw new XError(codes.Value, format);
        const t = target(body.readUInt32LE(0));
        const x = body.readInt16LE(4);
        const y = body.readInt16LE(6);
        const width = body.readUInt16LE(8);
        const height = body.readUInt16LE(10);
        const planeMask = body.readUInt32LE(12);
        const pixels = t.raster.getPixels(x, y, width, height);
        let data;
        if (t.depth === 1) {
            const rowBytes = padded32(width);
            data = Buffer.alloc(rowBytes * height);
            for (let yy = 0; yy < height; yy++)
                for (let xx = 0; xx < width; xx++)
                    if (pixels[yy * width + xx] & planeMask & 1)
                        data[yy * rowBytes + (xx >> 3)] |= 1 << (xx & 7);
        } else {
            data = Buffer.alloc(width * height * 4);
            for (let i = 0; i < pixels.length; i++)
                data.writeUInt32LE((pixels[i] & planeMask) >>> 0, i * 4);
        }
        const b = client.startReply(padLength(data.length) / 4, t.depth);
        b.writeUInt32LE(t.type === 'window' ? server.rootVisual >>> 0 : 0, 8);
        data.copy(b, 32);
        client.send(b);
    };

    // PolyText8 (74) / PolyText16 (75)
    const polyText = wide => (client, detail, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        let x = body.readInt16LE(8);
        const y = body.readInt16LE(10);
        const rgc = gc.rasterGC();
        let off = 12;
        while (off + 2 <= body.length) {
            const len = body.readUInt8(off);
            if (len === 255) {
                // font-shift item: 4 font bytes follow; font changes ignored
                off += 5;
                continue;
            }
            const delta = body.readInt8(off + 1);
            if (len === 0 && delta === 0)
                break; // padding
            off += 2;
            x += delta;
            let text = '';
            if (wide) {
                for (let i = 0; i < len; i++)
                    text += String.fromCharCode((body[off + i * 2] << 8) | body[off + i * 2 + 1]);
                off += len * 2;
            } else {
                text = body.toString('latin1', off, off + len);
                off += len;
            }
            x = t.raster.drawText(rgc, x, y, text, false);
        }
        done(t);
    };
    h[74] = polyText(false);
    h[75] = polyText(true);

    // ImageText8 (76) / ImageText16 (77)
    h[76] = (client, len, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        const x = body.readInt16LE(8);
        const y = body.readInt16LE(10);
        const text = body.toString('latin1', 12, 12 + len);
        t.raster.drawText(gc.rasterGC(), x, y, text, true);
        done(t);
    };
    h[77] = (client, len, body) => {
        const t = target(body.readUInt32LE(0));
        const gc = server.getGC(body.readUInt32LE(4));
        const x = body.readInt16LE(8);
        const y = body.readInt16LE(10);
        let text = '';
        for (let i = 0; i < len; i++)
            text += String.fromCharCode((body[12 + i * 2] << 8) | body[12 + i * 2 + 1]);
        t.raster.drawText(gc.rasterGC(), x, y, text, true);
        done(t);
    };
}

module.exports = { Pixmap, install };
