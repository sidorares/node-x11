// Present extension
// spec: https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/blob/master/presentproto.txt
// xcb:  https://gitlab.freedesktop.org/xorg/proto/xcbproto/-/blob/master/src/present.xml
//
// NOTE on events: Present has no classic (32-byte) events. All of its events
// (ConfigureNotify, CompleteNotify, IdleNotify) are delivered as X Generic
// Events (type 35, byte 1 = Present major opcode, variable length) and are
// dispatched through X.geEventParsers, keyed by major opcode.

// 64-bit protocol fields (target_msc, divisor, remainder) are plain JS
// numbers composed from two 32-bit halves; values above 2^53 - 1 lose
// precision (irrelevant in practice for msc counters).
const writeUInt64LE = (b, value, offset) => {
    const lo = value % 0x100000000;
    const hi = Math.floor(value / 0x100000000);
    b.writeUInt32LE(lo >>> 0, offset);
    b.writeUInt32LE(hi >>> 0, offset + 4);
};

const readUInt64LE = (b, offset) =>
    b.readUInt32LE(offset + 4) * 0x100000000 + b.readUInt32LE(offset);

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('Present', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.EventMask = {
            NoEvent: 0,
            ConfigureNotify: 1,
            CompleteNotify: 2,
            IdleNotify: 4,
            RedirectNotify: 8
        };

        ext.Option = {
            None: 0,
            Async: 1,
            Copy: 2,
            UST: 4,
            Suboptimal: 8
        };

        ext.Capability = {
            None: 0,
            Async: 1,
            Fence: 2,
            UST: 4
        };

        ext.CompleteKind = {
            Pixmap: 0,
            NotifyMSC: 1
        };

        ext.CompleteMode = {
            Copy: 0,
            Flip: 1,
            Skip: 2,
            SuboptimalCopy: 3
        };

        ext.QueryVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(clientMaj >>> 0, 4);
            b.writeUInt32LE(clientMin >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // PresentPixmap: copy `pixmap` to `window` at the target msc.
        // opts (all optional): serial, valid, update (XFIXES regions), xOff,
        // yOff, targetCrtc, waitFence, idleFence (SYNC fences), options
        // (ext.Option mask), targetMsc, divisor, remainder,
        // notifies ([{window, serial}, ...]).
        ext.Pixmap = (window, pixmap, opts) => {
            if (opts === undefined)
                opts = {};
            const notifies = opts.notifies || [];
            X.seq_num++;
            const b = Buffer.alloc(72 + notifies.length * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(18 + notifies.length * 2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(pixmap >>> 0, 8);
            b.writeUInt32LE((opts.serial || 0) >>> 0, 12);
            b.writeUInt32LE((opts.valid || 0) >>> 0, 16);
            b.writeUInt32LE((opts.update || 0) >>> 0, 20);
            b.writeInt16LE(opts.xOff || 0, 24);
            b.writeInt16LE(opts.yOff || 0, 26);
            b.writeUInt32LE((opts.targetCrtc || 0) >>> 0, 28);
            b.writeUInt32LE((opts.waitFence || 0) >>> 0, 32);
            b.writeUInt32LE((opts.idleFence || 0) >>> 0, 36);
            b.writeUInt32LE((opts.options || 0) >>> 0, 40);
            // 4 bytes pad at 44
            writeUInt64LE(b, opts.targetMsc || 0, 48);
            writeUInt64LE(b, opts.divisor || 0, 56);
            writeUInt64LE(b, opts.remainder || 0, 64);
            let off = 72;
            notifies.forEach(n => {
                b.writeUInt32LE(n.window >>> 0, off);
                b.writeUInt32LE((n.serial || 0) >>> 0, off + 4);
                off += 8;
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // Request a CompleteNotify(kind=NotifyMSC) event when the msc reaches
        // target_msc (clients that selected CompleteNotify on `window`).
        ext.NotifyMSC = (window, serial, targetMsc, divisor, remainder) => {
            X.seq_num++;
            const b = Buffer.alloc(40);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(10, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE((serial || 0) >>> 0, 8);
            // 4 bytes pad at 12
            writeUInt64LE(b, targetMsc || 0, 16);
            writeUInt64LE(b, divisor || 0, 24);
            writeUInt64LE(b, remainder || 0, 32);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // eid is a fresh XID (X.AllocID()) naming the event context;
        // eventMask is a mask of ext.EventMask values. Events arrive on the
        // client as GenericEvents parsed by the registrations below.
        ext.SelectInput = (eid, window, eventMask) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(eid >>> 0, 4);
            b.writeUInt32LE(window >>> 0, 8);
            b.writeUInt32LE((eventMask || 0) >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // target is a window (or RandR crtc); returns an ext.Capability mask
        ext.QueryCapabilities = (target, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(target >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                cb
            ];
            X.pack_stream.submit(true);
        }

        // GenericEvent parsers; raw is the event from byte 8 on, so absolute
        // struct offsets (presentproto.h) minus 8. evtype is raw bytes 0-1.
        ext.events = {
            ConfigureNotify: 0,
            CompleteNotify: 1,
            IdleNotify: 2
        };

        X.geEventParsers[ext.majorOpcode] = (type, seq, extra, code, raw) => {
            const evtype = raw.readUInt16LE(0);
            const event = {
                type: type,
                seq: seq,
                extension: code,
                evtype: evtype,
                eid: raw.readUInt32LE(4),
                wid: raw.readUInt32LE(8),
                window: raw.readUInt32LE(8)
            };
            switch (evtype) {
            case ext.events.ConfigureNotify:
                event.name = 'PresentConfigureNotify';
                event.x = raw.readInt16LE(12);
                event.y = raw.readInt16LE(14);
                event.width = raw.readUInt16LE(16);
                event.height = raw.readUInt16LE(18);
                event.offX = raw.readInt16LE(20);
                event.offY = raw.readInt16LE(22);
                event.pixmapWidth = raw.readUInt16LE(24);
                event.pixmapHeight = raw.readUInt16LE(26);
                event.pixmapFlags = raw.readUInt32LE(28);
                break;
            case ext.events.CompleteNotify:
                event.name = 'PresentCompleteNotify';
                event.kind = raw.readUInt8(2);
                event.mode = raw.readUInt8(3);
                event.serial = raw.readUInt32LE(12);
                event.ust = readUInt64LE(raw, 16);
                event.msc = readUInt64LE(raw, 24);
                break;
            case ext.events.IdleNotify:
                event.name = 'PresentIdleNotify';
                event.serial = raw.readUInt32LE(12);
                event.pixmap = raw.readUInt32LE(16);
                event.idleFence = raw.readUInt32LE(20);
                break;
            default:
                event.name = 'PresentGenericEvent';
                event.raw = raw;
            }
            return event;
        };

        // the spec requires clients to negotiate the version before use
        ext.QueryVersion(1, 2, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
