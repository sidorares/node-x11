// http://www.x.org/releases/X11R7.6/doc/xextproto/xtest.pdf

var x11 = require('..');
// TODO: move to templates
exports.requireExt = function(display, callback)
{
    var X = display.client;
    X.QueryExtension('XTEST', function(err, ext) {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.GetVersion = function(clientMaj, clientMin, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSCxS', [ext.majorOpcode, 0, 2, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('S');
                    // Major version is in byte 1 of Reply Header
                    // Minor version is in the body of the reply
                    return [ opt, res[0] ];
                },
                callback
            ];
            X.pack_stream.flush();
        }

        ext.KeyPress = 2;
        ext.KeyRelease = 3;
        ext.ButtonPress = 4;
        ext.ButtonRelease = 5;
        ext.MotionNotify = 6;

        ext.FakeInput = function( type, keycode, time, wid, x, y )
        {
            X.seq_num++;
            X.pack_stream.pack('CCSCCxxLLxxxxxxxxssxxxxxxxx', [ext.majorOpcode, 2, 9, type, keycode, time, wid, x, y]);
            X.pack_stream.flush();
        }

        callback(null, ext);
    });
}

