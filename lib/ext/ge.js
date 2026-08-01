// Generic Event Extension (X Generic Events, "GE")
// spec: https://www.x.org/releases/X11R7.7/doc/xextproto/geproto.html
// xcb:  autogen/proto/ge.xml
//
// The extension itself only carries a version handshake; its purpose is the
// GenericEvent (type 35) wire event that other extensions (Present, XInput2...)
// use for events longer than 32 bytes.
//
// Event delivery: lib/xcore.js frames type-35 events by their length field
// and dispatches them via X.geEventParsers[extension major opcode]; register
// a parser there to receive an extension's GenericEvents (see present.js).

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('Generic Event Extension', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.QueryVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(clientMaj, 4);
            b.writeUInt16LE(clientMin, 6);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt16LE(0), buf.readUInt16LE(2)];
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // the spec requires clients to negotiate the version before use
        ext.QueryVersion(1, 0, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
