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

        ext.ModeFlag = {
            HSyncPositive: 1,
            HSyncNegative: 2,
            VSyncPositive: 4,
            VSyncNegative: 8,
            Interlace: 16,
            DoubleScan: 32,
            CSync: 64,
            CSyncPositive: 128,
            CSyncNegative: 256,
            HSkewPresent: 512,
            BCast: 1024,
            PixelMultiplex: 2048,
            DoubleClock: 4096,
            ClockDivideBy2: 8192
        }

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
                        sizeID : res[4],
                        rotation : res[5],
                        rate : res[6],
                        rates: []
                    };

                    var nSizes = res[3];
                    var nRates = res[7];

                    var screens_len = nSizes << 2;
                    var format = Array(screens_len + 1).join('S');
                    res = buf.unpack(format, 24);
                    info.screens = [];
                    for (i = 0; i < screens_len; i += 4) {
                        info.screens.push({
                            px_width : res[i],
                            px_height : res[i + 1],
                            mm_width : res[i + 2],
                            mm_height : res[i + 3]
                        });
                    }

                    format = Array(nRates + 1).join('S');
                    info.rates = buf.unpack(format, 24 + screens_len * 2);
                    return info;
                },
                cb
            ];

            X.pack_stream.flush();
        },

        ext.GetScreenResources = function(win, cb)
        {
            X.seq_num ++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 8, 2, win]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var i;
                    var pos = 0;
                    var res = buf.unpack('LLSSSSxxxxxxxx');
                    var resources = {
                        timestamp : res[0],
                        config_timestamp : res[1],
                        modeinfos : []
                    };

                    pos += 24;
                    var format = Array(res[2] + 1).join('L');
                    resources.crtcs = buf.unpack(format, pos);
                    pos +=  res[2] << 2;
                    format = Array(res[3] + 1).join('L');
                    resources.outputs = buf.unpack(format, pos);
                    pos +=  res[3] << 2;
                    format = Array(res[4] + 1).join('LSSLSSSSSSSSL');
                    res_modes = buf.unpack(format, pos);
                    pos +=  res[4] << 5;
                    for (i = 0; i < res[4]; i+= 13) {
                        resources.modeinfos.push({
                            id : res_modes[i + 0],
                            width : res_modes[i + 1],
                            height : res_modes[i + 2],
                            dot_clock : res_modes[i + 3],
                            h_sync_start : res_modes[i + 4],
                            h_sync_end : res_modes[i + 5],
                            h_total : res_modes[i + 6],
                            h_skew : res_modes[i + 7],
                            v_sync_start : res_modes[i + 8],
                            v_sync_end : res_modes[i + 9],
                            v_total : res_modes[i + 10],
                            modeflags : res_modes[i + 12],
                            name : buf.slice(pos, pos + res_modes[i + 11]).toString()
                        });

                        pos += res_modes[i + 11];
                    }

                    return resources;
                },
                cb
            ];

            X.pack_stream.flush();
        },
        ext.GetOutputInfo = function(output, ts, cb)
        {
            X.seq_num ++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 9, 3, output, ts ]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var i;
                    var pos = 0;
                    var res = buf.unpack('LLLLCCSSSSS');
                    var info = {
                        timestamp : res[0],
                        crtc : res[1],
                        mm_width : res[2],
                        mm_height : res[3],
                        connection : res[4],
                        subpixelOrder : res[5],
                        preferredModes: res[8]
                    };

                    pos += 28;
                    var format = Array(res[6] + 1).join('L');
                    info.crtcs = buf.unpack(format, pos);
                    pos +=  res[6] << 2;
                    format = Array(res[7] + 1).join('L');
                    info.modes = buf.unpack(format, pos);
                    pos +=  res[7] << 2;
                    format = Array(res[9] + 1).join('L');
                    info.clones = buf.unpack(format, pos);
                    pos +=  res[9] << 2;
                    info.name = buf.slice(pos, pos + res_modes[10]).toString('binary');
                    return info;
                },
                cb
            ];

            X.pack_stream.flush();
        },
        ext.GetCrtcInfo = function(crtc, configTs, cb) {
            X.seq_num ++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 20, 3, crtc, configTs ]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var pos = 0;
                    var res = buf.unpack('LssSSLSSSS');
                    var info = {
                        status : opt,
                        timestamp : res[0],
                        x : res[1],
                        y : res[2],
                        width : res[3],
                        height : res[4],
                        mode : res[5],
                        rotation : res[6],
                        rotations : res[7]
                    };

                    pos += 24;
                    var format = Array(res[8] + 1).join('L');
                    info.output = buf.unpack(format, pos);
                    format = Array(res[9] + 1).join('L');
                    info.possible = buf.unpack(format, pos);
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
            return event;
        };


        ext.QueryVersion(255, 255, function(err, version) {
          if (err) return callback(err);
          ext.major_version = version[0];
          ext.minor_version = version[1];
          callback(null, ext);
        });
    });
}
