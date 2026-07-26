'use strict';

// Cursors (93-97), extension queries (98-99), screen saver / hosts / access
// control stubs (107-112, 115), KillClient (113), GrabServer/UngrabServer
// (36-37) and NoOperation (127).

const { XError, codes } = require('./errors');
const { padLength } = require('./util');

function checkCursor(server, xid) {
    const res = server.resources.get(xid);
    if (!res || res.type !== 'cursor')
        throw new XError(codes.Cursor, xid);
    return res;
}

function install(server) {
    const h = server.handlers;

    // GrabServer (36) / UngrabServer (37): single-threaded server, no-op
    h[36] = () => {};
    h[37] = () => {};

    // CreateCursor (93)
    h[93] = (client, detail, body) => {
        const cid = body.readUInt32LE(0);
        server.checkIdFree(client, cid);
        server.resources.set(cid, {
            type: 'cursor',
            id: cid,
            owner: client,
            source: body.readUInt32LE(4),
            mask: body.readUInt32LE(8),
            fore: [body.readUInt16LE(12), body.readUInt16LE(14), body.readUInt16LE(16)],
            back: [body.readUInt16LE(18), body.readUInt16LE(20), body.readUInt16LE(22)],
            x: body.readUInt16LE(24),
            y: body.readUInt16LE(26)
        });
    };

    // CreateGlyphCursor (94)
    h[94] = (client, detail, body) => {
        const cid = body.readUInt32LE(0);
        server.checkIdFree(client, cid);
        server.resources.set(cid, {
            type: 'cursor',
            id: cid,
            owner: client,
            sourceFont: body.readUInt32LE(4),
            maskFont: body.readUInt32LE(8),
            sourceChar: body.readUInt16LE(12),
            maskChar: body.readUInt16LE(14),
            fore: [body.readUInt16LE(16), body.readUInt16LE(18), body.readUInt16LE(20)],
            back: [body.readUInt16LE(22), body.readUInt16LE(24), body.readUInt16LE(26)]
        });
    };

    // FreeCursor (95)
    h[95] = (client, detail, body) => {
        const cursor = checkCursor(server, body.readUInt32LE(0));
        server.resources.delete(cursor.id);
    };

    // RecolorCursor (96)
    h[96] = (client, detail, body) => {
        const cursor = checkCursor(server, body.readUInt32LE(0));
        cursor.fore = [body.readUInt16LE(4), body.readUInt16LE(6), body.readUInt16LE(8)];
        cursor.back = [body.readUInt16LE(10), body.readUInt16LE(12), body.readUInt16LE(14)];
    };

    // QueryBestSize (97)
    h[97] = (client, klass, body) => {
        server.getDrawable(body.readUInt32LE(0));
        const b = client.startReply(0, 0);
        b.writeUInt16LE(body.readUInt16LE(4), 8);
        b.writeUInt16LE(body.readUInt16LE(6), 10);
        client.send(b);
    };

    // QueryExtension (98)
    h[98] = (client, detail, body) => {
        const nameLen = body.readUInt16LE(0);
        const name = body.toString('latin1', 4, 4 + nameLen);
        const ext = server.extensions.get(name);
        const b = client.startReply(0, 0);
        if (ext) {
            b[8] = 1;
            b[9] = ext.majorOpcode;
            b[10] = ext.firstEvent;
            b[11] = ext.firstError;
        }
        client.send(b);
    };

    // ListExtensions (99)
    h[99] = client => {
        const names = [...server.extensions.keys()];
        let strLen = 0;
        for (const n of names)
            strLen += 1 + n.length;
        const b = client.startReply(padLength(strLen) / 4, names.length);
        let off = 32;
        for (const n of names) {
            b[off++] = n.length;
            b.write(n, off, 'latin1');
            off += n.length;
        }
        client.send(b);
    };

    // SetScreenSaver (107)
    h[107] = (client, detail, body) => {
        const ss = server.screenSaver;
        const timeout = body.readInt16LE(0);
        const interval = body.readInt16LE(2);
        if (timeout >= 0)
            ss.timeout = timeout;
        if (interval >= 0)
            ss.interval = interval;
        const preferBlanking = body.readUInt8(4);
        const allowExposures = body.readUInt8(5);
        if (preferBlanking !== 2)
            ss.preferBlanking = preferBlanking;
        if (allowExposures !== 2)
            ss.allowExposures = allowExposures;
    };

    // GetScreenSaver (108)
    h[108] = client => {
        const ss = server.screenSaver;
        const b = client.startReply(0, 0);
        b.writeInt16LE(ss.timeout, 8);
        b.writeInt16LE(ss.interval, 10);
        b[12] = ss.preferBlanking;
        b[13] = ss.allowExposures;
        client.send(b);
    };

    // ChangeHosts (109): access list not enforced
    h[109] = () => {};

    // ListHosts (110)
    h[110] = client => {
        const b = client.startReply(0, 0); // access control disabled
        b.writeUInt16LE(0, 8);             // no hosts
        client.send(b);
    };

    // SetAccessControl (111) / SetCloseDownMode (112)
    h[111] = () => {};
    h[112] = () => {};

    // KillClient (113)
    h[113] = (client, detail, body) => {
        const xid = body.readUInt32LE(0);
        if (xid === 0)
            return; // AllTemporary: nothing retained
        for (const c of server.clients)
            if (((xid & ~c.resourceMask) >>> 0) === c.resourceBase) {
                c.destroy();
                return;
            }
        throw new XError(codes.Value, xid);
    };

    // ForceScreenSaver (115)
    h[115] = (client, mode) => {
        if (mode > 1)
            throw new XError(codes.Value, mode);
        server.emit('screenSaver', mode);
    };

    // NoOperation (127)
    h[127] = () => {};
}

module.exports = { install };
