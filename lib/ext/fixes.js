// http://www.x.org/releases/X11R7.6/doc/fixesproto/fixesproto.txt

const x11 = require('..');
// TODO: move to templates

function parse_rectangle(buf, pos) {
    if (!pos) {
        pos = 0;
    }

    return {
        x : buf[pos],
        y : buf[pos + 1],
        width : buf[pos + 2],
        height : buf[pos + 3]
    }
}

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('XFIXES', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.QueryVersion = (clientMaj, clientMin, callback) => {
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
                callback
            ];
            X.pack_stream.flush();
        }

        ext.SaveSetMode = { Insert: 0, Delete: 1 };
        ext.SaveSetTarget = { Nearest: 0, Root: 1 };
        ext.SaveSetMap = { Map: 0, Unmap: 1 };

        ext.ChangeSaveSet = (window, mode, target, map) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt8(mode, 4);
            b.writeUInt8(target, 5);
            b.writeUInt8(map, 6);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.WindowRegionKind = {
            Bounding : 0,
            Clip : 1
        };

        ext.CreateRegion = (region, rects) => {
            X.seq_num ++;
            const b = Buffer.alloc(8 + rects.length * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(2 + (rects.length << 1), 2);
            b.writeUInt32LE(region >>> 0, 4);
            let off = 8;
            rects.forEach(rect => {
                b.writeInt16LE(rect.x, off);
                b.writeInt16LE(rect.y, off + 2);
                b.writeUInt16LE(rect.width, off + 4);
                b.writeUInt16LE(rect.height, off + 6);
                off += 8;
            });
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.CreateRegionFromWindow = (region, wid, kind) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeUInt32LE(wid >>> 0, 8);
            b.writeUInt8(kind, 12);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.DestroyRegion = region => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(10, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(region >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.UnionRegion = (src1, src2, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(13, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(src1 >>> 0, 4);
            b.writeUInt32LE(src2 >>> 0, 8);
            b.writeUInt32LE(dst >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.TranslateRegion = (region, dx, dy) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(17, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeInt16LE(dx, 8);
            b.writeInt16LE(dy, 10);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.FetchRegion = (region, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(19, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(region >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const n_rectangles = (buf.length - 24) >> 3;
                    const res = [
                        buf.readInt16LE(0),
                        buf.readInt16LE(2),
                        buf.readUInt16LE(4),
                        buf.readUInt16LE(6)
                    ];
                    for (let i = 0; i < n_rectangles; ++i) {
                        const off = 24 + i * 8;
                        res.push(
                            buf.readInt16LE(off),
                            buf.readInt16LE(off + 2),
                            buf.readUInt16LE(off + 4),
                            buf.readUInt16LE(off + 6)
                        );
                    }
                    const reg = {
                        extents : parse_rectangle(res),
                        rectangles : []
                    };

                    for (let i = 0; i < n_rectangles; ++ i) {
                        reg.rectangles.push(parse_rectangle(res, 4 + (i << 2)));
                    }

                    return reg;
                },
                cb
            ];

            X.pack_stream.flush();
        }

        ext.QueryVersion(5, 0, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });

        ext.events = {
            DamageNotify: 0
        }

        X.eventParsers[ext.firstEvent + ext.events.DamageNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.level = code;
            event.seq = seq;
            event.drawable = extra;
            event.damage = raw.readUInt32LE(0);
            event.time = raw.readUInt32LE(4);
            event.area = {
              x: raw.readInt16LE(8),
              y: raw.readInt16LE(10),
              w: raw.readUInt16LE(12),
              h: raw.readUInt16LE(14)
            };
            event.geometry = {
              x: raw.readInt16LE(16),
              y: raw.readInt16LE(18),
              w: raw.readUInt16LE(20),
              h: raw.readUInt16LE(22)
            };
            event.name = 'DamageNotify';
            return event;
        };
    });
}
