// PanoramiX/Xinerama protocol: https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/blob/master/specs/xinerama/xinerama.txt

// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('XINERAMA', (err, ext) => {

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
                    return [buf.readUInt16LE(0), buf.readUInt16LE(2)];
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.GetState = (window, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => opt,
                cb
            ];
            X.pack_stream.flush();
        }

        ext.GetScreenCount = (window, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => opt,
                cb
            ];
            X.pack_stream.flush();
        }

        ext.GetScreenSize = (window, screen, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(screen >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        width: buf.readUInt32LE(0),
                        height: buf.readUInt32LE(4)
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.IsActive = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                cb
            ];
            X.pack_stream.flush();
        }

        ext.QueryScreens = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const number = buf.readUInt32LE(0);
                    const screens = [];
                    for (let i = 0; i < number; ++i) {
                        const off = 24 + i * 8;
                        screens.push({
                            x: buf.readInt16LE(off),
                            y: buf.readInt16LE(off + 2),
                            width: buf.readUInt16LE(off + 4),
                            height: buf.readUInt16LE(off + 6)
                        });
                    }
                    return screens;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.QueryVersion(1, 1, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
