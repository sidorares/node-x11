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
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 3, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.RedirectWindow = (window, updateType) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLCxxx', [ext.majorOpcode, 1, 3, window, updateType]);
            X.pack_stream.flush();
        }

        ext.RedirectSubwindows = (window, updateType) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLCxxx', [ext.majorOpcode, 2, 3, window, updateType]);
            X.pack_stream.flush();
        }

        ext.UnredirectWindow = window => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 3, 2, window]);
            X.pack_stream.flush();
        }

        ext.UnredirectSubwindows = window => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 4, 2, window]);
            X.pack_stream.flush();
        }

        ext.CreateRegionFromBorderClip = (region, window) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 5, 3, damage, region]);
            X.pack_stream.flush();
        }

        ext.NameWindowPixmap = (window, pixmap) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 6, 3, window, pixmap]);
            X.pack_stream.flush();
        }

        ext.GetOverlayWindow = (window, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 7, 2, window]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return buf.readUInt32LE(0);
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.ReleaseOverlayWindow = window => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 8, 2, window]);
            X.pack_stream.flush();
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
