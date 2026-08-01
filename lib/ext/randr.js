// http://www.x.org/releases/X11R7.6/doc/randrproto/randrproto.txt

const x11 = require('..');
// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('RANDR', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        // shared reply unpacker for GetScreenResources (8) and GetScreenResourcesCurrent (25)
        const unpackScreenResources = (buf) => {
            const numCrtcs = buf.readUInt16LE(8);
            const numOutputs = buf.readUInt16LE(10);
            const numModes = buf.readUInt16LE(12);
            const resources = {
                timestamp : buf.readUInt32LE(0),
                config_timestamp : buf.readUInt32LE(4),
                crtcs : [],
                outputs : [],
                modeinfos : []
            };

            let pos = 24;
            for (let i = 0; i < numCrtcs; ++i)
                resources.crtcs.push(buf.readUInt32LE(pos + i * 4));
            pos += numCrtcs << 2;
            for (let i = 0; i < numOutputs; ++i)
                resources.outputs.push(buf.readUInt32LE(pos + i * 4));
            pos += numOutputs << 2;
            for (let i = 0; i < numModes; ++i) {
                const o = pos + i * 32;
                resources.modeinfos.push({
                    id : buf.readUInt32LE(o),
                    width : buf.readUInt16LE(o + 4),
                    height : buf.readUInt16LE(o + 6),
                    dot_clock : buf.readUInt32LE(o + 8),
                    h_sync_start : buf.readUInt16LE(o + 12),
                    h_sync_end : buf.readUInt16LE(o + 14),
                    h_total : buf.readUInt16LE(o + 16),
                    h_skew : buf.readUInt16LE(o + 18),
                    v_sync_start : buf.readUInt16LE(o + 20),
                    v_sync_end : buf.readUInt16LE(o + 22),
                    v_total : buf.readUInt16LE(o + 24),
                    name_len : buf.readUInt16LE(o + 26),
                    modeflags : buf.readUInt32LE(o + 28)
                });
            }
            pos += numModes << 5;
            // mode names are concatenated without separators; use each name_len
            resources.modeinfos.forEach(mode => {
                mode.name = buf.slice(pos, pos + mode.name_len).toString('binary');
                pos += mode.name_len;
            });

            return resources;
        };

        // render TRANSFORM: 3x3 matrix of FIXED (16.16) values, row-major,
        // exposed as an array of 9 JS floats
        const writeTransform = (b, off, matrix) => {
            for (let i = 0; i < 9; ++i)
                b.writeInt32LE(Math.round(matrix[i] * 65536), off + i * 4);
        };

        const readTransform = (buf, off) => {
            const matrix = [];
            for (let i = 0; i < 9; ++i)
                matrix.push(buf.readInt32LE(off + i * 4) / 65536);
            return matrix;
        };

        //ext.ReportLevel	= {
        //};

        ext.QueryVersion = (clientMaj, clientMin, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(clientMaj >>> 0, 4);
            b.writeUInt32LE(clientMin >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
                },
                callback
            ];
            X.pack_stream.submit(true);
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
            Success: 0,
            InvalidConfigTime: 1,
            InvalidTime: 2,
            Failed: 3
        };

        ext.Connection = {
            Connected: 0,
            Disconnected: 1,
            Unknown: 2
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
            const b = Buffer.alloc(24);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(6, 2);
            b.writeUInt32LE(win >>> 0, 4);
            b.writeUInt32LE(ts >>> 0, 8);
            b.writeUInt32LE(configTs >>> 0, 12);
            b.writeUInt16LE(sizeId, 16);
            b.writeUInt16LE(rotation, 18);
            b.writeUInt16LE(rate, 20);
            X.pack_stream.put(b);
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

            X.pack_stream.submit(true);
        },

        ext.SelectInput = (win, mask) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(win >>> 0, 4);
            b.writeUInt16LE(mask, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        ext.GetScreenInfo = (win, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(win >>> 0, 4);
            X.pack_stream.put(b);
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

            X.pack_stream.submit(true);
        },

        ext.GetScreenResources = (win, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(8, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(win >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                unpackScreenResources,
                cb
            ];

            X.pack_stream.submit(true);
        },
        ext.GetScreenResourcesCurrent = (win, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(25, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(win >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                unpackScreenResources,
                cb
            ];

            X.pack_stream.submit(true);
        },
        ext.GetOutputInfo = (output, ts, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(9, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(ts >>> 0, 8);
            X.pack_stream.put(b);
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
                    info.name = buf.slice(pos, pos + res[10]).toString('binary');
                    return info;
                },
                cb
            ];

            X.pack_stream.submit(true);
        },
        ext.GetCrtcInfo = (crtc, configTs, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(20, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            b.writeUInt32LE(configTs >>> 0, 8);
            X.pack_stream.put(b);
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
                    pos += res[8] << 2;
                    info.possible = [];
                    for (let i = 0; i < res[9]; ++i)
                        info.possible.push(buf.readUInt32LE(pos + i * 4));
                    return info;
                },
                cb
            ];

            X.pack_stream.submit(true);
        },

        ext.GetScreenSizeRange = (win, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(win >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        minWidth : buf.readUInt16LE(0),
                        minHeight : buf.readUInt16LE(2),
                        maxWidth : buf.readUInt16LE(4),
                        maxHeight : buf.readUInt16LE(6)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        // width/height in pixels, mmWidth/mmHeight in millimeters
        ext.SetScreenSize = (win, width, height, mmWidth, mmHeight) => {
            X.seq_num ++;
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt32LE(win >>> 0, 4);
            b.writeUInt16LE(width, 8);
            b.writeUInt16LE(height, 10);
            b.writeUInt32LE(mmWidth >>> 0, 12);
            b.writeUInt32LE(mmHeight >>> 0, 16);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        ext.ListOutputProperties = (output, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(10, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(output >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numAtoms = buf.readUInt16LE(0);
                    const atoms = [];
                    for (let i = 0; i < numAtoms; ++i)
                        atoms.push(buf.readUInt32LE(24 + i * 4));
                    return atoms;
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        ext.QueryOutputProperty = (output, property, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(11, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(property >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const info = {
                        pending : !!buf.readUInt8(0),
                        range : !!buf.readUInt8(1),
                        immutable : !!buf.readUInt8(2),
                        validValues : []
                    };
                    // list length == reply length field == (buf.length - 24) / 4
                    for (let pos = 24; pos + 4 <= buf.length; pos += 4)
                        info.validValues.push(buf.readInt32LE(pos));
                    return info;
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        // values: array of INT32 (min/max pair when range, else list of valid values)
        ext.ConfigureOutputProperty = (output, property, pending, range, values) => {
            X.seq_num ++;
            const b = Buffer.alloc(16 + values.length * 4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(12, 1);
            b.writeUInt16LE(4 + values.length, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(property >>> 0, 8);
            b.writeUInt8(pending ? 1 : 0, 12);
            b.writeUInt8(range ? 1 : 0, 13);
            values.forEach((v, i) => {
                b.writeInt32LE(v, 16 + i * 4);
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        // mode: 0 replace, 1 prepend, 2 append; format: 8/16/32
        // data: Buffer (raw bytes), array of numbers (format units) or string
        ext.ChangeOutputProperty = (output, property, type, format, mode, data) => {
            X.seq_num ++;
            let payload;
            if (Buffer.isBuffer(data)) {
                payload = data;
            } else if (Array.isArray(data)) {
                payload = Buffer.alloc(data.length * (format >> 3));
                data.forEach((v, i) => {
                    if (format === 32)
                        payload.writeUInt32LE(v >>> 0, i * 4);
                    else if (format === 16)
                        payload.writeUInt16LE(v, i * 2);
                    else
                        payload.writeUInt8(v, i);
                });
            } else {
                payload = Buffer.from(String(data), 'latin1');
            }

            const padded = (payload.length + 3) & ~3;
            const b = Buffer.alloc(24 + padded);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(13, 1);
            b.writeUInt16LE((24 + padded) >> 2, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(property >>> 0, 8);
            b.writeUInt32LE(type >>> 0, 12);
            b.writeUInt8(format, 16);
            b.writeUInt8(mode, 17);
            b.writeUInt32LE((payload.length / (format >> 3)) >>> 0, 20);
            payload.copy(b, 24);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        ext.DeleteOutputProperty = (output, property) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(14, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(property >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        // longOffset/longLength in 4-byte units (as in core GetProperty)
        ext.GetOutputProperty = (output, property, type, longOffset, longLength, del, pending, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(28);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(15, 1);
            b.writeUInt16LE(7, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(property >>> 0, 8);
            b.writeUInt32LE(type >>> 0, 12);
            b.writeUInt32LE(longOffset >>> 0, 16);
            b.writeUInt32LE(longLength >>> 0, 20);
            b.writeUInt8(del ? 1 : 0, 24);
            b.writeUInt8(pending ? 1 : 0, 25);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const format = opt;
                    const numItems = buf.readUInt32LE(8);
                    return {
                        format : format,
                        type : buf.readUInt32LE(0),
                        bytesAfter : buf.readUInt32LE(4),
                        numItems : numItems,
                        data : buf.slice(24, 24 + numItems * (format >> 3))
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        // modeInfo: { width, height, dot_clock, h_sync_start, h_sync_end, h_total, h_skew,
        //             v_sync_start, v_sync_end, v_total, modeflags, name } (id chosen by server)
        ext.CreateMode = (win, modeInfo, cb) => {
            X.seq_num ++;
            const name = modeInfo.name || '';
            const padded = (name.length + 3) & ~3;
            const b = Buffer.alloc(40 + padded);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(16, 1);
            b.writeUInt16LE((40 + padded) >> 2, 2);
            b.writeUInt32LE(win >>> 0, 4);
            b.writeUInt32LE((modeInfo.id || 0) >>> 0, 8);
            b.writeUInt16LE(modeInfo.width, 12);
            b.writeUInt16LE(modeInfo.height, 14);
            b.writeUInt32LE((modeInfo.dot_clock || 0) >>> 0, 16);
            b.writeUInt16LE(modeInfo.h_sync_start || 0, 20);
            b.writeUInt16LE(modeInfo.h_sync_end || 0, 22);
            b.writeUInt16LE(modeInfo.h_total || 0, 24);
            b.writeUInt16LE(modeInfo.h_skew || 0, 26);
            b.writeUInt16LE(modeInfo.v_sync_start || 0, 28);
            b.writeUInt16LE(modeInfo.v_sync_end || 0, 30);
            b.writeUInt16LE(modeInfo.v_total || 0, 32);
            b.writeUInt16LE(name.length, 34);
            b.writeUInt32LE((modeInfo.modeflags || 0) >>> 0, 36);
            b.write(name, 40, 'latin1');
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                cb
            ];
            X.pack_stream.submit(true);
        },

        ext.DestroyMode = (mode) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(17, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(mode >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        ext.AddOutputMode = (output, mode) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(18, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(mode >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        ext.DeleteOutputMode = (output, mode) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(19, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(output >>> 0, 4);
            b.writeUInt32LE(mode >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        // status is ext.ConfigStatus; mode 0 disables the crtc (outputs must be [])
        ext.SetCrtcConfig = (crtc, ts, configTs, x, y, mode, rotation, outputs, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(28 + outputs.length * 4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(21, 1);
            b.writeUInt16LE(7 + outputs.length, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            b.writeUInt32LE(ts >>> 0, 8);
            b.writeUInt32LE(configTs >>> 0, 12);
            b.writeInt16LE(x, 16);
            b.writeInt16LE(y, 18);
            b.writeUInt32LE(mode >>> 0, 20);
            b.writeUInt16LE(rotation, 24);
            outputs.forEach((o, i) => {
                b.writeUInt32LE(o >>> 0, 28 + i * 4);
            });
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        status : opt,
                        timestamp : buf.readUInt32LE(0)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        ext.GetCrtcGammaSize = (crtc, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(22, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt16LE(0),
                cb
            ];
            X.pack_stream.submit(true);
        },

        ext.GetCrtcGamma = (crtc, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(23, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const size = buf.readUInt16LE(0);
                    const gamma = { size : size, red : [], green : [], blue : [] };
                    for (let i = 0; i < size; ++i) {
                        gamma.red.push(buf.readUInt16LE(24 + i * 2));
                        gamma.green.push(buf.readUInt16LE(24 + (size + i) * 2));
                        gamma.blue.push(buf.readUInt16LE(24 + (2 * size + i) * 2));
                    }
                    return gamma;
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        // red/green/blue: equal-length arrays of CARD16 (length == GetCrtcGammaSize)
        ext.SetCrtcGamma = (crtc, red, green, blue) => {
            X.seq_num ++;
            const size = red.length;
            const padded = (size * 6 + 3) & ~3;
            const b = Buffer.alloc(12 + padded);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(24, 1);
            b.writeUInt16LE((12 + padded) >> 2, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            b.writeUInt16LE(size, 8);
            for (let i = 0; i < size; ++i) {
                b.writeUInt16LE(red[i], 12 + i * 2);
                b.writeUInt16LE(green[i], 12 + (size + i) * 2);
                b.writeUInt16LE(blue[i], 12 + (2 * size + i) * 2);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        // transform: array of 9 floats (3x3 row-major matrix, converted to 16.16 FIXED —
        // values are rounded to 1/65536); filterParams: array of floats (FIXED on the wire)
        ext.SetCrtcTransform = (crtc, transform, filterName, filterParams) => {
            X.seq_num ++;
            filterName = filterName || '';
            filterParams = filterParams || [];
            const padded = (filterName.length + 3) & ~3;
            const total = 48 + padded + filterParams.length * 4;
            const b = Buffer.alloc(total);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(26, 1);
            b.writeUInt16LE(total >> 2, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            writeTransform(b, 8, transform);
            b.writeUInt16LE(filterName.length, 44);
            b.write(filterName, 48, 'latin1');
            filterParams.forEach((v, i) => {
                b.writeInt32LE(Math.round(v * 65536), 48 + padded + i * 4);
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        ext.GetCrtcTransform = (crtc, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(27, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const info = {
                        pendingTransform : readTransform(buf, 0),
                        hasTransforms : !!buf.readUInt8(36),
                        currentTransform : readTransform(buf, 40)
                    };
                    const pendingLen = buf.readUInt16LE(80);
                    const pendingNparams = buf.readUInt16LE(82);
                    const currentLen = buf.readUInt16LE(84);
                    const currentNparams = buf.readUInt16LE(86);
                    let pos = 88;
                    info.pendingFilter = buf.slice(pos, pos + pendingLen).toString('binary');
                    pos += (pendingLen + 3) & ~3;
                    info.pendingParams = [];
                    for (let i = 0; i < pendingNparams; ++i)
                        info.pendingParams.push(buf.readInt32LE(pos + i * 4) / 65536);
                    pos += pendingNparams * 4;
                    info.currentFilter = buf.slice(pos, pos + currentLen).toString('binary');
                    pos += (currentLen + 3) & ~3;
                    info.currentParams = [];
                    for (let i = 0; i < currentNparams; ++i)
                        info.currentParams.push(buf.readInt32LE(pos + i * 4) / 65536);
                    return info;
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        ext.GetPanning = (crtc, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(28, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        status : opt,
                        timestamp : buf.readUInt32LE(0),
                        left : buf.readUInt16LE(4),
                        top : buf.readUInt16LE(6),
                        width : buf.readUInt16LE(8),
                        height : buf.readUInt16LE(10),
                        trackLeft : buf.readUInt16LE(12),
                        trackTop : buf.readUInt16LE(14),
                        trackWidth : buf.readUInt16LE(16),
                        trackHeight : buf.readUInt16LE(18),
                        borderLeft : buf.readInt16LE(20),
                        borderTop : buf.readInt16LE(22),
                        borderRight : buf.readInt16LE(24),
                        borderBottom : buf.readInt16LE(26)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        // panning: object with the same fields GetPanning returns (left, top, width, height,
        // trackLeft, trackTop, trackWidth, trackHeight, borderLeft/Top/Right/Bottom)
        ext.SetPanning = (crtc, ts, panning, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(36);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(29, 1);
            b.writeUInt16LE(9, 2);
            b.writeUInt32LE(crtc >>> 0, 4);
            b.writeUInt32LE(ts >>> 0, 8);
            b.writeUInt16LE(panning.left, 12);
            b.writeUInt16LE(panning.top, 14);
            b.writeUInt16LE(panning.width, 16);
            b.writeUInt16LE(panning.height, 18);
            b.writeUInt16LE(panning.trackLeft, 20);
            b.writeUInt16LE(panning.trackTop, 22);
            b.writeUInt16LE(panning.trackWidth, 24);
            b.writeUInt16LE(panning.trackHeight, 26);
            b.writeInt16LE(panning.borderLeft, 28);
            b.writeInt16LE(panning.borderTop, 30);
            b.writeInt16LE(panning.borderRight, 32);
            b.writeInt16LE(panning.borderBottom, 34);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        status : opt,
                        timestamp : buf.readUInt32LE(0)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        },

        // output = 0 (None) clears the primary output
        ext.SetOutputPrimary = (win, output) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(30, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(win >>> 0, 4);
            b.writeUInt32LE(output >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        },

        ext.GetOutputPrimary = (win, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(31, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(win >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                cb
            ];
            X.pack_stream.submit(true);
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
