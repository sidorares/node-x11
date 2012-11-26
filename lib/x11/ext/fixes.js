// http://www.x.org/releases/X11R7.6/doc/fixesproto/fixesproto.txt

var x11 = require('..');
// TODO: move to templates

exports.requireExt = function(display, callback) 
{
    var X = display.client;
    X.QueryExtension('XFIXES', function(err, ext) {  

        if (!ext.present)
            return callback(new Error('extension not available'));

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

        ext.SaveSetMode = { Insert: 0, Delete: 1 };
        ext.SaveSetTarget = { Nearest: 0, Root: 1 };
        ext.SaveSetMap = { Map: 0, Unmap: 1 };

        ext.ChangeSaveSet = function(window, mode, target, map) {
            X.seq_num++;
            X.pack_stream.pack('CCSCCxL', [ext.majorOpcode, 1, 3, mode, target, map]);
            X.pack_stream.flush();
        };

        ext.QueryVersion(5, 0, function(err, vers) {
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(ext);
        });

        ext.events = {
            DamageNotify: 0
        }

        X.eventParsers[ext.firstEvent + ext.events.DamageNotify] = function(type, seq, extra, code, raw) 
        {
            var event = {};
            event.level = code;
            event.seq = seq;
            event.drawable = extra;
            var values = raw.unpack('LLssSSssSS');
            event.damage = values[0];
            event.time = values[1];
            event.area = {
              x: values[2],                        
              y: values[3],                        
              w: values[4],                        
              h: values[5]                        
            };
            event.geometry = {
              x: values[6],                        
              y: values[7],                        
              w: values[8],                        
              h: values[9]                        
            };
            event.name = 'DamageNotify';
            return event;
        };
    });
}
