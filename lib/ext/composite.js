// /usr/share/doc/x11proto-composite-dev/compositeproto.txt.gz
// http://cgit.freedesktop.org/xorg/proto/compositeproto/plain/compositeproto.txt
//
// /usr/include/X11/extensions/Xcomposite.h       Xlib
// /usr/include/X11/extensions/composite.h        constants
// /usr/include/X11/extensions/compositeproto.h   structs
//
// http://ktown.kde.org/~fredrik/composite_howto.html
//
// server side source:
//     http://cgit.freedesktop.org/xorg/xserver/tree/composite/compext.c
//

const x11 = require('..');
// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('Composite', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.Redirect = {
            Automatic: 0,
	    Manual: 1
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

        ext.RedirectWindow = (window, updateType) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt8(updateType, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.RedirectSubwindows = (window, updateType) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt8(updateType, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.UnredirectWindow = window => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.UnredirectSubwindows = window => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.CreateRegionFromBorderClip = (region, window) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeUInt32LE(window >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.NameWindowPixmap = (window, pixmap) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(pixmap >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.GetOverlayWindow = (window, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return buf.readUInt32LE(0);
                },
                callback
            ];
            X.pack_stream.submit(true);
        }

        ext.ReleaseOverlayWindow = window => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(8, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // currently version 0.4 TODO: bump up with coordinate translations
        ext.QueryVersion(0, 4, (err, vers) => {
            if (err)
                return callback(err);

            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
