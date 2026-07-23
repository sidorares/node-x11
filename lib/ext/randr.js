// http://www.x.org/releases/X11R7.6/doc/randrproto/randrproto.txt

const x11 = require('..');
// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('RANDR', (err, ext) => {

        // shared between GetScreenResources and GetOutputInfo unpackers
        let res_modes;

        if (!ext.present)
            return callback(new Error('extension not available'));

        //ext.ReportLevel	= {
        //};

        ext.QueryVersion = (clientMaj, clientMin, callback) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 3, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
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

        ext.SetScreenConfig = (win, ts, configTs, sizeId, rotation, rate, cb) => {
            X.seq_num ++;
            X.pack_stream.pack('CCSLLLSSSS', [ext.majorOpcode, 2, 6, win, ts, configTs, sizeId, rotation, rate, 0]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const res = [
                        buf.readUInt32LE(0),
                        buf.readUInt32LE(4),
                        buf.readUInt32LE(8),
                        buf.readUInt16LE(12),
                        buf.readUInt16LE(14),
                        buf.readUInt16LE(16),
                        buf.readUInt16LE(18)
                    ];
                    return {
                        status : opt,
                        newTs : res [0],
                        configTs : res[1],
                        root : res[2],
                        subpixelOrder : res[3]
                    }
                },
                (err, res) => {
                    if (res.status !== 0) {
                        err = new Error('SetScreenConfig error');
                        err.code = res.status;
                    }

                    cb(err, res);
                }
            ];

            X.pack_stream.flush();
        },

        ext.SelectInput = (win, mask) => {
            X.seq_num++;
            X.pack_stream.pack('CCSLSS', [ext.majorOpcode, 4, 3, win, mask, 0]);
            X.pack_stream.flush();
        },

        ext.GetScreenInfo = (win, cb) => {
            X.seq_num ++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 5, 2, win]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    let i, j;
                    const res = [
                        buf.readUInt32LE(0),
                        buf.readUInt32LE(4),
                        buf.readUInt32LE(8),
                        buf.readUInt16LE(12),
                        buf.readUInt16LE(14),
                        buf.readUInt16LE(16),
                        buf.readUInt16LE(18),
                        buf.readUInt16LE(20),
                        buf.readUInt16LE(22)
                    ];
                    const info = {
                        rotations : opt,
                        root : res [0],
                        timestamp : res[1],
                        config_timestamp : res[2],
                        sizeID : res[4],
                        rotation : res[5],
                        rate : res[6],
                        rates: []
                    };

                    const nSizes = res[3];
                    const nRates = res[7];

                    const screens_len = nSizes << 2;
                    const screens = [];
                    for (i = 0; i < screens_len; ++i)
                        screens.push(buf.readUInt16LE(24 + i * 2));
                    info.screens = [];
                    for (let i = 0; i < screens_len; i += 4) {
                        info.screens.push({
                            px_width : screens[i],
                            px_height : screens[i + 1],
                            mm_width : screens[i + 2],
                            mm_height : screens[i + 3]
                        });
                    }

                    for (i = 0; i < nRates; ++i)
                        info.rates.push(buf.readUInt16LE(24 + screens_len * 2 + i * 2));
                    return info;
                },
                cb
            ];

            X.pack_stream.flush();
        },

        ext.GetScreenResources = (win, cb) => {
            X.seq_num ++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 8, 2, win]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    let i;
                    let pos = 0;
                    const res = [
                        buf.readUInt32LE(0),
                        buf.readUInt32LE(4),
                        buf.readUInt16LE(8),
                        buf.readUInt16LE(10),
                        buf.readUInt16LE(12),
                        buf.readUInt16LE(14)
                    ];
                    const resources = {
                        timestamp : res[0],
                        config_timestamp : res[1],
                        modeinfos : []
                    };

                    pos += 24;
                    resources.crtcs = [];
                    for (i = 0; i < res[2]; ++i)
                        resources.crtcs.push(buf.readUInt32LE(pos + i * 4));
                    pos +=  res[2] << 2;
                    resources.outputs = [];
                    for (i = 0; i < res[3]; ++i)
                        resources.outputs.push(buf.readUInt32LE(pos + i * 4));
                    pos +=  res[3] << 2;
                    res_modes = [];
                    for (i = 0; i < res[4]; ++i) {
                        const o = pos + i * 32;
                        res_modes.push(
                            buf.readUInt32LE(o),
                            buf.readUInt16LE(o + 4),
                            buf.readUInt16LE(o + 6),
                            buf.readUInt32LE(o + 8),
                            buf.readUInt16LE(o + 12),
                            buf.readUInt16LE(o + 14),
                            buf.readUInt16LE(o + 16),
                            buf.readUInt16LE(o + 18),
                            buf.readUInt16LE(o + 20),
                            buf.readUInt16LE(o + 22),
                            buf.readUInt16LE(o + 24),
                            buf.readUInt16LE(o + 26),
                            buf.readUInt32LE(o + 28)
                        );
                    }
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
        ext.GetOutputInfo = (output, ts, cb) => {
            X.seq_num ++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 9, 3, output, ts ]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    let i;
                    let pos = 0;
                    const res = [
                        buf.readUInt32LE(0),
                        buf.readUInt32LE(4),
                        buf.readUInt32LE(8),
                        buf.readUInt32LE(12),
                        buf.readUInt8(16),
                        buf.readUInt8(17),
                        buf.readUInt16LE(18),
                        buf.readUInt16LE(20),
                        buf.readUInt16LE(22),
                        buf.readUInt16LE(24),
                        buf.readUInt16LE(26)
                    ];
                    const info = {
                        timestamp : res[0],
                        crtc : res[1],
                        mm_width : res[2],
                        mm_height : res[3],
                        connection : res[4],
                        subpixelOrder : res[5],
                        preferredModes: res[8]
                    };

                    pos += 28;
                    info.crtcs = [];
                    for (i = 0; i < res[6]; ++i)
                        info.crtcs.push(buf.readUInt32LE(pos + i * 4));
                    pos +=  res[6] << 2;
                    info.modes = [];
                    for (i = 0; i < res[7]; ++i)
                        info.modes.push(buf.readUInt32LE(pos + i * 4));
                    pos +=  res[7] << 2;
                    info.clones = [];
                    for (i = 0; i < res[9]; ++i)
                        info.clones.push(buf.readUInt32LE(pos + i * 4));
                    pos +=  res[9] << 2;
                    info.name = buf.slice(pos, pos + res_modes[10]).toString('binary');
                    return info;
                },
                cb
            ];

            X.pack_stream.flush();
        },
        ext.GetCrtcInfo = (crtc, configTs, cb) => {
            X.seq_num ++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 20, 3, crtc, configTs ]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    let pos = 0;
                    const res = [
                        buf.readUInt32LE(0),
                        buf.readInt16LE(4),
                        buf.readInt16LE(6),
                        buf.readUInt16LE(8),
                        buf.readUInt16LE(10),
                        buf.readUInt32LE(12),
                        buf.readUInt16LE(16),
                        buf.readUInt16LE(18),
                        buf.readUInt16LE(20),
                        buf.readUInt16LE(22)
                    ];
                    const info = {
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
                    info.output = [];
                    for (let i = 0; i < res[8]; ++i)
                        info.output.push(buf.readUInt32LE(pos + i * 4));
                    info.possible = [];
                    for (let i = 0; i < res[9]; ++i)
                        info.possible.push(buf.readUInt32LE(pos + i * 4));
                    return info;
                },
                cb
            ];

            X.pack_stream.flush();
        },

        X.eventParsers[ext.firstEvent + ext.events.RRScreenChangeNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.raw = raw;
            event.type = type
            event.seq = seq;
            event.rotation = code;
            event.time = extra
            event.configtime = raw.readUInt32LE(0);
            event.root = raw.readUInt32LE(4);
            event.requestWindow = raw.readUInt32LE(8);
            event.sizeId = raw.readUInt16LE(12);
            event.subpixelOrder = raw.readUInt16LE(14);
            event.width = raw.readUInt16LE(16);
            event.height = raw.readUInt16LE(18);
            event.physWidth = raw.readUInt16LE(20);
            event.physHeight = raw.readUInt16LE(22);

            event.name = 'RRScreenChangeNotify';
            return event;
        };


        ext.QueryVersion(255, 255, (err, version) => {
          if (err) return callback(err);
          ext.major_version = version[0];
          ext.minor_version = version[1];
          callback(null, ext);
        });
    });
}
