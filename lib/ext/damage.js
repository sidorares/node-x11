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
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 3, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.Create = (damage, drawable, reportlevel) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLLCxxx', [ext.majorOpcode, 1, 4, damage, drawable, reportlevel]);
            X.pack_stream.flush();
        }

        ext.Destroy = damage => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 2, 3, damage]);
            X.pack_stream.flush();
        }

        ext.Subtract = (damage, repair, parts) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 3, 4, damage, repair, parts]);
            X.pack_stream.flush();
        }

        ext.Add = (damage, region) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 4, 3, damage, region]);
            X.pack_stream.flush();
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
