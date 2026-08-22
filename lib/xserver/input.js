'use strict';

// Input: device event delivery, grabs, focus, keyboard/pointer state
// (opcodes 26-44, 100-106, 116-119) and the server's injection API.

const { XError, codes } = require('./errors');
const { parseValueList } = require('./util');
const { builders, deliver } = require('./events');
const { eventMask } = require('../eventmask');

const KEYBOARD_CONTROL_VALUES = [
    { mask: 0x0001, name: 'keyClickPercent', kind: 'c' },
    { mask: 0x0002, name: 'bellPercent', kind: 'c' },
    { mask: 0x0004, name: 'bellPitch', kind: 's' },
    { mask: 0x0008, name: 'bellDuration', kind: 's' },
    { mask: 0x0010, name: 'led', kind: 'C' },
    { mask: 0x0020, name: 'ledMode', kind: 'C' },
    { mask: 0x0040, name: 'key', kind: 'C' },
    { mask: 0x0080, name: 'autoRepeatMode', kind: 'C' }
];

function currentState(server) {
    let mods = 0;
    for (let kc = 8; kc <= 255; kc++)
        if (server.pressedKeys[kc >> 3] & (1 << (kc & 7)))
            mods |= server.keymap.modifierBit(kc);
    return (mods | (server.pointer.buttons << 8)) & 0xffff;
}

function chainFrom(win) {
    const chain = [];
    for (let w = win; w; w = w.parent)
        chain.push(w);
    return chain;
}

// direct child of `ancestor` on the path towards `source` (0 if none)
function childToward(ancestor, source) {
    if (source === ancestor)
        return 0;
    for (let w = source; w; w = w.parent)
        if (w.parent === ancestor)
            return w.id;
    return 0;
}

function buildDeviceEvent(server, type, detail, time, eventWin, source, state) {
    const p = server.pointer;
    return builders.deviceEvent(type, detail, time, server.root.id, eventWin.id,
        childToward(eventWin, source), p.x, p.y,
        p.x - eventWin.absX(), p.y - eventWin.absY(), state);
}

// key events go towards the focus window; pointer events towards the pointer
function targetChain(server, forKey) {
    const source = server.pointerWindow();
    let chain = chainFrom(source);
    if (forKey) {
        const f = server.focus.wid;
        if (f === 0)
            return { source, chain: [] };
        if (f !== 1) {
            const fw = server.resources.get(f);
            if (fw && fw.type === 'window') {
                const i = chain.indexOf(fw);
                chain = i !== -1 ? chain.slice(0, i + 1) : [fw];
            }
        }
    }
    return { source, chain };
}

// Deliver a KeyPress/KeyRelease/ButtonPress/ButtonRelease/MotionNotify.
// Returns { client, win } of the delivery target (or null).
function dispatchDeviceEvent(server, type, detail, acceptMask, forKey, state) {
    const time = server.now();
    const grab = forKey ? server.grabs.keyboard : server.grabs.pointer;
    const { source, chain } = targetChain(server, forKey);
    const emit = (client, eventWin) => {
        client.sendEvent(buildDeviceEvent(server, type, detail, time, eventWin, source, state));
    };
    if (grab) {
        if (!grab.client.alive) {
            if (forKey)
                server.grabs.keyboard = null;
            else
                server.grabs.pointer = null;
        } else {
            if (grab.ownerEvents)
                for (const w of chain) {
                    if ((w.eventMasks.get(grab.client) || 0) & acceptMask) {
                        emit(grab.client, w);
                        return { client: grab.client, win: w };
                    }
                }
            const gwin = server.resources.get(grab.wid);
            if (gwin && gwin.type === 'window' &&
                (forKey || (grab.eventMask & acceptMask))) {
                emit(grab.client, gwin);
                return { client: grab.client, win: gwin };
            }
            return null;
        }
    }
    for (const w of chain) {
        const receivers = [];
        for (const [c, m] of w.eventMasks)
            if (m & acceptMask)
                receivers.push(c);
        if (receivers.length) {
            for (const c of receivers)
                emit(c, w);
            return { client: receivers[0], win: w };
        }
    }
    return null;
}

function crossingEvent(server, type, win, source, state, time) {
    const p = server.pointer;
    const buf = builders.deviceEvent(type, 0 /* NotifyAncestor */, time,
        server.root.id, win.id, childToward(win, source),
        p.x, p.y, p.x - win.absX(), p.y - win.absY(), state,
        0 /* NotifyNormal */, 1 /* same screen */);
    deliver(win, type === 7 ? eventMask.EnterWindow : eventMask.LeaveWindow, buf);
}

function motionAcceptMask(server) {
    let mask = eventMask.PointerMotion;
    const buttons = server.pointer.buttons;
    if (buttons) {
        mask |= eventMask.ButtonMotion;
        for (let i = 0; i < 5; i++)
            if (buttons & (1 << i))
                mask |= eventMask.Button1Motion << i;
    }
    return mask;
}

function findButtonGrab(server, button, modMask) {
    const chain = chainFrom(server.pointerWindow()).reverse(); // root first
    for (const w of chain)
        for (const g of w.buttonGrabs)
            if (g.client.alive &&
                (g.button === 0 || g.button === button) &&
                (g.modifiers === 0x8000 || g.modifiers === modMask))
                return { grab: g, win: w };
    return null;
}

function findKeyGrab(server, keycode, modMask) {
    const { chain } = targetChain(server, true);
    for (const w of chain.slice().reverse())
        for (const g of w.keyGrabs)
            if (g.client.alive &&
                (g.key === 0 || g.key === keycode) &&
                (g.modifiers === 0x8000 || g.modifiers === modMask))
                return { grab: g, win: w };
    return null;
}

function setFocus(server, wid, revertTo) {
    const old = server.focus.wid;
    server.focus = { wid, revertTo };
    if (old > 1 && old !== wid) {
        const ow = server.resources.get(old);
        if (ow && ow.type === 'window')
            deliver(ow, eventMask.FocusChange, builders.focusEvent(10, 0, ow.id, 0));
    }
    if (wid > 1 && wid !== old) {
        const nw = server.resources.get(wid);
        if (nw && nw.type === 'window') {
            deliver(nw, eventMask.FocusChange, builders.focusEvent(9, 0, nw.id, 0));
            deliver(nw, eventMask.KeymapState, builders.keymapNotify(server.pressedKeys));
        }
    }
}

function install(server) {
    const h = server.handlers;

    server.injectPointerMove = (x, y) => {
        x = Math.max(0, Math.min(server.width - 1, x | 0));
        y = Math.max(0, Math.min(server.height - 1, y | 0));
        const oldWin = server.pointerWindow();
        server.pointer.x = x;
        server.pointer.y = y;
        const newWin = server.pointerWindow();
        const state = currentState(server);
        if (oldWin !== newWin) {
            const time = server.now();
            crossingEvent(server, 8, oldWin, newWin, state, time); // LeaveNotify
            crossingEvent(server, 7, newWin, newWin, state, time); // EnterNotify
        }
        dispatchDeviceEvent(server, 6, 0, motionAcceptMask(server), false, state);
    };

    server.injectButton = (button, isPress) => {
        const state = currentState(server);
        if (isPress) {
            if (!server.grabs.pointer) {
                const pg = findButtonGrab(server, button, state & 0xff);
                if (pg)
                    server.grabs.pointer = {
                        client: pg.grab.client,
                        wid: pg.win.id,
                        ownerEvents: pg.grab.ownerEvents,
                        eventMask: pg.grab.eventMask,
                        implicit: true
                    };
            }
            const res = dispatchDeviceEvent(server, 4, button, eventMask.ButtonPress, false, state);
            if (!server.grabs.pointer && res) {
                const m = res.win.eventMasks.get(res.client) || 0;
                server.grabs.pointer = {
                    client: res.client,
                    wid: res.win.id,
                    ownerEvents: !!(m & eventMask.OwnerGrabButton),
                    eventMask: m,
                    implicit: true
                };
            }
            server.pointer.buttons |= 1 << (button - 1);
        } else {
            dispatchDeviceEvent(server, 5, button, eventMask.ButtonRelease, false, state);
            server.pointer.buttons &= ~(1 << (button - 1));
            if (server.pointer.buttons === 0 &&
                server.grabs.pointer && server.grabs.pointer.implicit)
                server.grabs.pointer = null;
        }
    };

    server.injectKey = (keycode, isPress) => {
        const state = currentState(server);
        if (isPress) {
            if (!server.grabs.keyboard) {
                const kg = findKeyGrab(server, keycode, state & 0xff);
                if (kg)
                    server.grabs.keyboard = {
                        client: kg.grab.client,
                        wid: kg.win.id,
                        ownerEvents: kg.grab.ownerEvents,
                        implicit: true,
                        key: keycode
                    };
            }
            dispatchDeviceEvent(server, 2, keycode, eventMask.KeyPress, true, state);
            server.pressedKeys[keycode >> 3] |= 1 << (keycode & 7);
        } else {
            dispatchDeviceEvent(server, 3, keycode, eventMask.KeyRelease, true, state);
            server.pressedKeys[keycode >> 3] &= ~(1 << (keycode & 7));
            if (server.grabs.keyboard && server.grabs.keyboard.implicit &&
                server.grabs.keyboard.key === keycode)
                server.grabs.keyboard = null;
        }
    };

    // GrabPointer (26)
    h[26] = (client, ownerEvents, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const mask = body.readUInt16LE(4);
        const cursor = body.readUInt32LE(12);
        let status = 0; // Success
        if (server.grabs.pointer && server.grabs.pointer.client !== client)
            status = 1; // AlreadyGrabbed
        else
            server.grabs.pointer = {
                client, wid: win.id, ownerEvents: !!ownerEvents,
                eventMask: mask, cursor, implicit: false
            };
        client.send(client.startReply(0, status));
    };

    // UngrabPointer (27)
    h[27] = client => {
        if (server.grabs.pointer && server.grabs.pointer.client === client)
            server.grabs.pointer = null;
    };

    // GrabButton (28)
    h[28] = (client, ownerEvents, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const grab = {
            client,
            ownerEvents: !!ownerEvents,
            eventMask: body.readUInt16LE(4),
            pointerMode: body.readUInt8(6),
            keybMode: body.readUInt8(7),
            confineTo: body.readUInt32LE(8),
            cursor: body.readUInt32LE(12),
            button: body.readUInt8(16),
            modifiers: body.readUInt16LE(18)
        };
        win.buttonGrabs = win.buttonGrabs.filter(g =>
            !(g.button === grab.button && g.modifiers === grab.modifiers));
        win.buttonGrabs.push(grab);
    };

    // UngrabButton (29)
    h[29] = (client, button, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const modifiers = body.readUInt16LE(4);
        win.buttonGrabs = win.buttonGrabs.filter(g =>
            !((button === 0 || g.button === button) &&
              (modifiers === 0x8000 || g.modifiers === modifiers) &&
              g.client === client));
    };

    // ChangeActivePointerGrab (30)
    h[30] = (client, detail, body) => {
        const grab = server.grabs.pointer;
        if (grab && grab.client === client) {
            grab.cursor = body.readUInt32LE(0);
            grab.eventMask = body.readUInt16LE(8);
        }
    };

    // GrabKeyboard (31)
    h[31] = (client, ownerEvents, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        let status = 0;
        if (server.grabs.keyboard && server.grabs.keyboard.client !== client)
            status = 1;
        else
            server.grabs.keyboard = {
                client, wid: win.id, ownerEvents: !!ownerEvents,
                time: body.readUInt32LE(4),
                pointerMode: body.readUInt8(8),
                keybMode: body.readUInt8(9),
                implicit: false
            };
        client.send(client.startReply(0, status));
    };

    // UngrabKeyboard (32)
    h[32] = client => {
        if (server.grabs.keyboard && server.grabs.keyboard.client === client)
            server.grabs.keyboard = null;
    };

    // GrabKey (33)
    h[33] = (client, ownerEvents, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const grab = {
            client,
            ownerEvents: !!ownerEvents,
            modifiers: body.readUInt16LE(4),
            key: body.readUInt8(6)
        };
        win.keyGrabs = win.keyGrabs.filter(g =>
            !(g.key === grab.key && g.modifiers === grab.modifiers));
        win.keyGrabs.push(grab);
    };

    // UngrabKey (34)
    h[34] = (client, key, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const modifiers = body.readUInt16LE(4);
        win.keyGrabs = win.keyGrabs.filter(g =>
            !((key === 0 || g.key === key) &&
              (modifiers === 0x8000 || g.modifiers === modifiers) &&
              g.client === client));
    };

    // AllowEvents (35): frozen-device semantics not modelled
    h[35] = () => {};

    // QueryPointer (38)
    h[38] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const p = server.pointer;
        const b = client.startReply(0, 1); // same screen
        b.writeUInt32LE(server.root.id >>> 0, 8);
        b.writeUInt32LE(childToward(win, server.pointerWindow()) >>> 0, 12);
        b.writeInt16LE(p.x, 16);
        b.writeInt16LE(p.y, 18);
        b.writeInt16LE(p.x - win.absX(), 20);
        b.writeInt16LE(p.y - win.absY(), 22);
        b.writeUInt16LE(currentState(server), 24);
        client.send(b);
    };

    // GetMotionEvents (39): motion history buffer is empty
    h[39] = (client, detail, body) => {
        server.getWindow(body.readUInt32LE(0));
        const b = client.startReply(0, 0);
        b.writeUInt32LE(0, 8);
        client.send(b);
    };

    // TranslateCoordinates (40)
    h[40] = (client, detail, body) => {
        const src = server.getWindow(body.readUInt32LE(0));
        const dst = server.getWindow(body.readUInt32LE(4));
        const srcX = body.readInt16LE(8);
        const srcY = body.readInt16LE(10);
        const dstX = src.absX() + srcX - dst.absX();
        const dstY = src.absY() + srcY - dst.absY();
        let child = 0;
        for (let i = dst.children.length - 1; i >= 0; i--) {
            const c = dst.children[i];
            if (c.mapped && dstX >= c.x && dstY >= c.y &&
                dstX < c.x + c.width && dstY < c.y + c.height) {
                child = c.id;
                break;
            }
        }
        const b = client.startReply(0, 1);
        b.writeUInt32LE(child >>> 0, 8);
        b.writeInt16LE(dstX, 12);
        b.writeInt16LE(dstY, 14);
        client.send(b);
    };

    // WarpPointer (41)
    h[41] = (client, detail, body) => {
        const dstWid = body.readUInt32LE(4);
        const dstX = body.readInt16LE(16);
        const dstY = body.readInt16LE(18);
        if (dstWid === 0) {
            server.injectPointerMove(server.pointer.x + dstX, server.pointer.y + dstY);
        } else {
            const dst = server.getWindow(dstWid);
            server.injectPointerMove(dst.absX() + dstX, dst.absY() + dstY);
        }
    };

    // SetInputFocus (42)
    h[42] = (client, revertTo, body) => {
        const wid = body.readUInt32LE(0);
        if (wid > 1)
            server.getWindow(wid);
        setFocus(server, wid, revertTo);
    };

    // GetInputFocus (43)
    h[43] = client => {
        const b = client.startReply(0, server.focus.revertTo);
        b.writeUInt32LE(server.focus.wid >>> 0, 8);
        client.send(b);
    };

    // QueryKeymap (44)
    h[44] = client => {
        const b = client.startReply(2, 0);
        Buffer.from(server.pressedKeys.buffer, 0, 32).copy(b, 8);
        client.send(b);
    };

    // ChangeKeyboardMapping (100)
    h[100] = (client, keycodeCount, body) => {
        const first = body.readUInt8(0);
        const kpk = body.readUInt8(1);
        const km = server.keymap;
        if (first < km.minKeycode || first + keycodeCount - 1 > km.maxKeycode)
            throw new XError(codes.Value, first);
        if (kpk === 0)
            throw new XError(codes.Value, 0);
        if (kpk > km.keysymsPerKeycode) {
            for (let kc = 0; kc <= km.maxKeycode; kc++)
                while (km.syms[kc].length < kpk)
                    km.syms[kc].push(0);
            km.keysymsPerKeycode = kpk;
        }
        for (let i = 0; i < keycodeCount; i++) {
            const row = new Array(km.keysymsPerKeycode).fill(0);
            for (let j = 0; j < kpk; j++)
                row[j] = body.readUInt32LE(4 + (i * kpk + j) * 4);
            km.syms[first + i] = row;
        }
        const notice = builders.mappingNotify(1, first, keycodeCount);
        for (const c of server.clients)
            if (c.ready)
                c.sendEvent(notice);
    };

    // GetKeyboardMapping (101)
    h[101] = (client, detail, body) => {
        const first = body.readUInt8(0);
        const count = body.readUInt8(1);
        const km = server.keymap;
        if (first < km.minKeycode || first + count - 1 > km.maxKeycode)
            throw new XError(codes.Value, first);
        const n = km.keysymsPerKeycode;
        const b = client.startReply(count * n, n);
        for (let i = 0; i < count; i++) {
            const row = km.syms[first + i];
            for (let j = 0; j < n; j++)
                b.writeUInt32LE((row[j] || 0) >>> 0, 32 + (i * n + j) * 4);
        }
        client.send(b);
    };

    // ChangeKeyboardControl (102)
    h[102] = (client, detail, body) => {
        const bitmask = body.readUInt32LE(0);
        const values = parseValueList(body, 4, bitmask, KEYBOARD_CONTROL_VALUES);
        const kc = server.keyboardControl;
        if (values.keyClickPercent !== undefined && values.keyClickPercent >= 0)
            kc.keyClickPercent = values.keyClickPercent;
        if (values.bellPercent !== undefined && values.bellPercent >= 0)
            kc.bellPercent = values.bellPercent;
        if (values.bellPitch !== undefined && values.bellPitch >= 0)
            kc.bellPitch = values.bellPitch;
        if (values.bellDuration !== undefined && values.bellDuration >= 0)
            kc.bellDuration = values.bellDuration;
        if (values.led !== undefined && values.ledMode !== undefined) {
            const bit = 1 << (values.led - 1);
            kc.ledMask = values.ledMode ? (kc.ledMask | bit) : (kc.ledMask & ~bit);
        }
        if (values.autoRepeatMode !== undefined && values.autoRepeatMode !== 2)
            kc.globalAutoRepeat = values.autoRepeatMode;
    };

    // GetKeyboardControl (103)
    h[103] = client => {
        const kc = server.keyboardControl;
        const b = client.startReply(5, kc.globalAutoRepeat);
        b.writeUInt32LE(kc.ledMask >>> 0, 8);
        b[12] = kc.keyClickPercent;
        b[13] = kc.bellPercent;
        b.writeUInt16LE(kc.bellPitch, 14);
        b.writeUInt16LE(kc.bellDuration, 16);
        kc.autoRepeats.copy(b, 20);
        client.send(b);
    };

    // Bell (104)
    h[104] = (client, detail) => {
        // detail is a signed percent (-100..100)
        const percent = detail > 127 ? detail - 256 : detail;
        if (percent < -100 || percent > 100)
            throw new XError(codes.Value, detail);
        server.emit('bell', percent);
    };

    // ChangePointerControl (105)
    h[105] = (client, detail, body) => {
        const pc = server.pointerControl;
        if (body.readUInt8(6)) { // do-acceleration
            pc.accelNumerator = body.readInt16LE(0);
            pc.accelDenominator = body.readInt16LE(2);
        }
        if (body.readUInt8(7)) // do-threshold
            pc.threshold = body.readInt16LE(4);
    };

    // GetPointerControl (106)
    h[106] = client => {
        const pc = server.pointerControl;
        const b = client.startReply(0, 0);
        b.writeUInt16LE(pc.accelNumerator, 8);
        b.writeUInt16LE(pc.accelDenominator, 10);
        b.writeUInt16LE(pc.threshold, 12);
        client.send(b);
    };

    // SetPointerMapping (116)
    h[116] = (client, n, body) => {
        const map = [];
        for (let i = 0; i < n; i++)
            map.push(body.readUInt8(i));
        server.pointerMapping = map;
        client.send(client.startReply(0, 0)); // Success
        const notice = builders.mappingNotify(2, 0, 0);
        for (const c of server.clients)
            if (c.ready)
                c.sendEvent(notice);
    };

    // GetPointerMapping (117)
    h[117] = client => {
        const map = server.pointerMapping;
        const b = client.startReply(Math.ceil(map.length / 4), map.length);
        for (let i = 0; i < map.length; i++)
            b[32 + i] = map[i];
        client.send(b);
    };

    // SetModifierMapping (118)
    h[118] = (client, kpm, body) => {
        const km = server.keymap;
        const rows = [];
        for (let mod = 0; mod < 8; mod++) {
            const row = [];
            for (let i = 0; i < kpm; i++)
                row.push(body.readUInt8(mod * kpm + i));
            rows.push(row);
        }
        km.modifiers = rows;
        km.keycodesPerModifier = kpm;
        client.send(client.startReply(0, 0)); // Success
        const notice = builders.mappingNotify(0, 0, 0);
        for (const c of server.clients)
            if (c.ready)
                c.sendEvent(notice);
    };

    // GetModifierMapping (119)
    h[119] = client => {
        const km = server.keymap;
        const kpm = km.keycodesPerModifier;
        const b = client.startReply(2 * kpm, kpm);
        for (let mod = 0; mod < 8; mod++)
            for (let i = 0; i < kpm; i++)
                b[32 + mod * kpm + i] = km.modifiers[mod][i] || 0;
        client.send(b);
    };
}

module.exports = { install, currentState };
