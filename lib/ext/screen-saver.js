// http://www.x.org/releases/X11R7.6/doc/scrnsaverproto/saver.pdf

const x11 = require('..');
// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('MIT-SCREEN-SAVER', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));


        ext.QueryVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            X.pack_stream.pack('CCSCCxx', [ext.majorOpcode, 0, 2, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const res = buf.unpack('CC');
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

        ext.QueryInfo = (drawable, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 1, 2, drawable]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const info = {};
                    info.state = opt;
                    const res = buf.unpack('LLLLC');
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

        ext.SelectInput = (drawable, eventMask) => {
            X.seq_num++;
            console.log('CCSLL', [ext.majorOpcode, 2, 3, drawable, eventMask]);
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 2, 3, drawable, eventMask]);
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
            ScreenSaverNotify: 0
        }

        ext.NotifyState = {
            Off: 0,
            On: 1,
            Cycle: 2
        }

        X.eventParsers[ext.firstEvent + ext.events.ScreenSaverNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.state = code;
            event.seq = seq;
            event.time = extra;
            // CCSL = type, code, seq, extra
            const values = raw.unpack('LLCC');
            event.root = values[0];
            event.saverWindow = values[1];
            event.kind = values[2];
            event.forced = values[1];
            event.name = 'ScreenSaverNotify';
            return event;
        };
    });
}
