'use strict';

// Core event packet builders. Every core event is 32 bytes:
//   [0] type  [1] detail  [2..3] sequence (stamped per-client at send time)
//   [4..7] "extra" 32-bit slot  [8..31] event payload
// Layouts mirror lib/generated/core-events.js (the client's unpackers).

const { eventMask } = require('../eventmask');

function packEvent(type, detail, extra) {
    const b = Buffer.alloc(32);
    b[0] = type;
    b[1] = detail & 0xff;
    b.writeUInt32LE(extra >>> 0, 4);
    return b;
}

const builders = {
    // type 2..6 KeyPress/KeyRelease/ButtonPress/ButtonRelease/MotionNotify,
    // type 7/8 EnterNotify/LeaveNotify (last byte differs: mode+focus flags)
    deviceEvent(type, detail, time, root, event, child, rootX, rootY, eventX, eventY, state, byte22, byte23) {
        const b = packEvent(type, detail, time);
        b.writeUInt32LE(root >>> 0, 8);
        b.writeUInt32LE(event >>> 0, 12);
        b.writeUInt32LE(child >>> 0, 16);
        b.writeInt16LE(rootX | 0, 20);
        b.writeInt16LE(rootY | 0, 22);
        b.writeInt16LE(eventX | 0, 24);
        b.writeInt16LE(eventY | 0, 26);
        b.writeUInt16LE(state & 0xffff, 28);
        b[30] = byte22 === undefined ? 1 : byte22; // sameScreen / mode
        b[31] = byte23 === undefined ? 0 : byte23; // pad / sameScreenFocus
        return b;
    },

    focusEvent(type, detail, wid, mode) {
        const b = packEvent(type, detail, wid);
        b[8] = mode;
        return b;
    },

    // keys: 32-byte pressed-keycode bitmap; bytes 1..31 go on the wire.
    // No sequence number in this event (bytes 2-3 carry key data).
    keymapNotify(keys) {
        const b = Buffer.alloc(32);
        b[0] = 11;
        for (let i = 1; i < 32; i++)
            b[i] = keys[i];
        return b;
    },

    expose(wid, x, y, width, height, count) {
        const b = packEvent(12, 0, wid);
        b.writeUInt16LE(x & 0xffff, 8);
        b.writeUInt16LE(y & 0xffff, 10);
        b.writeUInt16LE(width & 0xffff, 12);
        b.writeUInt16LE(height & 0xffff, 14);
        b.writeUInt16LE(count & 0xffff, 16);
        return b;
    },

    graphicsExposure(drawable, x, y, width, height, major, count) {
        const b = packEvent(13, 0, drawable);
        b.writeUInt16LE(x & 0xffff, 8);
        b.writeUInt16LE(y & 0xffff, 10);
        b.writeUInt16LE(width & 0xffff, 12);
        b.writeUInt16LE(height & 0xffff, 14);
        b.writeUInt16LE(0, 16);            // minor opcode
        b.writeUInt16LE(count || 0, 18);
        b[20] = major;
        return b;
    },

    noExposure(drawable, major) {
        const b = packEvent(14, 0, drawable);
        b.writeUInt16LE(0, 8);             // minor opcode
        b[10] = major;
        return b;
    },

    visibilityNotify(wid, state) {
        const b = packEvent(15, 0, wid);
        b[8] = state;
        return b;
    },

    createNotify(parent, win) {
        const b = packEvent(16, 0, parent);
        b.writeUInt32LE(win.id >>> 0, 8);
        b.writeInt16LE(win.x, 12);
        b.writeInt16LE(win.y, 14);
        b.writeUInt16LE(win.width, 16);
        b.writeUInt16LE(win.height, 18);
        b.writeUInt16LE(win.borderWidth, 20);
        b[22] = win.overrideRedirect ? 1 : 0;
        return b;
    },

    destroyNotify(event, wid) {
        const b = packEvent(17, 0, event);
        b.writeUInt32LE(wid >>> 0, 8);
        return b;
    },

    unmapNotify(event, wid, fromConfigure) {
        const b = packEvent(18, 0, event);
        b.writeUInt32LE(wid >>> 0, 8);
        b[12] = fromConfigure ? 1 : 0;
        return b;
    },

    mapNotify(event, wid, overrideRedirect) {
        const b = packEvent(19, 0, event);
        b.writeUInt32LE(wid >>> 0, 8);
        b[12] = overrideRedirect ? 1 : 0;
        return b;
    },

    reparentNotify(event, wid, parent, x, y, overrideRedirect) {
        const b = packEvent(21, 0, event);
        b.writeUInt32LE(wid >>> 0, 8);
        b.writeUInt32LE(parent >>> 0, 12);
        b.writeInt16LE(x, 16);
        b.writeInt16LE(y, 18);
        b[20] = overrideRedirect ? 1 : 0;
        return b;
    },

    configureNotify(event, win, aboveSibling) {
        const b = packEvent(22, 0, event);
        b.writeUInt32LE(win.id >>> 0, 8);
        b.writeUInt32LE(aboveSibling >>> 0, 12);
        b.writeInt16LE(win.x, 16);
        b.writeInt16LE(win.y, 18);
        b.writeUInt16LE(win.width, 20);
        b.writeUInt16LE(win.height, 22);
        b.writeUInt16LE(win.borderWidth, 24);
        b[26] = win.overrideRedirect ? 1 : 0;
        return b;
    },

    circulateNotify(event, wid, place) {
        const b = packEvent(26, 0, event);
        b.writeUInt32LE(wid >>> 0, 8);
        b[16] = place;
        return b;
    },

    propertyNotify(wid, atom, time, state) {
        const b = packEvent(28, 0, wid);
        b.writeUInt32LE(atom >>> 0, 8);
        b.writeUInt32LE(time >>> 0, 12);
        b[16] = state;
        return b;
    },

    selectionClear(time, owner, selection) {
        const b = packEvent(29, 0, time);
        b.writeUInt32LE(owner >>> 0, 8);
        b.writeUInt32LE(selection >>> 0, 12);
        return b;
    },

    selectionRequest(time, owner, requestor, selection, target, property) {
        const b = packEvent(30, 0, time);
        b.writeUInt32LE(owner >>> 0, 8);
        b.writeUInt32LE(requestor >>> 0, 12);
        b.writeUInt32LE(selection >>> 0, 16);
        b.writeUInt32LE(target >>> 0, 20);
        b.writeUInt32LE(property >>> 0, 24);
        return b;
    },

    selectionNotify(time, requestor, selection, target, property) {
        const b = packEvent(31, 0, time);
        b.writeUInt32LE(requestor >>> 0, 8);
        b.writeUInt32LE(selection >>> 0, 12);
        b.writeUInt32LE(target >>> 0, 16);
        b.writeUInt32LE(property >>> 0, 20);
        return b;
    },

    colormapNotify(wid, colormap, isNew, state) {
        const b = packEvent(32, 0, wid);
        b.writeUInt32LE(colormap >>> 0, 8);
        b[12] = isNew ? 1 : 0;
        b[13] = state;
        return b;
    },

    mappingNotify(request, firstKeyCode, count) {
        const b = Buffer.alloc(32);
        b[0] = 34;
        b[4] = request;      // 0 Modifier, 1 Keyboard, 2 Pointer
        b[5] = firstKeyCode;
        b[6] = count;
        return b;
    }
};

// Send `buf` to every client that selected any bit of `maskBits` on `win`.
// Returns the list of clients the event went to.
function deliver(win, maskBits, buf) {
    const sent = [];
    for (const [client, mask] of win.eventMasks) {
        if (mask & maskBits) {
            client.sendEvent(buf);
            sent.push(client);
        }
    }
    return sent;
}

// The StructureNotify (to the window) + SubstructureNotify (to its parent)
// pattern shared by Destroy/Unmap/Map/Reparent/Configure/Circulate-Notify.
// `build(eventWid)` returns the packet with the given event window field.
function structureNotify(win, build) {
    deliver(win, eventMask.StructureNotify, build(win.id));
    if (win.parent)
        deliver(win.parent, eventMask.SubstructureNotify, build(win.parent.id));
}

module.exports = { packEvent, builders, deliver, structureNotify };
