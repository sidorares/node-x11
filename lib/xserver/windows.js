'use strict';

// Window tree: the Window resource type plus the window lifecycle requests
// (opcodes 1-15) and their notify events.

const { Raster } = require('./raster');
const { XError, codes } = require('./errors');
const { parseValueList } = require('./util');
const { builders, deliver, structureNotify } = require('./events');
const { eventMask } = require('../eventmask');

const WINDOW_VALUES = [
    { mask: 0x00000001, name: 'backgroundPixmap', kind: 'L' },
    { mask: 0x00000002, name: 'backgroundPixel', kind: 'L' },
    { mask: 0x00000004, name: 'borderPixmap', kind: 'L' },
    { mask: 0x00000008, name: 'borderPixel', kind: 'L' },
    { mask: 0x00000010, name: 'bitGravity', kind: 'C' },
    { mask: 0x00000020, name: 'winGravity', kind: 'C' },
    { mask: 0x00000040, name: 'backingStore', kind: 'C' },
    { mask: 0x00000080, name: 'backingPlanes', kind: 'L' },
    { mask: 0x00000100, name: 'backingPixel', kind: 'L' },
    { mask: 0x00000200, name: 'overrideRedirect', kind: 'C' },
    { mask: 0x00000400, name: 'saveUnder', kind: 'C' },
    { mask: 0x00000800, name: 'eventMask', kind: 'L' },
    { mask: 0x00001000, name: 'doNotPropagateMask', kind: 'L' },
    { mask: 0x00002000, name: 'colormap', kind: 'L' },
    { mask: 0x00004000, name: 'cursor', kind: 'L' }
];

const CONFIGURE_VALUES = [
    { mask: 0x0001, name: 'x', kind: 's' },
    { mask: 0x0002, name: 'y', kind: 's' },
    { mask: 0x0004, name: 'width', kind: 'S' },
    { mask: 0x0008, name: 'height', kind: 'S' },
    { mask: 0x0010, name: 'borderWidth', kind: 'S' },
    { mask: 0x0020, name: 'sibling', kind: 'L' },
    { mask: 0x0040, name: 'stackMode', kind: 'C' }
];

class Window {
    constructor(server, id, parent, x, y, width, height, borderWidth, klass, owner) {
        this.type = 'window';
        this.server = server;
        this.id = id;
        this.parent = parent;              // Window or null (root)
        this.children = [];                // bottom-to-top stacking order
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.borderWidth = borderWidth;
        this.class = klass || 1;           // InputOutput
        this.depth = 24;
        this.visual = server.rootVisual;
        this.owner = owner || null;
        this.mapped = false;
        this.overrideRedirect = false;
        this.backgroundPixel = 0;
        this.borderPixel = 0;
        this.bitGravity = 0;
        this.winGravity = 1;
        this.backingStore = 0;
        this.doNotPropagateMask = 0;
        this.colormap = server.rootColormap;
        this.cursor = 0;
        this.eventMasks = new Map();       // client -> event mask
        this.properties = new Map();       // atom id -> { type, format, data }
        this.buttonGrabs = [];
        this.keyGrabs = [];
        this.raster = new Raster(width, height, 24);
        if (this.backgroundPixel)
            this.raster.data.fill(this.backgroundPixel);
    }

    absX() {
        let x = 0;
        for (let w = this; w; w = w.parent)
            x += w.x;
        return x;
    }

    absY() {
        let y = 0;
        for (let w = this; w; w = w.parent)
            y += w.y;
        return y;
    }

    isViewable() {
        for (let w = this; w.parent; w = w.parent)
            if (!w.mapped)
                return false;
        return true;
    }

    allEventMask() {
        let mask = 0;
        for (const m of this.eventMasks.values())
            mask |= m;
        return mask;
    }

    isDescendantOf(other) {
        for (let w = this.parent; w; w = w.parent)
            if (w === other)
                return true;
        return false;
    }
}

// Masks only one client at a time may hold on a window (X11 spec, "Event
// Masks"): a second selector gets BadAccess. This is what makes "another
// window manager is already running" detectable — claiming the role is a
// SubstructureRedirect selection on the root that either takes or fails.
const EXCLUSIVE_MASKS = eventMask.SubstructureRedirect | eventMask.ResizeRedirect;

// The client that redirects `win`'s substructure requests, if it is not the
// one asking. Requests on an override-redirect window are never redirected.
function redirectTo(win, client) {
    if (!win || win.overrideRedirect || !win.parent)
        return null;
    for (const [other, mask] of win.parent.eventMasks)
        if (other !== client && mask & eventMask.SubstructureRedirect)
            return other;
    return null;
}

function applyAttributes(server, client, win, bitmask, values) {
    if (values.backgroundPixel !== undefined)
        win.backgroundPixel = values.backgroundPixel & 0xffffff;
    if (values.borderPixel !== undefined)
        win.borderPixel = values.borderPixel & 0xffffff;
    if (values.bitGravity !== undefined)
        win.bitGravity = values.bitGravity;
    if (values.winGravity !== undefined)
        win.winGravity = values.winGravity;
    if (values.backingStore !== undefined)
        win.backingStore = values.backingStore;
    if (values.overrideRedirect !== undefined)
        win.overrideRedirect = !!values.overrideRedirect;
    if (values.eventMask !== undefined) {
        const wanted = values.eventMask & EXCLUSIVE_MASKS;
        if (wanted)
            for (const [other, mask] of win.eventMasks)
                if (other !== client && mask & wanted)
                    throw new XError(codes.Access, 0);
        if (values.eventMask === 0)
            win.eventMasks.delete(client);
        else
            win.eventMasks.set(client, values.eventMask);
    }
    if (values.doNotPropagateMask !== undefined)
        win.doNotPropagateMask = values.doNotPropagateMask;
    if (values.colormap !== undefined) {
        win.colormap = values.colormap;
        deliver(win, eventMask.ColormapChange,
            builders.colormapNotify(win.id, values.colormap, 1, 1));
    }
    if (values.cursor !== undefined)
        win.cursor = values.cursor;
}

// Recursive destroy with DestroyNotify delivery, resource/focus cleanup.
function destroyWindow(server, win) {
    if (!win.parent)
        return; // never destroy the root
    for (let i = win.children.length - 1; i >= 0; i--)
        destroyWindow(server, win.children[i]);
    if (win.mapped)
        win.mapped = false;
    structureNotify(win, wid => builders.destroyNotify(wid, win.id));
    const idx = win.parent.children.indexOf(win);
    if (idx !== -1)
        win.parent.children.splice(idx, 1);
    server.resources.delete(win.id);
    if (server.focus.wid === win.id)
        server.focus = { wid: 1, revertTo: 1 }; // revert to PointerRoot
    if (server.grabs.pointer && server.grabs.pointer.wid === win.id)
        server.grabs.pointer = null;
    if (server.grabs.keyboard && server.grabs.keyboard.wid === win.id)
        server.grabs.keyboard = null;
    for (const [sel, ownerInfo] of server.selections)
        if (ownerInfo.wid === win.id)
            server.selections.delete(sel);
    if (server.pointer.window === win)
        server.pointer.window = null; // recomputed on next use
    server.damageWindow(win);
}

function sendExpose(win, x, y, width, height, count) {
    deliver(win, eventMask.Exposure,
        builders.expose(win.id, x, y, width, height, count || 0));
}

function mapWindow(server, win) {
    if (win.mapped || !win.parent)
        return;
    win.mapped = true;
    structureNotify(win, wid => builders.mapNotify(wid, win.id, win.overrideRedirect));
    if (win.isViewable()) {
        deliver(win, eventMask.VisibilityChange, builders.visibilityNotify(win.id, 0));
        sendExpose(win, 0, 0, win.width, win.height, 0);
    }
    server.damageWindow(win);
}

function unmapWindow(server, win, fromConfigure) {
    if (!win.mapped || !win.parent)
        return;
    win.mapped = false;
    structureNotify(win, wid => builders.unmapNotify(wid, win.id, fromConfigure));
    server.damageWindow(win);
}

function resizeWindow(server, win, width, height) {
    const old = win.raster;
    const oldW = win.width, oldH = win.height;
    win.width = width;
    win.height = height;
    win.raster = new Raster(width, height, 24);
    if (win.backgroundPixel)
        win.raster.data.fill(win.backgroundPixel);
    const copyW = Math.min(oldW, width);
    const copyH = Math.min(oldH, height);
    for (let y = 0; y < copyH; y++)
        for (let x = 0; x < copyW; x++)
            win.raster.data[y * width + x] = old.data[y * oldW + x];
    // newly revealed strips (grow only), exposed after ConfigureNotify
    const rects = [];
    if (win.mapped && win.isViewable()) {
        if (width > oldW)
            rects.push({ x: oldW, y: 0, width: width - oldW, height });
        if (height > oldH)
            rects.push({ x: 0, y: oldH, width: Math.min(oldW, width), height: height - oldH });
    }
    return rects;
}

function restack(win, stackMode, siblingId) {
    const siblings = win.parent.children;
    let sibling = null;
    if (siblingId) {
        sibling = siblings.find(w => w.id === siblingId);
        if (!sibling)
            throw new XError(codes.Match, siblingId);
    }
    const idx = siblings.indexOf(win);
    const wasTop = idx === siblings.length - 1;
    siblings.splice(idx, 1);
    switch (stackMode) {
        case 0: // Above
            if (sibling)
                siblings.splice(siblings.indexOf(sibling) + 1, 0, win);
            else
                siblings.push(win);
            break;
        case 1: // Below
            if (sibling)
                siblings.splice(siblings.indexOf(sibling), 0, win);
            else
                siblings.unshift(win);
            break;
        case 2: // TopIf
            siblings.push(win);
            break;
        case 3: // BottomIf
            siblings.unshift(win);
            break;
        case 4: // Opposite
            if (wasTop)
                siblings.unshift(win);
            else
                siblings.push(win);
            break;
        default:
            siblings.push(win);
    }
}

function install(server) {
    const h = server.handlers;

    // CreateWindow (1)
    h[1] = (client, depth, body) => {
        const wid = body.readUInt32LE(0);
        const parent = server.getWindow(body.readUInt32LE(4));
        const x = body.readInt16LE(8);
        const y = body.readInt16LE(10);
        const width = body.readUInt16LE(12);
        const height = body.readUInt16LE(14);
        const borderWidth = body.readUInt16LE(16);
        let klass = body.readUInt16LE(18);
        const bitmask = body.readUInt32LE(24);
        if (width === 0 || height === 0)
            throw new XError(codes.Value, width === 0 ? width : height);
        if (klass > 2)
            throw new XError(codes.Value, klass);
        if (klass === 0)
            klass = parent.parent ? parent.class : 1; // CopyFromParent
        server.checkIdFree(client, wid);
        const values = parseValueList(body, 28, bitmask, WINDOW_VALUES);
        const win = new Window(server, wid, parent, x, y, width, height, borderWidth, klass, client);
        server.resources.set(wid, win);
        applyAttributes(server, client, win, bitmask, values);
        if (win.backgroundPixel)
            win.raster.data.fill(win.backgroundPixel);
        parent.children.push(win);
        deliver(parent, eventMask.SubstructureNotify, builders.createNotify(parent.id, win));
    };

    // ChangeWindowAttributes (2)
    h[2] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const bitmask = body.readUInt32LE(4);
        const values = parseValueList(body, 8, bitmask, WINDOW_VALUES);
        applyAttributes(server, client, win, bitmask, values);
    };

    // GetWindowAttributes (3)
    h[3] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const b = client.startReply(3, win.backingStore);
        b.writeUInt32LE(win.visual >>> 0, 8);
        b.writeUInt16LE(win.class, 12);
        b[14] = win.bitGravity;
        b[15] = win.winGravity;
        b.writeUInt32LE(0xffffffff, 16);           // backing planes
        b.writeUInt32LE(0, 20);                    // backing pixel
        b[24] = 0;                                 // save under
        b[25] = 1;                                 // map is installed
        b[26] = win.mapped ? (win.isViewable() ? 2 : 1) : 0;
        b[27] = win.overrideRedirect ? 1 : 0;
        b.writeUInt32LE(win.colormap >>> 0, 28);
        b.writeUInt32LE(win.allEventMask() >>> 0, 32);
        b.writeUInt32LE((win.eventMasks.get(client) || 0) >>> 0, 36);
        b.writeUInt16LE(win.doNotPropagateMask & 0xffff, 40);
        client.send(b);
    };

    // DestroyWindow (4)
    h[4] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        destroyWindow(server, win);
    };

    // DestroySubwindows (5)
    h[5] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        for (let i = win.children.length - 1; i >= 0; i--)
            destroyWindow(server, win.children[i]);
    };

    // ChangeSaveSet (6): accepted, not tracked
    h[6] = () => {};

    // ReparentWindow (7)
    h[7] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const newParent = server.getWindow(body.readUInt32LE(4));
        const x = body.readInt16LE(8);
        const y = body.readInt16LE(10);
        if (!win.parent || newParent === win || newParent.isDescendantOf(win))
            throw new XError(codes.Match, newParent.id);
        const wasMapped = win.mapped;
        if (wasMapped)
            unmapWindow(server, win, false);
        const oldParent = win.parent;
        const idx = oldParent.children.indexOf(win);
        if (idx !== -1)
            oldParent.children.splice(idx, 1);
        win.parent = newParent;
        win.x = x;
        win.y = y;
        newParent.children.push(win);
        const build = wid => builders.reparentNotify(wid, win.id, newParent.id, x, y, win.overrideRedirect);
        deliver(win, eventMask.StructureNotify, build(win.id));
        deliver(oldParent, eventMask.SubstructureNotify, build(oldParent.id));
        if (newParent !== oldParent)
            deliver(newParent, eventMask.SubstructureNotify, build(newParent.id));
        if (wasMapped)
            mapWindow(server, win);
    };

    // MapWindow (8). An already-mapped window is a no-op and is never
    // redirected — only a state change reaches the window manager.
    h[8] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        if (win.mapped || !win.parent)
            return;
        const wm = redirectTo(win, client);
        if (wm)
            return wm.sendEvent(builders.mapRequest(win.parent.id, win.id));
        mapWindow(server, win);
    };

    // MapSubwindows (9)
    h[9] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        for (const child of win.children.slice()) {
            if (child.mapped)
                continue;
            const wm = redirectTo(child, client);
            if (wm)
                wm.sendEvent(builders.mapRequest(win.id, child.id));
            else
                mapWindow(server, child);
        }
    };

    // UnmapWindow (10)
    h[10] = (client, detail, body) => {
        unmapWindow(server, server.getWindow(body.readUInt32LE(0)), false);
    };

    // UnmapSubwindows (11)
    h[11] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        for (const child of win.children.slice())
            unmapWindow(server, child, false);
    };

    // ConfigureWindow (12)
    h[12] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const bitmask = body.readUInt16LE(4);
        const values = parseValueList(body, 8, bitmask, CONFIGURE_VALUES);
        if (!win.parent)
            return; // root is not configurable here
        if ((values.width !== undefined && values.width === 0) ||
            (values.height !== undefined && values.height === 0))
            throw new XError(codes.Value, 0);
        const wm = redirectTo(win, client);
        if (wm)
            return wm.sendEvent(
                builders.configureRequest(win.parent.id, win, values, bitmask));
        if (values.x !== undefined)
            win.x = values.x;
        if (values.y !== undefined)
            win.y = values.y;
        if (values.borderWidth !== undefined)
            win.borderWidth = values.borderWidth;
        const newW = values.width !== undefined ? values.width : win.width;
        const newH = values.height !== undefined ? values.height : win.height;
        let exposeRects = [];
        if (newW !== win.width || newH !== win.height)
            exposeRects = resizeWindow(server, win, newW, newH);
        if (values.stackMode !== undefined)
            restack(win, values.stackMode, values.sibling);
        const siblings = win.parent.children;
        const idx = siblings.indexOf(win);
        const above = idx > 0 ? siblings[idx - 1].id : 0;
        structureNotify(win, wid => builders.configureNotify(wid, win, above));
        for (let i = 0; i < exposeRects.length; i++) {
            const r = exposeRects[i];
            sendExpose(win, r.x, r.y, r.width, r.height, exposeRects.length - 1 - i);
        }
        server.damageWindow(win);
    };

    // CirculateWindow (13)
    h[13] = (client, direction, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        if (win.children.length === 0)
            return;
        const lowest = direction === 0;
        const target = lowest ? win.children[0] : win.children[win.children.length - 1];
        const place = lowest ? 0 : 1;   // Top : Bottom
        const wm = redirectTo(target, client);
        if (wm)
            return wm.sendEvent(builders.circulateRequest(win.id, target.id, place));
        let child;
        if (lowest) {                   // RaiseLowest
            child = win.children.shift();
            win.children.push(child);
        } else {                        // LowerHighest
            child = win.children.pop();
            win.children.unshift(child);
        }
        deliver(win, eventMask.SubstructureNotify, builders.circulateNotify(win.id, child.id, place));
        deliver(child, eventMask.StructureNotify, builders.circulateNotify(child.id, child.id, place));
        server.damageWindow(win);
    };

    // GetGeometry (14)
    h[14] = (client, detail, body) => {
        const target = server.getDrawable(body.readUInt32LE(0));
        const b = client.startReply(0, target.depth);
        b.writeUInt32LE(server.root.id >>> 0, 8);
        if (target.type === 'window') {
            b.writeInt16LE(target.x, 12);
            b.writeInt16LE(target.y, 14);
            b.writeUInt16LE(target.width, 16);
            b.writeUInt16LE(target.height, 18);
            b.writeUInt16LE(target.borderWidth, 20);
        } else {
            b.writeUInt16LE(target.raster.width, 16);
            b.writeUInt16LE(target.raster.height, 18);
        }
        client.send(b);
    };

    // QueryTree (15)
    h[15] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const n = win.children.length;
        const b = client.startReply(n, 0);
        b.writeUInt32LE(server.root.id >>> 0, 8);
        b.writeUInt32LE(win.parent ? win.parent.id >>> 0 : 0, 12);
        b.writeUInt16LE(n, 16);
        for (let i = 0; i < n; i++)
            b.writeUInt32LE(win.children[i].id >>> 0, 32 + i * 4);
        client.send(b);
    };
}

module.exports = { Window, install, destroyWindow, mapWindow, unmapWindow, sendExpose };
