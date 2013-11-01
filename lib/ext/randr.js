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

        ext.SelectInput = function(win, mask)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLSS', [ext.majorOpcode, 4, 3, win, mask, 0]);
            X.pack_stream.flush();
        },

        X.eventParsers[ext.firstEvent + ext.events.RRScreenChangeNotify] = function(type, seq, extra, code, raw) 
        {
	    var event = {};
	    event.raw = raw;
            event.type = type
	    event.seq = seq;
            event.rotation = code;
            var values = raw.unpack('LLLSSSSSS');
            event.time = extra
            event.configtime = values[0];
            event.root = values[1];
            event.requestWindow = values[2];
            event.sizeId = values[3];
            event.subpixelOrder = values[4];
            event.width = values[5];
            event.height = values[6];
            event.physWidth = values[7];
            event.physHeight = values[8];

            event.name = 'RRScreenChangeNotify';
	    console.log(event);
	    return event;
        };

        callback(ext);
    });
}
