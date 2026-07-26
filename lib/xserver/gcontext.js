'use strict';

// Graphics contexts: CreateGC/ChangeGC/CopyGC/SetDashes/SetClipRectangles/
// FreeGC (opcodes 55-60) and the GC-state -> raster-gc mapping.

const { XError, codes } = require('./errors');
const { parseValueList } = require('./util');

const GC_VALUES = [
    { mask: 0x00000001, name: 'function', kind: 'C' },
    { mask: 0x00000002, name: 'planeMask', kind: 'L' },
    { mask: 0x00000004, name: 'foreground', kind: 'L' },
    { mask: 0x00000008, name: 'background', kind: 'L' },
    { mask: 0x00000010, name: 'lineWidth', kind: 'S' },
    { mask: 0x00000020, name: 'lineStyle', kind: 'C' },
    { mask: 0x00000040, name: 'capStyle', kind: 'C' },
    { mask: 0x00000080, name: 'joinStyle', kind: 'C' },
    { mask: 0x00000100, name: 'fillStyle', kind: 'C' },
    { mask: 0x00000200, name: 'fillRule', kind: 'C' },
    { mask: 0x00000400, name: 'tile', kind: 'L' },
    { mask: 0x00000800, name: 'stipple', kind: 'L' },
    { mask: 0x00001000, name: 'tileStippleXOrigin', kind: 's' },
    { mask: 0x00002000, name: 'tileStippleYOrigin', kind: 's' },
    { mask: 0x00004000, name: 'font', kind: 'L' },
    { mask: 0x00008000, name: 'subwindowMode', kind: 'C' },
    { mask: 0x00010000, name: 'graphicsExposures', kind: 'C' },
    { mask: 0x00020000, name: 'clipXOrigin', kind: 's' },
    { mask: 0x00040000, name: 'clipYOrigin', kind: 's' },
    { mask: 0x00080000, name: 'clipMask', kind: 'L' },
    { mask: 0x00100000, name: 'dashOffset', kind: 'S' },
    { mask: 0x00200000, name: 'dashes', kind: 'C' },
    { mask: 0x00400000, name: 'arcMode', kind: 'C' }
];

const GC_FIELDS = GC_VALUES.map(v => v.name);

function defaultValues() {
    return {
        function: 3,            // GXcopy
        planeMask: 0xffffffff,
        foreground: 0,
        background: 1,
        lineWidth: 0,
        lineStyle: 0,
        capStyle: 1,
        joinStyle: 0,
        fillStyle: 0,
        fillRule: 0,
        tile: 0,
        stipple: 0,
        tileStippleXOrigin: 0,
        tileStippleYOrigin: 0,
        font: 0,
        subwindowMode: 0,
        graphicsExposures: 1,
        clipXOrigin: 0,
        clipYOrigin: 0,
        clipMask: 0,
        dashOffset: 0,
        dashes: 4,
        arcMode: 1              // PieSlice
    };
}

class GContext {
    constructor(id, owner) {
        this.type = 'gc';
        this.id = id;
        this.owner = owner;
        this.values = defaultValues();
        this.clip = null;       // null or rect list (drawable coordinates)
        this.dashList = [4, 4];
    }

    // gc state object understood by Raster ops
    rasterGC() {
        const v = this.values;
        return {
            func: v.function,
            planeMask: v.planeMask,
            foreground: v.foreground,
            background: v.background,
            lineWidth: v.lineWidth,
            fillStyle: v.fillStyle,
            arcMode: v.arcMode,
            clip: this.clip
        };
    }
}

function applyValues(gc, bitmask, values) {
    for (const name of GC_FIELDS)
        if (values[name] !== undefined)
            gc.values[name] = values[name];
    if (bitmask & 0x00080000 && gc.values.clipMask === 0)
        gc.clip = null; // clip-mask None clears the clip list
}

function install(server) {
    const h = server.handlers;

    // CreateGC (55)
    h[55] = (client, detail, body) => {
        const cid = body.readUInt32LE(0);
        server.getDrawable(body.readUInt32LE(4));
        const bitmask = body.readUInt32LE(8);
        server.checkIdFree(client, cid);
        const gc = new GContext(cid, client);
        server.resources.set(cid, gc);
        applyValues(gc, bitmask, parseValueList(body, 12, bitmask, GC_VALUES));
    };

    // ChangeGC (56)
    h[56] = (client, detail, body) => {
        const gc = server.getGC(body.readUInt32LE(0));
        const bitmask = body.readUInt32LE(4);
        applyValues(gc, bitmask, parseValueList(body, 8, bitmask, GC_VALUES));
    };

    // CopyGC (57)
    h[57] = (client, detail, body) => {
        const src = server.getGC(body.readUInt32LE(0));
        const dst = server.getGC(body.readUInt32LE(4));
        const bitmask = body.readUInt32LE(8);
        for (const entry of GC_VALUES)
            if (bitmask & entry.mask)
                dst.values[entry.name] = src.values[entry.name];
        if (bitmask & 0x00080000)
            dst.clip = src.clip ? src.clip.map(r => ({ ...r })) : null;
    };

    // SetDashes (58)
    h[58] = (client, detail, body) => {
        const gc = server.getGC(body.readUInt32LE(0));
        gc.values.dashOffset = body.readUInt16LE(4);
        const n = body.readUInt16LE(6);
        if (n === 0)
            throw new XError(codes.Value, 0);
        gc.dashList = [];
        for (let i = 0; i < n; i++)
            gc.dashList.push(body.readUInt8(8 + i));
    };

    // SetClipRectangles (59)
    h[59] = (client, ordering, body) => {
        const gc = server.getGC(body.readUInt32LE(0));
        const clipX = body.readInt16LE(4);
        const clipY = body.readInt16LE(6);
        gc.values.clipXOrigin = clipX;
        gc.values.clipYOrigin = clipY;
        const rects = [];
        for (let off = 8; off + 8 <= body.length; off += 8)
            rects.push({
                x: body.readInt16LE(off) + clipX,
                y: body.readInt16LE(off + 2) + clipY,
                width: body.readUInt16LE(off + 4),
                height: body.readUInt16LE(off + 6)
            });
        gc.clip = rects; // empty list clips everything
    };

    // FreeGC (60)
    h[60] = (client, detail, body) => {
        const gc = server.getGC(body.readUInt32LE(0));
        server.resources.delete(gc.id);
    };
}

module.exports = { GContext, install };
