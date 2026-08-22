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
                    // server major/minor are CARD16 at reply offsets 8 and 10
                    return [buf.readUInt16LE(0), buf.readUInt16LE(2)];
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.State = {
            Off: 0,
            On: 1,
            Cycle: 2,
            Disabled: 3
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
            X.pack_stream.submit(true);
        }

        ext.eventMask = {
            Notify: 1,
            Cycle: 2
        };

        ext.SelectInput = (drawable, eventMask) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(eventMask >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // Window attribute value-mask bits (same set as core CreateWindow /
        // ChangeWindowAttributes), packed in ascending mask order, 4 bytes each.
        const attributeMask = [
            ['backgroundPixmap',   0x00000001],
            ['backgroundPixel',    0x00000002],
            ['borderPixmap',       0x00000004],
            ['borderPixel',        0x00000008],
            ['bitGravity',         0x00000010],
            ['winGravity',         0x00000020],
            ['backingStore',       0x00000040],
            ['backingPlanes',      0x00000080],
            ['backingPixel',       0x00000100],
            ['overrideRedirect',   0x00000200],
            ['saveUnder',          0x00000400],
            ['eventMask',          0x00000800],
            ['doNotPropagateMask', 0x00001000],
            ['colormap',           0x00002000],
            ['cursor',             0x00004000]
        ];

        // windowClass/depth/visual: 0 = CopyFromParent
        // values: optional object with CreateWindow-style attribute names
        ext.SetAttributes = (drawable, x, y, width, height, borderWidth, windowClass, depth, visual, values) => {
            const list = [];
            let mask = 0;
            if (values) {
                for (let i = 0; i < attributeMask.length; ++i) {
                    const name = attributeMask[i][0];
                    if (name in values) {
                        mask |= attributeMask[i][1];
                        list.push(values[name]);
                    }
                }
            }
            X.seq_num++;
            const b = Buffer.alloc(28 + list.length * 4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(7 + list.length, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeInt16LE(x, 8);
            b.writeInt16LE(y, 10);
            b.writeUInt16LE(width, 12);
            b.writeUInt16LE(height, 14);
            b.writeUInt16LE(borderWidth, 16);
            b.writeUInt8(windowClass, 18);
            b.writeUInt8(depth, 19);
            b.writeUInt32LE(visual >>> 0, 20);
            b.writeUInt32LE(mask >>> 0, 24);
            for (let i = 0; i < list.length; ++i)
                b.writeUInt32LE(list[i] >>> 0, 28 + i * 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.UnsetAttributes = drawable => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // suspend is a bool; suspensions of one client are counted by the
        // server, so always pair Suspend(true) with a later Suspend(false)
        ext.Suspend = suspend => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(suspend ? 1 : 0, 4);
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
            ScreenSaverNotify: 0
        }

        X.eventParsers[ext.firstEvent + ext.events.ScreenSaverNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.type = type;
            event.state = code;
            event.seq = seq;
            event.time = extra;
            // CCSL = type, code, seq, extra
            event.root = raw.readUInt32LE(0);
            event.saverWindow = raw.readUInt32LE(4);
            event.kind = raw.readUInt8(8);
            event.forced = raw.readUInt8(9);
            event.name = 'ScreenSaverNotify';
            return event;
        };
    });
}
