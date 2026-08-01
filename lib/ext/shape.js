// http://www.x.org/releases/X11R7.6/doc/xextproto/shape.pdf

const x11 = require('..');
// TODO: move to templates

exports.requireExt = (display, callback) => {
        function captureStack()
        {
            const err = new Error;
            //err.name = reqName;
            Error.captureStackTrace(err, arguments.callee);
            display.client.seq2stack[display.client.seq_num] = err.stack;
        }

    const X = display.client;
    X.QueryExtension('SHAPE', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.Kind = {
            Bounding: 0,
            Clip: 1,
            Input: 2
        };

        ext.Op = {
            Set: 0,
            Union: 1,
            Intersect: 2,
            Subtract: 3,
            Invert: 4
        };

        ext.Ordering = {
            Unsorted: 0,
            YSorted: 1,
            YXSorted: 2,
            YXBanded: 3
        };

        ext.QueryVersion = cb => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt16LE(0), buf.readUInt16LE(2)];
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // Accepts rectangles as [[x, y, width, height]]
        ext.Rectangles = (op, kind, window, x, y, rectangles, ordering /* = Ordering.Unsorted */) => {
            if (ordering === undefined)
                ordering = ext.Ordering.Unsorted;

            const length = 4 + rectangles.length * 2;
            const b = Buffer.alloc(16 + rectangles.length * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(length, 2);
            b.writeUInt8(op, 4);
            b.writeUInt8(kind, 5);
            b.writeUInt8(ordering, 6);
            b.writeUInt32LE(window >>> 0, 8);
            b.writeInt16LE(x, 12);
            b.writeInt16LE(y, 14);
            let off = 16;
            for (let i = 0; i < rectangles.length; ++i) {
                const r = rectangles[i];
                b.writeInt16LE(r[0], off);
                b.writeInt16LE(r[1], off + 2);
                b.writeUInt16LE(r[2], off + 4);
                b.writeUInt16LE(r[3], off + 6);
                off += 8;
            }
            X.seq_num++;
//            captureStack();
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.Mask = (op, kind, window, x, y, bitmap) => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt8(op, 4);
            b.writeUInt8(kind, 5);
            b.writeUInt32LE(window >>> 0, 8);
            b.writeInt16LE(x, 12);
            b.writeInt16LE(y, 14);
            b.writeUInt32LE(bitmap >>> 0, 16);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.Combine = (op, destKind, srcKind, destWindow, x, y, srcWindow) => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt8(op, 4);
            b.writeUInt8(destKind, 5);
            b.writeUInt8(srcKind, 6);
            b.writeUInt32LE(destWindow >>> 0, 8);
            b.writeInt16LE(x, 12);
            b.writeInt16LE(y, 14);
            b.writeUInt32LE(srcWindow >>> 0, 16);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.Offset = (kind, window, x, y) => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt8(kind, 4);
            b.writeUInt32LE(window >>> 0, 8);
            b.writeInt16LE(x, 12);
            b.writeInt16LE(y, 14);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.QueryExtents = (window, cb) => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        boundingShaped: !!buf.readUInt8(0),
                        clipShaped: !!buf.readUInt8(1),
                        bounding: {
                            x: buf.readInt16LE(4),
                            y: buf.readInt16LE(6),
                            width: buf.readUInt16LE(8),
                            height: buf.readUInt16LE(10)
                        },
                        clip: {
                            x: buf.readInt16LE(12),
                            y: buf.readInt16LE(14),
                            width: buf.readUInt16LE(16),
                            height: buf.readUInt16LE(18)
                        }
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // Returns { ordering, rectangles: [[x, y, width, height]] }
        ext.GetRectangles = (window, kind, cb) => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(8, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt8(kind, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const nrects = buf.readUInt32LE(0);
                    const rectangles = [];
                    let off = 24; // rectangles start at reply offset 32
                    for (let i = 0; i < nrects; ++i) {
                        rectangles.push([
                            buf.readInt16LE(off),
                            buf.readInt16LE(off + 2),
                            buf.readUInt16LE(off + 4),
                            buf.readUInt16LE(off + 6)
                        ]);
                        off += 8;
                    }
                    return { ordering: opt, rectangles: rectangles };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.SelectInput = (window, enable) => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt8(enable, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.InputSelected = (window, cb) => {
            X.seq_num++;
//            captureStack();
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => opt,
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.events = {
            ShapeNotify: 0
        }

        X.eventParsers[ext.firstEvent + ext.events.ShapeNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.type = type;
            event.kind = code;
            event.seq = seq;

            event.window = extra;

            event.x = raw.readInt16LE(0);
            event.y = raw.readInt16LE(2);
            event.width = raw.readUInt16LE(4);
            event.height = raw.readUInt16LE(6);
            event.time = raw.readUInt32LE(8);
            event.shaped = raw.readUInt8(12);
            event.name = 'ShapeNotify';

            return event;
        };

        callback(null, ext);

        /*
        ext.QueryVersion(function(err, version) {
            ext.major = version[0];
            ext.minor = version[1];
            callback(null, ext);
        });
        */
    });
}
