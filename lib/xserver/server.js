'use strict';

// Pure-JS X server core: connection setup, request framing/dispatch,
// resources, screen composition. See DESIGN.md in this directory.

const { EventEmitter } = require('events');
const FrameBuffer = require('../framebuffer');
const stdatoms = require('../stdatoms');
const { XError, codes } = require('./errors');
const { padLength } = require('./util');
const windows = require('./windows');
const keymap = require('./keymap');

const VENDOR = 'node-x11 js server';
const ROOT_WID = 0x123;
const ROOT_COLORMAP = 0x21;
const ROOT_VISUAL = 0x22;
const RESOURCE_MASK = 0x1fffff;
const FIRST_CLIENT_BASE = 0x200000;

class ServerClient {
    constructor(server, stream) {
        this.server = server;
        this.stream = stream;
        this.fb = new FrameBuffer();
        this.fb.attach(stream);
        this.seq = 0;
        this.alive = true;
        this.ready = false; // connection setup finished
        this.destroyed = false;
        this.resourceBase = server.allocResourceBase();
        this.resourceMask = RESOURCE_MASK;
        this.bigRequestsEnabled = false;
        stream.on('data', data => this.fb.write(data));
        stream.on('end', () => this.destroy());
        stream.on('error', () => this.destroy());
        stream.on('close', () => this.destroy());
        server.clients.add(this);
        this.readSetup();
    }

    send(buf) {
        if (!this.alive)
            return;
        this.fb.put(buf);
        this.fb.flush();
    }

    // 32 + extraWords*4 byte reply buffer with type/detail/sequence/length
    // filled in; the handler writes the payload at offsets 8+ and send()s it.
    startReply(extraWords, detail) {
        const b = Buffer.alloc(32 + extraWords * 4);
        b[0] = 1;
        b[1] = detail & 0xff;
        b.writeUInt16LE(this.seq, 2);
        b.writeUInt32LE(extraWords >>> 0, 4);
        return b;
    }

    sendError(code, badValue, major, minor) {
        const b = Buffer.alloc(32);
        b[0] = 0;
        b[1] = code;
        b.writeUInt16LE(this.seq, 2);
        b.writeUInt32LE(badValue >>> 0, 4);
        b.writeUInt16LE(minor & 0xffff, 8);
        b[10] = major;
        this.send(b);
    }

    sendEvent(buf) {
        if (!this.alive || !this.ready)
            return;
        const copy = Buffer.from(buf);
        // KeymapNotify (11) carries key data where other events keep the
        // sequence number
        if ((copy[0] & 0x7f) !== 11)
            copy.writeUInt16LE(this.seq, 2);
        this.send(copy);
    }

    readSetup() {
        this.fb.get(12, hdr => {
            const byteOrder = hdr.readUInt8(0);
            const authNameLen = hdr.readUInt16LE(6);
            const authDataLen = hdr.readUInt16LE(8);
            this.fb.get(padLength(authNameLen) + padLength(authDataLen), () => {
                if (byteOrder !== 0x6c) { // 'l': little-endian clients only
                    this.send(buildSetupFailed('only little-endian (LSB first) clients are supported'));
                    this.destroy();
                    return;
                }
                this.send(this.server.buildSetup(this));
                this.ready = true;
                this.server.emit('clientConnect', this);
                this.readRequest();
            });
        });
    }

    readRequest() {
        if (!this.alive)
            return;
        this.fb.get(4, hdr => {
            const opcode = hdr.readUInt8(0);
            const detail = hdr.readUInt8(1);
            const shortLen = hdr.readUInt16LE(2);
            const proceed = bodyLen => {
                this.fb.get(Math.max(0, bodyLen), body => {
                    this.handleRequest(opcode, detail, body);
                    this.readRequest();
                });
            };
            if (shortLen === 0)
                // BIG-REQUESTS extended form: real length in the next 4 bytes
                // (counts the whole request incl. header + length word)
                this.fb.get(4, ext => proceed(ext.readUInt32LE(0) * 4 - 8));
            else
                proceed(shortLen * 4 - 4);
        });
    }

    handleRequest(opcode, detail, body) {
        if (!this.alive)
            return;
        this.seq = (this.seq + 1) & 0xffff;
        const server = this.server;
        let handler = null;
        let minorForError = 0;
        if (opcode >= 128) {
            const ext = server.extByOpcode.get(opcode);
            if (ext)
                handler = (client, d, b) => ext.handleRequest(client, d, b);
            minorForError = detail;
        } else {
            handler = server.handlers[opcode];
        }
        if (!handler) {
            this.sendError(codes.Implementation, 0, opcode, minorForError);
            return;
        }
        try {
            handler(this, detail, body);
        } catch (err) {
            if (err && err.isXError) {
                this.sendError(err.code, err.badValue, opcode, err.minor || minorForError);
            } else {
                this.sendError(codes.Implementation, 0, opcode, minorForError);
                server.emit('handlerError', err, { opcode, client: this });
            }
        }
    }

    destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.alive = false;
        this.server.freeClientResources(this);
        this.server.clients.delete(this);
        if (typeof this.stream.end === 'function') {
            try {
                this.stream.end();
            } catch {
                // stream already gone
            }
        }
        this.server.emit('clientDisconnect', this);
    }
}

function buildSetupFailed(reason) {
    const padded = padLength(reason.length);
    const b = Buffer.alloc(8 + padded);
    b[0] = 0;
    b[1] = reason.length;
    b.writeUInt16LE(11, 2);
    b.writeUInt16LE(0, 4);
    b.writeUInt16LE(padded / 4, 6);
    b.write(reason, 8, 'latin1');
    return b;
}

class XServer extends EventEmitter {
    constructor(options) {
        super();
        options = options || {};
        this.width = options.width || 800;
        this.height = options.height || 600;

        this.clients = new Set();
        this.resources = new Map();
        this.handlers = new Array(128);
        this.extensions = new Map();     // name -> ext record
        this.extByOpcode = new Map();
        this._nextExtOpcode = 128;
        this._nextExtEvent = 64;
        this._nextExtError = 128;
        this._nextClientBase = FIRST_CLIENT_BASE;
        this._time = 0x1000;

        // atoms: predefined 1-68 preloaded (matches lib/stdatoms.js)
        this.atomsByName = new Map();
        this.atomsById = new Map();
        this.nextAtomId = 1;
        for (const name of Object.keys(stdatoms)) {
            const id = stdatoms[name];
            this.atomsByName.set(name, id);
            this.atomsById.set(id, name);
            if (id >= this.nextAtomId)
                this.nextAtomId = id + 1;
        }

        this.rootVisual = ROOT_VISUAL;
        this.rootColormap = ROOT_COLORMAP;
        this.root = new windows.Window(this, ROOT_WID, null, 0, 0,
            this.width, this.height, 0, 1, null);
        this.root.mapped = true;
        this.resources.set(ROOT_WID, this.root);
        const { Colormap } = require('./colors');
        this.resources.set(ROOT_COLORMAP, new Colormap(ROOT_COLORMAP, ROOT_VISUAL, null));

        this.selections = new Map();     // selection atom -> { wid, client, time }
        this.pointer = { x: this.width >> 1, y: this.height >> 1, buttons: 0, window: null };
        this.pressedKeys = new Uint8Array(32);
        this.focus = { wid: 1, revertTo: 1 }; // PointerRoot
        this.grabs = { pointer: null, keyboard: null };
        this.keymap = keymap.create();
        this.keyboardControl = {
            keyClickPercent: 50,
            bellPercent: 50,
            bellPitch: 400,
            bellDuration: 100,
            ledMask: 0,
            globalAutoRepeat: 1,
            autoRepeats: Buffer.alloc(32, 0xff)
        };
        this.pointerControl = { accelNumerator: 2, accelDenominator: 1, threshold: 4 };
        this.pointerMapping = [1, 2, 3, 4, 5];
        this.screenSaver = { timeout: 600, interval: 600, preferBlanking: 1, allowExposures: 1 };

        // request handlers
        windows.install(this);
        require('./properties').install(this);
        require('./gcontext').install(this);
        require('./drawing').install(this);
        require('./fonts').install(this);
        require('./colors').install(this);
        require('./input').install(this);
        require('./misc').install(this);

        // built-in extensions
        this.registerExtension('BIG-REQUESTS', require('./extensions/big-requests'));
        this.registerExtension('XC-MISC', require('./extensions/xc-misc'));
    }

    addClientStream(stream) {
        return new ServerClient(this, stream);
    }

    // node-only helper: TCP on port 6000+displayNum
    listen(displayNum, cb) {
        const net = require('net');
        const srv = net.createServer(sock => this.addClientStream(sock));
        srv.listen(6000 + displayNum, cb);
        this._netServer = srv;
        return srv;
    }

    registerExtension(name, def) {
        const server = this;
        const ext = {
            name,
            majorOpcode: this._nextExtOpcode++,
            firstEvent: def.eventsCount ? this._nextExtEvent : 0,
            firstError: def.errorsCount ? this._nextExtError : 0,
            handleRequest(client, minor, body) {
                def.handleRequest(server, client, minor, body);
            }
        };
        this._nextExtEvent += def.eventsCount || 0;
        this._nextExtError += def.errorsCount || 0;
        this.extensions.set(name, ext);
        this.extByOpcode.set(ext.majorOpcode, ext);
        if (def.init)
            def.init(this, ext);
        return ext;
    }

    allocResourceBase() {
        const base = this._nextClientBase;
        this._nextClientBase += FIRST_CLIENT_BASE;
        return base;
    }

    now() {
        return ++this._time;
    }

    // ---- resource lookup helpers (throw protocol errors) ----

    checkIdFree(client, xid) {
        if (((xid & ~client.resourceMask) >>> 0) !== client.resourceBase ||
            this.resources.has(xid))
            throw new XError(codes.IDChoice, xid);
    }

    checkAtom(atom) {
        if (!this.atomsById.has(atom))
            throw new XError(codes.Atom, atom);
        return atom;
    }

    getWindow(xid) {
        const res = this.resources.get(xid);
        if (!res || res.type !== 'window')
            throw new XError(codes.Window, xid);
        return res;
    }

    getDrawable(xid) {
        const res = this.resources.get(xid);
        if (!res || (res.type !== 'window' && res.type !== 'pixmap'))
            throw new XError(codes.Drawable, xid);
        return res;
    }

    getGC(xid) {
        const res = this.resources.get(xid);
        if (!res || res.type !== 'gc')
            throw new XError(codes.GContext, xid);
        return res;
    }

    // deepest mapped window containing the pointer
    pointerWindow() {
        let win = this.root;
        let ox = 0, oy = 0;
        for (;;) {
            let found = null;
            for (let i = win.children.length - 1; i >= 0; i--) {
                const c = win.children[i];
                const cx = ox + c.x, cy = oy + c.y;
                if (c.mapped && this.pointer.x >= cx && this.pointer.y >= cy &&
                    this.pointer.x < cx + c.width && this.pointer.y < cy + c.height) {
                    found = c;
                    ox = cx;
                    oy = cy;
                    break;
                }
            }
            if (!found)
                return win;
            win = found;
        }
    }

    // damage in root coordinates, clipped to the screen
    damageWindow(win) {
        let x = win.absX(), y = win.absY();
        let w = win.width, h = win.height;
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { h += y; y = 0; }
        w = Math.min(w, this.width - x);
        h = Math.min(h, this.height - y);
        if (w > 0 && h > 0)
            this.emit('damage', { x, y, width: w, height: h });
    }

    // repaint the root raster from the mapped window tree; returns the raster
    compose() {
        const rootRaster = this.root.raster;
        const paint = (win, ox, oy) => {
            for (const child of win.children) {
                if (!child.mapped)
                    continue;
                const cx = ox + child.x, cy = oy + child.y;
                const bw = child.borderWidth;
                if (bw > 0) {
                    const gc = { foreground: child.borderPixel };
                    rootRaster.fillRect(gc, cx - bw, cy - bw, child.width + 2 * bw, bw);
                    rootRaster.fillRect(gc, cx - bw, cy + child.height, child.width + 2 * bw, bw);
                    rootRaster.fillRect(gc, cx - bw, cy, bw, child.height);
                    rootRaster.fillRect(gc, cx + child.width, cy, bw, child.height);
                }
                rootRaster.putPixels(null, cx, cy, child.width, child.height, child.raster.data);
                paint(child, cx, cy);
            }
        };
        paint(this.root, 0, 0);
        return rootRaster;
    }

    // free everything a disconnecting (or killed) client owns
    freeClientResources(client) {
        for (const res of [...this.resources.values()])
            if (res.owner === client && res.type === 'window' && this.resources.has(res.id))
                windows.destroyWindow(this, res);
        for (const [id, res] of [...this.resources])
            if (res.owner === client)
                this.resources.delete(id);
        const strip = win => {
            win.eventMasks.delete(client);
            win.buttonGrabs = win.buttonGrabs.filter(g => g.client !== client);
            win.keyGrabs = win.keyGrabs.filter(g => g.client !== client);
            for (const child of win.children)
                strip(child);
        };
        strip(this.root);
        for (const [sel, owner] of [...this.selections])
            if (owner.client === client)
                this.selections.delete(sel);
        if (this.grabs.pointer && this.grabs.pointer.client === client)
            this.grabs.pointer = null;
        if (this.grabs.keyboard && this.grabs.keyboard.client === client)
            this.grabs.keyboard = null;
        if (this.focus.wid > 1 && !this.resources.has(this.focus.wid))
            this.focus = { wid: 1, revertTo: 1 };
    }

    // connection setup success block (generalization of the fixture in
    // test/display-protocols.js buildServerHello)
    buildSetup(client) {
        const vendorPadded = padLength(VENDOR.length);
        const formats = [[1, 1, 32], [24, 32, 32]]; // depth, bpp, scanline pad
        const extra = 32 + vendorPadded + 8 * formats.length + 40 + 8 + 24;
        const b = Buffer.alloc(8 + extra);
        let o = 0;
        b.writeUInt8(1, o); o += 2;                    // success + pad
        b.writeUInt16LE(11, o); o += 2;                // protocol major
        b.writeUInt16LE(0, o); o += 2;                 // protocol minor
        b.writeUInt16LE(extra / 4, o); o += 2;         // extra length (words)
        b.writeUInt32LE(30000000, o); o += 4;          // release number
        b.writeUInt32LE(client.resourceBase >>> 0, o); o += 4;
        b.writeUInt32LE(client.resourceMask >>> 0, o); o += 4;
        b.writeUInt32LE(256, o); o += 4;               // motion buffer size
        b.writeUInt16LE(VENDOR.length, o); o += 2;
        b.writeUInt16LE(65535, o); o += 2;             // max request length
        b.writeUInt8(1, o++);                          // screens
        b.writeUInt8(formats.length, o++);             // pixmap formats
        b.writeUInt8(0, o++);                          // image byte order LSB
        b.writeUInt8(0, o++);                          // bitmap bit order
        b.writeUInt8(32, o++);                         // scanline unit
        b.writeUInt8(32, o++);                         // scanline pad
        b.writeUInt8(keymap.MIN_KEYCODE, o++);
        b.writeUInt8(keymap.MAX_KEYCODE, o++);
        o += 4;                                        // pad
        b.write(VENDOR, o, 'latin1'); o += vendorPadded;
        for (const [depth, bpp, pad] of formats) {
            b.writeUInt8(depth, o);
            b.writeUInt8(bpp, o + 1);
            b.writeUInt8(pad, o + 2);
            o += 8;
        }
        // screen
        b.writeUInt32LE(ROOT_WID, o); o += 4;
        b.writeUInt32LE(ROOT_COLORMAP, o); o += 4;
        b.writeUInt32LE(0xffffff, o); o += 4;          // white pixel
        b.writeUInt32LE(0, o); o += 4;                 // black pixel
        b.writeUInt32LE(0, o); o += 4;                 // current input masks
        b.writeUInt16LE(this.width, o); o += 2;
        b.writeUInt16LE(this.height, o); o += 2;
        b.writeUInt16LE(Math.round(this.width * 25.4 / 96), o); o += 2;
        b.writeUInt16LE(Math.round(this.height * 25.4 / 96), o); o += 2;
        b.writeUInt16LE(1, o); o += 2;                 // min installed maps
        b.writeUInt16LE(1, o); o += 2;                 // max installed maps
        b.writeUInt32LE(ROOT_VISUAL, o); o += 4;
        b.writeUInt8(0, o++);                          // backing stores: Never
        b.writeUInt8(0, o++);                          // save unders
        b.writeUInt8(24, o++);                         // root depth
        b.writeUInt8(1, o++);                          // depths
        // depth 24 with 1 visual
        b.writeUInt8(24, o);
        b.writeUInt16LE(1, o + 2);
        o += 8;
        // TrueColor visual
        b.writeUInt32LE(ROOT_VISUAL, o); o += 4;
        b.writeUInt8(4, o++);                          // class TrueColor
        b.writeUInt8(8, o++);                          // bits per rgb
        b.writeUInt16LE(256, o); o += 2;               // colormap entries
        b.writeUInt32LE(0xff0000, o); o += 4;
        b.writeUInt32LE(0x00ff00, o); o += 4;
        b.writeUInt32LE(0x0000ff, o); o += 4;
        o += 4;                                        // pad
        return b;
    }
}

function createServer(options) {
    return new XServer(options);
}

module.exports = { XServer, ServerClient, createServer };
