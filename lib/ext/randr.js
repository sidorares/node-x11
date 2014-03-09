// http://www.x.org/releases/X11R7.6/doc/randrproto/randrproto.txt

var x11 = require('..');
// TODO: move to templates

exports.requireExt = function(display, callback) 
{
    var X = display.client;
    X.QueryExtension('RANDR', function(err, ext) {  

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

        ext.Rotation = {
            Rotate_0: 1,
            Rotate_90: 2,
            Rotate_180: 4,
            Rotate_270: 8,
            Reflect_X: 16,
            Reflect_Y: 32
        };

        ext.ConfigStatus = {
            Sucess: 0,
            InvalidConfigTime: 1,
            InvalidTime: 2,
            Failed: 3
        };

        ext.SetScreenConfig = function(win, ts, configTs, sizeId, rotation, rate, cb) {
            X.seq_num ++;
            X.pack_stream.pack('CCSLLLSSSS', [ext.majorOpcode, 2, 6, win, ts, configTs, sizeId, rotation, rate, 0]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('LLLSSLL');
                    return {
                        status : opt,
                        newTs : res [0],
                        configTs : res[1],
                        root : res[2],
                        subpixelOrder : res[3]
                    }
                },
                function(err, res) {
                    var err;
                    if (res.status !== 0) {
                        err = new Error('SetScreenConfig error');
                        err.code = res.status;
                    }

                    cb(err, res);
                }
            ];

            X.pack_stream.flush();
        },

        ext.SelectInput = function(win, mask)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLSS', [ext.majorOpcode, 4, 3, win, mask, 0]);
            X.pack_stream.flush();
        },

        ext.GetScreenInfo = function(win, cb) {
            X.seq_num ++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 5, 2, win]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var i, j;
                    var res = buf.unpack('LLLSSSSSS');
                    var info = {
                        rotations : opt,
                        root : res [0],
                        timestamp : res[1],
                        config_timestamp : res[2],
                        nSizes : res[3],
                        sizeID : res[4],
                        rotation : res[5],
                        rate : res[6],
                        nInfo : res[7]
                    };

                    var screens_len = info.nSizes * 4;
                    var format = Array(screens_len + 1).join('S');
                    res = buf.unpack(format, 24);
                    info.screens = [];
                    for (i = 0; i < screens_len; i += 4) {
                        console.log(i);
                        info.screens.push({
                            px_width : res[i],
                            px_height : res[i + 1],
                            mm_width : res[i + 2],
                            mm_height : res[i + 3]
                        });
                    }

                    format = Array(info.nInfo + 1).join('S');
                    res = buf.unpack(format, 24 + screens_len * 2);
                    i = 0, j = 0;
                    for (i = 0, j = 0; i < info.screens.length; ++i, j += res[j] + 1) {
                        info.screens[i].rates = res.slice(j + 1, j + 1 + res[j]);
                    }

                    return info;
                },
                cb
            ];

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
