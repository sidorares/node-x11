// http://www.x.org/releases/X11R7.6/doc/damageproto/damageproto.txt

var x11 = require('..');
// TODO: move to templates

/*
#define X_DamageQueryVersion            0
#define X_DamageCreate                  1
#define X_DamageDestroy                 2
#define X_DamageSubtract                3
#define X_DamageAdd                     4
*/

exports.requireExt = function(display, callback) 
{
    var X = display.client;
    X.QueryExtension('DAMAGE', function(err, ext) {  

        if (!ext.present)
            callback(new Error('extension not available'));

        ext.ReportLevel	= { 
            RawRectangles: 0,
	    DeltaRectangles: 1,
            BoundingBox: 2,
            NonEmpty: 3 
        };

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

        ext.Create = function( damage, drawable, reportlevel )
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLLCxxx', [ext.majorOpcode, 1, 4, damage, drawable, reportlevel]);
            X.pack_stream.flush();
        }

        ext.Destroy = function( damage )
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 2, 3, damage]);
            X.pack_stream.flush();
        }

        ext.Subtract = function(damage, repair, parts)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 3, 4, damage, repair, parts]);
            X.pack_stream.flush();
        }

        ext.Add = function(damage, region)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 4, 3, damage, region]);
            X.pack_stream.flush();
        }
        
        ext.QueryVersion(1, 1, function(err, vers) {
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(ext);
        });
    });
}
