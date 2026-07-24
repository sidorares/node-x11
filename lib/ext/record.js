// RECORD extension: https://xorg.freedesktop.org/releases/X11R7.7/doc/recordproto/record.txt
// xcb-proto: autogen/proto/record.xml

// A RANGE struct is 24 bytes on the wire:
//   Range8  core_requests   (first, last)                 2
//   Range8  core_replies                                  2
//   ExtRange ext_requests   (Range8 major, Range16 minor) 6
//   ExtRange ext_replies                                  6
//   Range8  delivered_events                              2
//   Range8  device_events                                 2
//   Range8  errors                                        2
//   BOOL    client_started                                1
//   BOOL    client_died                                   1
const RANGE_SIZE = 24;

// range8: {first, last}; extRange: {major: {first, last}, minor: {first, last}}
function range8(r) {
    r = r || {};
    return { first: r.first || 0, last: r.last || 0 };
}

function extRange(r) {
    r = r || {};
    return { major: range8(r.major), minor: range8(r.minor) };
}

function packRange(b, off, range) {
    range = range || {};
    const cr = range8(range.coreRequests);
    b.writeUInt8(cr.first, off);
    b.writeUInt8(cr.last, off + 1);
    const cp = range8(range.coreReplies);
    b.writeUInt8(cp.first, off + 2);
    b.writeUInt8(cp.last, off + 3);
    const er = extRange(range.extRequests);
    b.writeUInt8(er.major.first, off + 4);
    b.writeUInt8(er.major.last, off + 5);
    b.writeUInt16LE(er.minor.first, off + 6);
    b.writeUInt16LE(er.minor.last, off + 8);
    const ep = extRange(range.extReplies);
    b.writeUInt8(ep.major.first, off + 10);
    b.writeUInt8(ep.major.last, off + 11);
    b.writeUInt16LE(ep.minor.first, off + 12);
    b.writeUInt16LE(ep.minor.last, off + 14);
    const de = range8(range.deliveredEvents);
    b.writeUInt8(de.first, off + 16);
    b.writeUInt8(de.last, off + 17);
    const dv = range8(range.deviceEvents);
    b.writeUInt8(dv.first, off + 18);
    b.writeUInt8(dv.last, off + 19);
    const en = range8(range.errors);
    b.writeUInt8(en.first, off + 20);
    b.writeUInt8(en.last, off + 21);
    b.writeUInt8(range.clientStarted ? 1 : 0, off + 22);
    b.writeUInt8(range.clientDied ? 1 : 0, off + 23);
}

function parseRange8(buf, off) {
    return { first: buf.readUInt8(off), last: buf.readUInt8(off + 1) };
}

function parseRange(buf, off) {
    return {
        coreRequests: parseRange8(buf, off),
        coreReplies: parseRange8(buf, off + 2),
        extRequests: {
            major: parseRange8(buf, off + 4),
            minor: { first: buf.readUInt16LE(off + 6), last: buf.readUInt16LE(off + 8) }
        },
        extReplies: {
            major: parseRange8(buf, off + 10),
            minor: { first: buf.readUInt16LE(off + 12), last: buf.readUInt16LE(off + 14) }
        },
        deliveredEvents: parseRange8(buf, off + 16),
        deviceEvents: parseRange8(buf, off + 18),
        errors: parseRange8(buf, off + 20),
        clientStarted: buf.readUInt8(off + 22) !== 0,
        clientDied: buf.readUInt8(off + 23) !== 0
    };
}

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('RECORD', (err, ext) => {

        if (err)
            return callback(err);
        if (!ext.present)
            return callback(new Error('extension not available'));

        // HType: bitmask used in element headers
        ext.HType = {
            FromServerTime: 1,      // bit 0
            FromClientTime: 2,      // bit 1
            FromClientSequence: 4   // bit 2
        };

        // ClientSpec pseudo-clients
        ext.CS = {
            CurrentClients: 1,
            FutureClients: 2,
            AllClients: 3
        };

        // EnableContext reply category (the "data1" byte of each reply)
        ext.Category = {
            FromServer: 0,
            FromClient: 1,
            ClientStarted: 2,
            ClientDied: 3,
            StartOfData: 4,
            EndOfData: 5
        };

        ext.QueryVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(clientMaj, 4);
            b.writeUInt16LE(clientMin, 6);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => [buf.readUInt16LE(0), buf.readUInt16LE(2)],
                cb
            ];
            X.pack_stream.flush();
        };

        // shared body for CreateContext (opcode 1) and RegisterClients (opcode 2)
        const packContextRanges = (minor, context, elementHeader, clientSpecs, ranges) => {
            clientSpecs = clientSpecs || [];
            ranges = ranges || [];
            const len = 20 + clientSpecs.length * 4 + ranges.length * RANGE_SIZE;
            const b = Buffer.alloc(len);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(minor, 1);
            b.writeUInt16LE(len >> 2, 2);
            b.writeUInt32LE(context >>> 0, 4);
            b.writeUInt8(elementHeader || 0, 8);
            // 3 bytes pad
            b.writeUInt32LE(clientSpecs.length, 12);
            b.writeUInt32LE(ranges.length, 16);
            let off = 20;
            clientSpecs.forEach(cs => {
                b.writeUInt32LE(cs >>> 0, off);
                off += 4;
            });
            ranges.forEach(r => {
                packRange(b, off, r);
                off += RANGE_SIZE;
            });
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.CreateContext = (context, elementHeader, clientSpecs, ranges) => {
            X.seq_num++;
            packContextRanges(1, context, elementHeader, clientSpecs, ranges);
        };

        ext.RegisterClients = (context, elementHeader, clientSpecs, ranges) => {
            X.seq_num++;
            packContextRanges(2, context, elementHeader, clientSpecs, ranges);
        };

        ext.UnregisterClients = (context, clientSpecs) => {
            X.seq_num++;
            clientSpecs = clientSpecs || [];
            const len = 12 + clientSpecs.length * 4;
            const b = Buffer.alloc(len);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(len >> 2, 2);
            b.writeUInt32LE(context >>> 0, 4);
            b.writeUInt32LE(clientSpecs.length, 8);
            let off = 12;
            clientSpecs.forEach(cs => {
                b.writeUInt32LE(cs >>> 0, off);
                off += 4;
            });
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.GetContext = (context, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(context >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    // opt === enabled (BOOL, the data1 byte)
                    const num = buf.readUInt32LE(4);
                    const clients = [];
                    // intercepted_clients list begins at reply offset 32 => buf offset 24
                    let off = 24;
                    for (let i = 0; i < num; ++i) {
                        const clientResource = buf.readUInt32LE(off);
                        const numRanges = buf.readUInt32LE(off + 4);
                        off += 8;
                        const ranges = [];
                        for (let j = 0; j < numRanges; ++j) {
                            ranges.push(parseRange(buf, off));
                            off += RANGE_SIZE;
                        }
                        clients.push({ clientResource, ranges });
                    }
                    return {
                        enabled: opt !== 0,
                        elementHeader: buf.readUInt8(0),
                        interceptedClients: clients
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        };

        // EnableContext is a multi-reply request. RECORD keeps sending replies on
        // the connection this is issued on until DisableContext/FreeContext is
        // called (from ANOTHER connection). The connection used here must be
        // dedicated to recording.
        //
        // onData(reply) is invoked for each reply as it arrives; cb(err, replies)
        // fires once EndOfData terminates the series.
        ext.EnableContext = (context, onData, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(context >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, category) => {
                    // category is the data1 byte (ext.Category.*)
                    if (category === ext.Category.EndOfData) {
                        return; // undefined => terminate the multi-reply series
                    }
                    const reply = {
                        category,
                        elementHeader: buf.readUInt8(0),
                        clientSwapped: buf.readUInt8(1) !== 0,
                        xidBase: buf.readUInt32LE(4),
                        serverTime: buf.readUInt32LE(8),
                        recSequenceNum: buf.readUInt32LE(12),
                        // recorded protocol bytes begin at reply offset 32 => buf offset 24
                        data: buf.slice(24)
                    };
                    if (onData)
                        onData(reply);
                    return reply;
                },
                cb,
                true // multi-reply
            ];
            X.pack_stream.flush();
        };

        ext.DisableContext = context => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(context >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.FreeContext = context => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(context >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        // BadContext error (number 0): carries the invalid record context id
        X.errorParsers[ext.firstError + 0] = (error, code, seq, badValue, buf) => {
            error.badContext = badValue;
            error.message = 'RECORD BadContext';
            return error;
        };

        ext.QueryVersion(1, 13, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
};
