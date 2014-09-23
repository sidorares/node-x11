// http://www.x.org/releases/X11R7.6/doc/scrnsaverproto/saver.pdf

var x11 = require('..');
// TODO: move to templates

exports.requireExt = function(display, callback)
{
    var X = display.client;
    X.QueryExtension('MIT-SCREEN-SAVER', function(err, ext) {

        if (!ext.present)
            return callback(new Error('extension not available'));


        ext.QueryVersion = function(clientMaj, clientMin, cb)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSCCxx', [ext.majorOpcode, 0, 2, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('CC');
                    return res;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.State = {
            Off: 0,
	    On: 1,
            Disabled: 2
        };

        ext.Kind = {
            Blanked: 0,
	    Internal: 1,
            External: 2
        };

        ext.QueryInfo = function(drawable, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 1, 2, drawable]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var info = {};
                    info.state = opt;
                    var res = buf.unpack('LLLLC');
                    info.window = res[0];
                    info.until = res[1];
                    info.idle = res[2];
                    info.eventMask = res[3];
                    info.kind = res[4]
                    return info;
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.eventMask = {
            Notify: 1,
            Cycle: 2
        };

        ext.SelectInput = function( drawable, eventMask )
        {
            X.seq_num++;
            console.log('CCSLL', [ext.majorOpcode, 2, 3, drawable, eventMask]);
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 2, 3, drawable, eventMask]);
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
            ScreenSaverNotify: 0
        }

        ext.NotifyState = {
            Off: 0,
            On: 1,
            Cycle: 2
        }

        X.eventParsers[ext.firstEvent + ext.events.ScreenSaverNotify] = function(type, seq, extra, code, raw)
        {
            var event = {};
            event.state = code;
            event.seq = seq;
            event.time = extra;
            // CCSL = type, code, seq, extra
            var values = raw.unpack('LLCC');
            event.root = values[0];
            event.saverWindow = values[1];
            event.kind = values[2];
            event.forced = values[1];
            event.name = 'ScreenSaverNotify';
            return event;
        };
    });
}
