// http://www.x.org/releases/X11R7.6/doc/damageproto/damageproto.txt

const x11 = require('..');
// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('DAMAGE', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.ReportLevel	= {
            RawRectangles: 0,
	    DeltaRectangles: 1,
            BoundingBox: 2,
            NonEmpty: 3
        };

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
            X.pack_stream.submit(true);
        }

        ext.Create = (damage, drawable, reportlevel) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(damage >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            b.writeUInt8(reportlevel, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.Destroy = damage => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(damage >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.Subtract = (damage, repair, parts) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(damage >>> 0, 4);
            b.writeUInt32LE(repair >>> 0, 8);
            b.writeUInt32LE(parts >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.Add = (damage, region) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(damage >>> 0, 4);
            b.writeUInt32LE(region >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.QueryVersion(1, 1, (err, vers) => {
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
