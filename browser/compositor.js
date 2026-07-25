'use strict';

// Presents a JS X server's screen on a <canvas> and feeds DOM input back
// into it. Pixel flow: server composes window tree into the root raster
// (Uint32 0xRRGGBB) → damage rects → putImageData of the dirty region.

const { keyboardEventToKeysym } = require('./domkeys');

class CanvasPresenter {
    // server: lib/xserver XServer; canvas: HTMLCanvasElement sized to the screen
    constructor(server, canvas) {
        this.server = server;
        this.canvas = canvas;
        canvas.width = server.width;
        canvas.height = server.height;
        this.ctx = canvas.getContext('2d');
        this.image = this.ctx.createImageData(server.width, server.height);
        this._pending = null;      // accumulated damage rect
        this._raf = 0;
        this._keycodeCache = new Map();

        server.on('damage', rect => this._addDamage(rect));
        this._addDamage({ x: 0, y: 0, width: server.width, height: server.height });
        this._attachInput();
    }

    _addDamage(rect) {
        const p = this._pending;
        if (!p) {
            this._pending = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        } else {
            const x1 = Math.min(p.x, rect.x), y1 = Math.min(p.y, rect.y);
            const x2 = Math.max(p.x + p.width, rect.x + rect.width);
            const y2 = Math.max(p.y + p.height, rect.y + rect.height);
            this._pending = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        }
        if (!this._raf) {
            this._raf = (typeof requestAnimationFrame === 'function'
                ? requestAnimationFrame(() => this._flush())
                : setTimeout(() => this._flush(), 16));
        }
    }

    _flush() {
        this._raf = 0;
        const rect = this._pending;
        this._pending = null;
        if (!rect)
            return;
        const server = this.server;
        if (typeof server.compose === 'function')
            server.compose();
        const src = server.root && server.root.raster ? server.root.raster.data
                                                      : server.screenPixels;
        const w = server.width;
        const x1 = Math.max(0, rect.x), y1 = Math.max(0, rect.y);
        const x2 = Math.min(server.width, rect.x + rect.width);
        const y2 = Math.min(server.height, rect.y + rect.height);
        const out = this.image.data;
        for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
                const px = src[y * w + x];
                const o = (y * w + x) * 4;
                out[o] = (px >> 16) & 0xff;
                out[o + 1] = (px >> 8) & 0xff;
                out[o + 2] = px & 0xff;
                out[o + 3] = 0xff;
            }
        }
        this.ctx.putImageData(this.image, 0, 0, x1, y1, x2 - x1, y2 - y1);
    }

    _pos(ev) {
        const r = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / r.width, sy = this.canvas.height / r.height;
        return { x: Math.round((ev.clientX - r.left) * sx),
                 y: Math.round((ev.clientY - r.top) * sy) };
    }

    _keycodeForKeysym(keysym) {
        if (this._keycodeCache.has(keysym))
            return this._keycodeCache.get(keysym);
        const keycode = this.server.keymap && this.server.keymap.keycodeForKeysym
            ? this.server.keymap.keycodeForKeysym(keysym)
            : 0;
        this._keycodeCache.set(keysym, keycode);
        return keycode;
    }

    _attachInput() {
        const canvas = this.canvas;
        const server = this.server;
        canvas.tabIndex = 0; // make it focusable for keyboard input
        canvas.style.outline = 'none';
        canvas.addEventListener('mousemove', ev => {
            const p = this._pos(ev);
            server.injectPointerMove(p.x, p.y);
        });
        canvas.addEventListener('mousedown', ev => {
            ev.preventDefault();
            canvas.focus();
            server.injectButton(ev.button + 1, true);
        });
        canvas.addEventListener('mouseup', ev => {
            server.injectButton(ev.button + 1, false);
        });
        canvas.addEventListener('wheel', ev => {
            ev.preventDefault();
            const btn = ev.deltaY < 0 ? 4 : 5; // X wheel buttons
            server.injectButton(btn, true);
            server.injectButton(btn, false);
        }, { passive: false });
        canvas.addEventListener('contextmenu', ev => ev.preventDefault());
        const key = (ev, isPress) => {
            const keysym = keyboardEventToKeysym(ev);
            if (!keysym)
                return;
            const keycode = this._keycodeForKeysym(keysym);
            if (!keycode)
                return;
            ev.preventDefault();
            server.injectKey(keycode, isPress);
        };
        canvas.addEventListener('keydown', ev => key(ev, true));
        canvas.addEventListener('keyup', ev => key(ev, false));
    }
}

module.exports = { CanvasPresenter };
