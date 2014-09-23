// http://www.x.org/releases/X11R7.6/doc/damageproto/damageproto.txt

var x11 = require('..');
// TODO: move to templates

exports.requireExt = function(display, callback)
{
    var X = display.client;
    X.QueryExtension('DAMAGE', function(err, ext) {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.ReportLevel	= {
            RawRectangles: 0,
	    DeltaRectangles: 1,
            BoundingBox: 2,
            NonEmpty: 3
        };

        ext.QueryVersion = function(clientMaj, clientMin, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 3, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('LL');
                    return res;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.Create = function( damage, drawable, reportlevel )
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLLCxxx', [ext.majorOpcode, 1, 4, damage, drawable, reportlevel]);
            X.pack_stream.flush();
        }

        ext.Destroy = function( damage )
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 2, 3, damage]);
            X.pack_stream.flush();
        }

        ext.Subtract = function(damage, repair, parts)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 3, 4, damage, repair, parts]);
            X.pack_stream.flush();
        }

        ext.Add = function(damage, region)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 4, 3, damage, region]);
            X.pack_stream.flush();
        }

        ext.QueryVersion(1, 1, function(err, vers) {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });

        ext.events = {
            DamageNotify: 0
        }

        X.eventParsers[ext.firstEvent + ext.events.DamageNotify] = function(type, seq, extra, code, raw)
        {
            var event = {};
            event.level = code;
            event.seq = seq;
            event.drawable = extra;
            var values = raw.unpack('LLssSSssSS');
            event.damage = values[0];
            event.time = values[1];
            event.area = {
              x: values[2],
              y: values[3],
              w: values[4],
              h: values[5]
            };
            event.geometry = {
              x: values[6],
              y: values[7],
              w: values[8],
              h: values[9]
            };
            event.name = 'DamageNotify';
            return event;
        };
    });
}
