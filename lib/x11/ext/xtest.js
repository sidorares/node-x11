// http://www.x.org/releases/X11R7.6/doc/xextproto/xtest.pdf

var x11 = require('..');
// TODO: move to templates
exports.requireExt = function(display, callback) 
{
    var X = display.client;
    X.QueryExtension('XTEST', function(ext) {  

        if (!ext.present)
            callback(new Error('extension not available'));

        ext.QueryVersion = function(clientMaj, clientMin, callback)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 3, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('LL');                 
                    return res;
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

        callback(ext);
    });
}
         
