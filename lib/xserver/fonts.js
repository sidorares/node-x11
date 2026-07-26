'use strict';

// Fonts (opcodes 45-52): every font name resolves to the built-in 8x8 font.

const font8x8 = require('./font8x8');
const { XError, codes } = require('./errors');
const { padLength } = require('./util');

const FONT_NAME = 'fixed';

class Font {
    constructor(id, name, owner) {
        this.type = 'font';
        this.id = id;
        this.name = name;
        this.owner = owner;
    }
}

// 12-byte CHARINFO for the 8x8 font (identical min and max bounds)
function writeCharInfo(b, off) {
    b.writeInt16LE(0, off);                      // left side bearing
    b.writeInt16LE(font8x8.WIDTH, off + 2);      // right side bearing
    b.writeInt16LE(font8x8.WIDTH, off + 4);      // character width
    b.writeInt16LE(font8x8.ASCENT, off + 6);
    b.writeInt16LE(font8x8.DESCENT, off + 8);
    b.writeUInt16LE(0, off + 10);                // attributes
}

// shared QueryFont / ListFontsWithInfo fixed part: reply bytes 8..59
function writeFontInfo(b) {
    writeCharInfo(b, 8);                         // min bounds (+4 pad)
    writeCharInfo(b, 24);                        // max bounds (+4 pad)
    b.writeUInt16LE(0, 40);                      // min char
    b.writeUInt16LE(127, 42);                    // max char
    b.writeUInt16LE(32, 44);                     // default char
    b.writeUInt16LE(0, 46);                      // n font properties
    b[48] = 0;                                   // draw direction LTR
    b[49] = 0;                                   // min byte1
    b[50] = 0;                                   // max byte1
    b[51] = 1;                                   // all chars exist
    b.writeInt16LE(font8x8.ASCENT, 52);
    b.writeInt16LE(font8x8.DESCENT, 54);
}

function install(server) {
    const h = server.handlers;

    // OpenFont (45)
    h[45] = (client, detail, body) => {
        const fid = body.readUInt32LE(0);
        const nameLen = body.readUInt16LE(4);
        const name = body.toString('latin1', 8, 8 + nameLen);
        server.checkIdFree(client, fid);
        server.resources.set(fid, new Font(fid, name, client));
    };

    // CloseFont (46)
    h[46] = (client, detail, body) => {
        const xid = body.readUInt32LE(0);
        const res = server.resources.get(xid);
        if (!res || res.type !== 'font')
            throw new XError(codes.Font, xid);
        server.resources.delete(xid);
    };

    // QueryFont (47): fontable is a font or a gc
    h[47] = (client, detail, body) => {
        const xid = body.readUInt32LE(0);
        const res = server.resources.get(xid);
        if (!res || (res.type !== 'font' && res.type !== 'gc'))
            throw new XError(codes.Font, xid);
        const b = client.startReply(7, 0);           // 60-byte reply, no props/charinfos
        writeFontInfo(b);
        b.writeUInt32LE(0, 56);                      // n charinfos
        client.send(b);
    };

    // QueryTextExtents (48)
    h[48] = (client, oddLength, body) => {
        const xid = body.readUInt32LE(0);
        const res = server.resources.get(xid);
        if (!res || (res.type !== 'font' && res.type !== 'gc'))
            throw new XError(codes.Font, xid);
        let nchars = (body.length - 4) >> 1;
        if (oddLength)
            nchars -= 1;
        const width = nchars * font8x8.WIDTH;
        const b = client.startReply(0, 0);           // draw direction LTR
        b.writeInt16LE(font8x8.ASCENT, 8);
        b.writeInt16LE(font8x8.DESCENT, 10);
        b.writeInt16LE(font8x8.ASCENT, 12);          // overall ascent
        b.writeInt16LE(font8x8.DESCENT, 14);         // overall descent
        b.writeInt32LE(width, 16);                   // overall width
        b.writeInt32LE(0, 20);                       // overall left
        b.writeInt32LE(width, 24);                   // overall right
        client.send(b);
    };

    // ListFonts (49)
    h[49] = (client, detail, body) => {
        const max = body.readUInt16LE(0);
        const names = max > 0 ? [FONT_NAME] : [];
        let strLen = 0;
        for (const n of names)
            strLen += 1 + n.length;
        const b = client.startReply(padLength(strLen) / 4, 0);
        b.writeUInt16LE(names.length, 8);
        let off = 32;
        for (const n of names) {
            b[off++] = n.length;
            b.write(n, off, 'latin1');
            off += n.length;
        }
        client.send(b);
    };

    // ListFontsWithInfo (50): one reply for "fixed", then a terminator
    h[50] = (client, detail, body) => {
        const max = body.readUInt16LE(0);
        if (max > 0) {
            const nameLen = FONT_NAME.length;
            const b = client.startReply(7 + padLength(nameLen) / 4, nameLen);
            writeFontInfo(b);
            b.writeUInt32LE(1, 56);                  // replies hint
            b.write(FONT_NAME, 60, 'latin1');
            client.send(b);
        }
        client.send(client.startReply(7, 0));        // terminator: name length 0
    };

    // SetFontPath (51)
    h[51] = () => {};

    // GetFontPath (52)
    h[52] = client => {
        const b = client.startReply(0, 0);
        b.writeUInt16LE(0, 8);                       // no paths
        client.send(b);
    };
}

module.exports = { Font, install };
