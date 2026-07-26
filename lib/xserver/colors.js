'use strict';

// Colormaps and colors (opcodes 78-92) for the static TrueColor visual.

const { XError, codes } = require('./errors');

// X rgb.txt values, lowercased, spaces removed
const NAMED_COLORS = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    cyan: [0, 255, 255],
    magenta: [255, 0, 255],
    gray: [190, 190, 190],
    grey: [190, 190, 190],
    darkgray: [169, 169, 169],
    darkgrey: [169, 169, 169],
    lightgray: [211, 211, 211],
    lightgrey: [211, 211, 211],
    darkred: [139, 0, 0],
    darkgreen: [0, 100, 0],
    darkblue: [0, 0, 139],
    darkcyan: [0, 139, 139],
    darkmagenta: [139, 0, 139],
    lightblue: [173, 216, 230],
    lightgreen: [144, 238, 144],
    lightyellow: [255, 255, 224],
    lightcyan: [224, 255, 255],
    lightpink: [255, 182, 193],
    steelblue: [70, 130, 180],
    midnightblue: [25, 25, 112],
    navy: [0, 0, 128],
    orange: [255, 165, 0],
    purple: [160, 32, 240],
    brown: [165, 42, 42],
    pink: [255, 192, 203]
};

function lookupNamed(name) {
    return NAMED_COLORS[name.toLowerCase().replace(/\s+/g, '')];
}

class Colormap {
    constructor(id, visual, owner) {
        this.type = 'colormap';
        this.id = id;
        this.visual = visual;
        this.owner = owner;
    }
}

function checkColormap(server, xid) {
    const res = server.resources.get(xid);
    if (!res || res.type !== 'colormap')
        throw new XError(codes.Colormap, xid);
    return res;
}

function install(server) {
    const h = server.handlers;

    // CreateColormap (78)
    h[78] = (client, alloc, body) => {
        const mid = body.readUInt32LE(0);
        server.getWindow(body.readUInt32LE(4));
        const visual = body.readUInt32LE(8);
        server.checkIdFree(client, mid);
        server.resources.set(mid, new Colormap(mid, visual, client));
    };

    // FreeColormap (79)
    h[79] = (client, detail, body) => {
        const xid = body.readUInt32LE(0);
        if (xid === server.rootColormap)
            return; // freeing the default colormap is ignored
        checkColormap(server, xid);
        server.resources.delete(xid);
    };

    // CopyColormapAndFree (80)
    h[80] = (client, detail, body) => {
        const mid = body.readUInt32LE(0);
        const src = checkColormap(server, body.readUInt32LE(4));
        server.checkIdFree(client, mid);
        server.resources.set(mid, new Colormap(mid, src.visual, client));
        if (src.id !== server.rootColormap)
            server.resources.delete(src.id);
    };

    // InstallColormap (81) / UninstallColormap (82): static visual, accepted
    h[81] = (client, detail, body) => { checkColormap(server, body.readUInt32LE(0)); };
    h[82] = (client, detail, body) => { checkColormap(server, body.readUInt32LE(0)); };

    // ListInstalledColormaps (83)
    h[83] = (client, detail, body) => {
        server.getWindow(body.readUInt32LE(0));
        const b = client.startReply(1, 0);
        b.writeUInt16LE(1, 8);
        b.writeUInt32LE(server.rootColormap >>> 0, 32);
        client.send(b);
    };

    // AllocColor (84)
    h[84] = (client, detail, body) => {
        checkColormap(server, body.readUInt32LE(0));
        const red = body.readUInt16LE(4);
        const green = body.readUInt16LE(6);
        const blue = body.readUInt16LE(8);
        const r = red >> 8, g = green >> 8, bl = blue >> 8;
        const b = client.startReply(0, 0);
        b.writeUInt16LE(r * 257, 8);
        b.writeUInt16LE(g * 257, 10);
        b.writeUInt16LE(bl * 257, 12);
        b.writeUInt32LE(((r << 16) | (g << 8) | bl) >>> 0, 16);
        client.send(b);
    };

    // AllocNamedColor (85)
    h[85] = (client, detail, body) => {
        checkColormap(server, body.readUInt32LE(0));
        const nameLen = body.readUInt16LE(4);
        const name = body.toString('latin1', 8, 8 + nameLen);
        const rgb = lookupNamed(name);
        if (!rgb)
            throw new XError(codes.Name, 0);
        const b = client.startReply(0, 0);
        b.writeUInt32LE(((rgb[0] << 16) | (rgb[1] << 8) | rgb[2]) >>> 0, 8);
        b.writeUInt16LE(rgb[0] * 257, 12);   // exact
        b.writeUInt16LE(rgb[1] * 257, 14);
        b.writeUInt16LE(rgb[2] * 257, 16);
        b.writeUInt16LE(rgb[0] * 257, 18);   // visual
        b.writeUInt16LE(rgb[1] * 257, 20);
        b.writeUInt16LE(rgb[2] * 257, 22);
        client.send(b);
    };

    // AllocColorCells (86) / AllocColorPlanes (87): TrueColor is static
    h[86] = (client, detail, body) => {
        throw new XError(codes.Alloc, body.readUInt32LE(0));
    };
    h[87] = (client, detail, body) => {
        throw new XError(codes.Alloc, body.readUInt32LE(0));
    };

    // FreeColors (88): nothing was allocated
    h[88] = (client, detail, body) => { checkColormap(server, body.readUInt32LE(0)); };

    // StoreColors (89) / StoreNamedColor (90): read-only visual
    h[89] = (client, detail, body) => {
        throw new XError(codes.Access, body.readUInt32LE(0));
    };
    h[90] = (client, detail, body) => {
        throw new XError(codes.Access, body.readUInt32LE(0));
    };

    // QueryColors (91)
    h[91] = (client, detail, body) => {
        checkColormap(server, body.readUInt32LE(0));
        const n = (body.length - 4) >> 2;
        const b = client.startReply(2 * n, 0);
        b.writeUInt16LE(n, 8);
        for (let i = 0; i < n; i++) {
            const pixel = body.readUInt32LE(4 + i * 4);
            const off = 32 + i * 8;
            b.writeUInt16LE(((pixel >> 16) & 0xff) * 257, off);
            b.writeUInt16LE(((pixel >> 8) & 0xff) * 257, off + 2);
            b.writeUInt16LE((pixel & 0xff) * 257, off + 4);
        }
        client.send(b);
    };

    // LookupColor (92)
    h[92] = (client, detail, body) => {
        checkColormap(server, body.readUInt32LE(0));
        const nameLen = body.readUInt16LE(4);
        const name = body.toString('latin1', 8, 8 + nameLen);
        const rgb = lookupNamed(name);
        if (!rgb)
            throw new XError(codes.Name, 0);
        const b = client.startReply(0, 0);
        b.writeUInt16LE(rgb[0] * 257, 8);    // exact
        b.writeUInt16LE(rgb[1] * 257, 10);
        b.writeUInt16LE(rgb[2] * 257, 12);
        b.writeUInt16LE(rgb[0] * 257, 14);   // visual
        b.writeUInt16LE(rgb[1] * 257, 16);
        b.writeUInt16LE(rgb[2] * 257, 18);
        client.send(b);
    };
}

module.exports = { Colormap, NAMED_COLORS, install };
