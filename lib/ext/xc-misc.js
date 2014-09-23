// http://www.x.org/releases/X11R7.6/doc/xcmiscproto/xc-misc.pdf

var x11 = require('..');
// TODO: move to templates

exports.requireExt = function(display, callback)
{
    var X = display.client;
    X.QueryExtension('XC-MISC', function(err, ext) {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.QueryVersion = function(clientMaj, clientMin, cb)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSSS', [ext.majorOpcode, 0, 2, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('SS');
                    return res;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.GetXIDRange = function(cb)
        {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 1, 1]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('LL');
                    return {
                        startId: res[0],
                        count: res[1]
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.GetXIDList = function( count, cb )
        {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 2, 2, count]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var numIds = buf.unpack('L')[0];
                    var res = [];
                    for (var i = 0; i < numIds; ++i)
                        res.push(buf.unpack('L', 24+i*4));
                    return res;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.QueryVersion(1, 1, function(err, vers) {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
