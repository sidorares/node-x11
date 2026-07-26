'use strict';

// Atoms (16-17), properties (18-21, 114), selections (22-24) and
// SendEvent (25).

const { XError, codes } = require('./errors');
const { padLength } = require('./util');
const { builders, deliver } = require('./events');
const { eventMask } = require('../eventmask');

function propertyNotify(server, win, atom, state) {
    deliver(win, eventMask.PropertyChange,
        builders.propertyNotify(win.id, atom, server.now(), state));
}

function install(server) {
    const h = server.handlers;

    // InternAtom (16)
    h[16] = (client, onlyIfExists, body) => {
        const nameLen = body.readUInt16LE(0);
        const name = body.toString('latin1', 4, 4 + nameLen);
        let id = server.atomsByName.get(name) || 0;
        if (!id && !onlyIfExists) {
            id = server.nextAtomId++;
            server.atomsByName.set(name, id);
            server.atomsById.set(id, name);
        }
        const b = client.startReply(0, 0);
        b.writeUInt32LE(id >>> 0, 8);
        client.send(b);
    };

    // GetAtomName (17)
    h[17] = (client, detail, body) => {
        const atom = body.readUInt32LE(0);
        const name = server.atomsById.get(atom);
        if (name === undefined)
            throw new XError(codes.Atom, atom);
        const b = client.startReply(padLength(name.length) / 4, 0);
        b.writeUInt16LE(name.length, 8);
        b.write(name, 32, 'latin1');
        client.send(b);
    };

    // ChangeProperty (18)
    h[18] = (client, mode, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const atom = body.readUInt32LE(4);
        const type = body.readUInt32LE(8);
        const format = body.readUInt8(12);
        const dataLen = body.readUInt32LE(16);
        if (mode > 2)
            throw new XError(codes.Value, mode);
        if (format !== 8 && format !== 16 && format !== 32)
            throw new XError(codes.Value, format);
        server.checkAtom(atom);
        server.checkAtom(type);
        const bytes = dataLen * (format >> 3);
        if (20 + bytes > body.length)
            throw new XError(codes.Length, dataLen);
        const data = Buffer.from(body.subarray(20, 20 + bytes));
        const existing = win.properties.get(atom);
        if (mode === 0 || !existing) {
            win.properties.set(atom, { type, format, data });
        } else {
            if (existing.type !== type || existing.format !== format)
                throw new XError(codes.Match, atom);
            existing.data = mode === 1
                ? Buffer.concat([data, existing.data])   // prepend
                : Buffer.concat([existing.data, data]);  // append
        }
        propertyNotify(server, win, atom, 0); // NewValue
    };

    // DeleteProperty (19)
    h[19] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const atom = body.readUInt32LE(4);
        server.checkAtom(atom);
        if (win.properties.delete(atom))
            propertyNotify(server, win, atom, 1); // Deleted
    };

    // GetProperty (20)
    h[20] = (client, del, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const atom = body.readUInt32LE(4);
        const type = body.readUInt32LE(8);
        const longOffset = body.readUInt32LE(12);
        const longLength = body.readUInt32LE(16);
        server.checkAtom(atom);
        const prop = win.properties.get(atom);
        if (!prop) {
            client.send(client.startReply(0, 0)); // type None, format 0
            return;
        }
        if (type !== 0 && type !== prop.type) {
            const b = client.startReply(0, prop.format);
            b.writeUInt32LE(prop.type >>> 0, 8);
            b.writeUInt32LE(prop.data.length >>> 0, 12); // bytes-after
            client.send(b);
            return;
        }
        const start = 4 * longOffset;
        if (start > prop.data.length)
            throw new XError(codes.Value, longOffset);
        const avail = prop.data.length - start;
        const len = Math.min(avail, 4 * longLength);
        const bytesAfter = avail - len;
        const value = prop.data.subarray(start, start + len);
        const b = client.startReply(padLength(len) / 4, prop.format);
        b.writeUInt32LE(prop.type >>> 0, 8);
        b.writeUInt32LE(bytesAfter >>> 0, 12);
        b.writeUInt32LE(len / (prop.format >> 3), 16);
        value.copy(b, 32);
        client.send(b);
        if (del && bytesAfter === 0) {
            win.properties.delete(atom);
            propertyNotify(server, win, atom, 1);
        }
    };

    // ListProperties (21)
    h[21] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const atoms = [...win.properties.keys()];
        const b = client.startReply(atoms.length, 0);
        b.writeUInt16LE(atoms.length, 8);
        for (let i = 0; i < atoms.length; i++)
            b.writeUInt32LE(atoms[i] >>> 0, 32 + i * 4);
        client.send(b);
    };

    // RotateProperties (114)
    h[114] = (client, detail, body) => {
        const win = server.getWindow(body.readUInt32LE(0));
        const n = body.readUInt16LE(4);
        const delta = body.readInt16LE(6);
        const atoms = [];
        for (let i = 0; i < n; i++)
            atoms.push(body.readUInt32LE(8 + i * 4));
        for (const atom of atoms) {
            server.checkAtom(atom);
            if (!win.properties.has(atom))
                throw new XError(codes.Match, atom);
        }
        if (n === 0 || ((delta % n) + n) % n === 0)
            return;
        const old = atoms.map(a => win.properties.get(a));
        for (let i = 0; i < n; i++) {
            win.properties.set(atoms[i], old[(((i + delta) % n) + n) % n]);
            propertyNotify(server, win, atoms[i], 0);
        }
    };

    // SetSelectionOwner (22)
    h[22] = (client, detail, body) => {
        const ownerWid = body.readUInt32LE(0);
        const selection = body.readUInt32LE(4);
        let time = body.readUInt32LE(8);
        server.checkAtom(selection);
        if (!time)
            time = server.now();
        const prev = server.selections.get(selection);
        if (ownerWid === 0) {
            server.selections.delete(selection);
        } else {
            server.getWindow(ownerWid); // validate
            server.selections.set(selection, { wid: ownerWid, client, time });
        }
        if (prev && prev.client.alive && (ownerWid === 0 || prev.wid !== ownerWid))
            prev.client.sendEvent(builders.selectionClear(time, prev.wid, selection));
    };

    // GetSelectionOwner (23)
    h[23] = (client, detail, body) => {
        const selection = body.readUInt32LE(0);
        server.checkAtom(selection);
        const owner = server.selections.get(selection);
        const b = client.startReply(0, 0);
        b.writeUInt32LE(owner ? owner.wid >>> 0 : 0, 8);
        client.send(b);
    };

    // ConvertSelection (24)
    h[24] = (client, detail, body) => {
        const requestor = body.readUInt32LE(0);
        const selection = body.readUInt32LE(4);
        const target = body.readUInt32LE(8);
        const property = body.readUInt32LE(12);
        let time = body.readUInt32LE(16);
        server.getWindow(requestor);
        server.checkAtom(selection);
        server.checkAtom(target);
        if (!time)
            time = server.now();
        const owner = server.selections.get(selection);
        if (owner && owner.client.alive) {
            owner.client.sendEvent(builders.selectionRequest(
                time, owner.wid, requestor, selection, target, property));
        } else {
            // refuse: SelectionNotify with property None to the requestor
            client.sendEvent(builders.selectionNotify(time, requestor, selection, target, 0));
        }
    };

    // SendEvent (25)
    h[25] = (client, propagate, body) => {
        const destination = body.readUInt32LE(0);
        const sendMask = body.readUInt32LE(4);
        const raw = Buffer.from(body.subarray(8, 40));
        raw[0] |= 0x80; // send_event flag
        let win;
        if (destination === 0)          // PointerWindow
            win = server.pointerWindow();
        else if (destination === 1) {   // InputFocus
            const f = server.focus.wid;
            win = (f === 1 || f === 0) ? server.pointerWindow() : server.getWindow(f);
        } else
            win = server.getWindow(destination);
        if (sendMask === 0) {
            if (win.owner && win.owner.alive)
                win.owner.sendEvent(raw);
            return;
        }
        let target = win;
        for (;;) {
            const sent = deliver(target, sendMask, raw);
            if (sent.length || !propagate || !target.parent)
                break;
            target = target.parent;
        }
    };
}

module.exports = { install };
