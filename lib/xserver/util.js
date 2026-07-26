'use strict';

// Small shared helpers for the server core.

function padLength(len) {
    return (len + 3) & ~3;
}

// X LISTofVALUE parsing: `table` is an ordered array of
// { mask, name, kind } entries (kind: L u32, C card8, c int8, S u16, s i16).
// Every present value occupies 4 bytes; the value sits in the low bits,
// which for the little-endian wire format means at the slot start.
function parseValueList(body, offset, bitmask, table) {
    const values = {};
    let off = offset;
    for (const entry of table) {
        if (!(bitmask & entry.mask))
            continue;
        switch (entry.kind) {
            case 'L': values[entry.name] = body.readUInt32LE(off); break;
            case 'C': values[entry.name] = body.readUInt8(off); break;
            case 'c': values[entry.name] = body.readInt8(off); break;
            case 'S': values[entry.name] = body.readUInt16LE(off); break;
            case 's': values[entry.name] = body.readInt16LE(off); break;
        }
        off += 4;
    }
    return values;
}

module.exports = { padLength, parseValueList };
