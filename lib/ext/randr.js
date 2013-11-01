// http://www.x.org/releases/X11R7.6/doc/randrproto/randrproto.txt

var x11 = require('..');
// TODO: move to templates

exports.requireExt = function(display, callback) 
{
    var X = display.client;
    X.QueryExtension('RANDR', function(err, ext) {  
        debugger;

        if (!ext.present)
            return callback(new Error('extension not available'));

        //ext.ReportLevel	= { 
        //};

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
        },

        ext.events = {
            RRScreenChangeNotify: 0
        },

        ext.NotifyMask = {
            ScreenChange: 1,
            CrtcChange: 2,
            OutputChange: 4,
            OutputProperty: 8,
            All: 15
        };

        ext.SelectInput = function(mask)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 6, 2, mask]);
            X.pack_stream.flush();
        },

        X.eventParsers[ext.firstEvent + ext.events.RRScreenChangeNotify] = function(type, seq, extra, code, raw) 
        {
            var event = {};
            event.level = code;
            event.seq = seq;
            event.rotation = extra; // always 0
            var values = raw.unpack('LLLLSSSSSS');
            event.time = values[0];
            event.configtime = values[1];
            event.root = values[2];
            event.requestWindow = values[3];
            event.sizeId = values[4];
            event.subpixelOrder = values[5];
            event.width = values[6];
            event.height = values[7];
            event.physWidth = values[8];
            event.physHeight = values[9];

            event.name = 'RRScreenChangeNotify';
            return event;
        };

        callback(ext);
    });
}
