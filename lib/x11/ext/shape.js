// http://www.x.org/releases/X11R7.6/doc/xextproto/shape.pdf

var x11 = require('..');
// TODO: move to templates

exports.requireExt = function(display, callback) 
{
        function captureStack()
        {
            var err = new Error;
            //err.name = reqName;
            Error.captureStackTrace(err, arguments.callee);
            display.client.seq2stack[display.client.seq_num] = err.stack;
        }

    var X = display.client;
    X.QueryExtension('SHAPE', function(err, ext) {  

        if (!ext.present)
            callback(new Error('extension not available'));

        ext.Kind = { 
            Bounding: 0,
	    Clip: 1,
            Input: 2
        };

        ext.Op = {
            Set: 0,
            Union: 1,
            Intersect: 2,
            Subtract: 3,
            Invert: 4
        }

        ext.QueryVersion = function(cb)
        {
            X.seq_num++;
            captureStack();
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 1]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('SS');                 
                    return res;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.Mask = function( op, kind, window, x, y, bitmap )
        {
            X.seq_num++;
            captureStack();
            X.pack_stream.pack('CCSCCxxLssL', [ext.majorOpcode, 2, 5, op, kind, x, y, bitmap]);
            X.pack_stream.flush();
        }

        ext.SelectInput = function( window, enable )
        {
            X.seq_num++;
            captureStack();
            X.pack_stream.pack('CCSLCxxx', [ext.majorOpcode, 6, 3, window, enable ]);
            X.pack_stream.flush();
        }

        ext.InputSelected = function( window, cb )
        {
            X.seq_num++;
            captureStack();
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 7, 2, window ]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    return opt;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        callback(ext);
   
        /*
        ext.QueryVersion(function(err, version) {
            ext.major = version[0];
            ext.minor = version[1];
            callback(ext);
        });
        */
    });
}
