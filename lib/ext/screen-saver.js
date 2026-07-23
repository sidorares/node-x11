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
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt8(clientMaj, 4);
            b.writeUInt8(clientMin, 5);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt8(0), buf.readUInt8(1)];
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
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const info = {};
                    info.state = opt;
                    info.window = buf.readUInt32LE(0);
                    info.until = buf.readUInt32LE(4);
                    info.idle = buf.readUInt32LE(8);
                    info.eventMask = buf.readUInt32LE(12);
                    info.kind = buf.readUInt8(16);
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
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(eventMask >>> 0, 8);
            X.pack_stream.put(b);
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

        X.eventParsers[ext.firstEvent + ext.events.ScreenSaverNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.state = code;
            event.seq = seq;
            event.time = extra;
            // CCSL = type, code, seq, extra
            event.root = raw.readUInt32LE(0);
            event.saverWindow = raw.readUInt32LE(4);
            event.kind = raw.readUInt8(8);
            event.forced = raw.readUInt32LE(4);
            event.name = 'ScreenSaverNotify';
            return event;
        };
    });
}
