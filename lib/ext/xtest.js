// http://www.x.org/releases/X11R7.6/doc/xextproto/xtest.pdf

const x11 = require('..');
// TODO: move to templates
exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('XTEST', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.GetVersion = (clientMaj, clientMin, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt8(clientMaj, 4);
            b.writeUInt16LE(clientMin, 6);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    // Major version is in byte 1 of Reply Header
                    // Minor version is in the body of the reply
                    return [ opt, buf.readUInt16LE(0) ];
                },
                callback
            ];
            X.pack_stream.submit(true);
        }

        ext.Cursor = {
            None: 0,
            Current: 1
        };

        // cursor: a CURSOR id, or Cursor.None to test that the window has no
        // cursor attribute, or Cursor.Current to compare against the cursor
        // currently being displayed. cb(err, same:boolean)
        ext.CompareCursor = (window, cursor, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(cursor >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => !!opt, // "same" is in byte 1 of the reply header
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.KeyPress = 2;
        ext.KeyRelease = 3;
        ext.ButtonPress = 4;
        ext.ButtonRelease = 5;
        ext.MotionNotify = 6;

        ext.FakeInput = (type, keycode, time, wid, x, y) => {
            X.seq_num++;
            const b = Buffer.alloc(36);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(9, 2);
            b.writeUInt8(type, 4);
            b.writeUInt8(keycode, 5);
            b.writeUInt32LE(time >>> 0, 8);
            b.writeUInt32LE(wid >>> 0, 12);
            // rootX/rootY live at offsets 20/22 of the embedded xEvent,
            // i.e. request offsets 24/26 (offsets 32/34 used before were wrong:
            // they fell into padding and MotionNotify always moved to 0,0)
            b.writeInt16LE(x, 24);
            b.writeInt16LE(y, 26);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // impervious=true makes this client immune to server grabs by other
        // clients; ALWAYS pair with a later GrabControl(false)
        ext.GrabControl = impervious => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt8(impervious ? 1 : 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        callback(null, ext);
    });
}
