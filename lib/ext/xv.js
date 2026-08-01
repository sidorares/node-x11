// XVideo (Xv) extension
// spec: https://xorg.freedesktop.org/releases/X11R7.7/doc/videoproto/xv-protocol-v2.txt
// xcb:  autogen/proto/xv.xml

const pad4 = n => (n + 3) & ~3;

const readString = (buf, off, len) => {
    let s = buf.toString('binary', off, off + len);
    const nul = s.indexOf('\0');
    if (nul !== -1)
        s = s.substring(0, nul);
    return s;
};

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('XVideo', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.Type = {
            InputMask: 1,
            OutputMask: 2,
            VideoMask: 4,
            StillMask: 8,
            ImageMask: 16
        };

        ext.ImageFormatInfoType = { RGB: 0, YUV: 1 };
        ext.ImageFormatInfoFormat = { Packed: 0, Planar: 1 };
        ext.AttributeFlag = { Gettable: 1, Settable: 2 };
        ext.ScanlineOrder = { TopToBottom: 0, BottomToTop: 1 };

        ext.GrabPortStatus = {
            Success: 0,
            BadExtension: 1,
            AlreadyGrabbed: 2,
            InvalidTime: 3,
            BadReply: 4,
            BadAlloc: 5
        };

        ext.errors = {
            BadPort: ext.firstError,
            BadEncoding: ext.firstError + 1,
            BadControl: ext.firstError + 2
        };

        // Xv version request (named QueryExtension in the protocol)
        ext.QueryExtension = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt16LE(0), buf.readUInt16LE(2)];
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.QueryAdaptors = (window, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numAdaptors = buf.readUInt16LE(0);
                    const adaptors = [];
                    let off = 24;
                    for (let i = 0; i < numAdaptors; ++i) {
                        const adaptor = {
                            baseId: buf.readUInt32LE(off),
                            numPorts: buf.readUInt16LE(off + 6),
                            type: buf.readUInt8(off + 10)
                        };
                        const nameSize = buf.readUInt16LE(off + 4);
                        const numFormats = buf.readUInt16LE(off + 8);
                        off += 12;
                        adaptor.name = readString(buf, off, nameSize);
                        off += pad4(nameSize);
                        adaptor.formats = [];
                        for (let j = 0; j < numFormats; ++j) {
                            adaptor.formats.push({
                                visual: buf.readUInt32LE(off),
                                depth: buf.readUInt8(off + 4)
                            });
                            off += 8;
                        }
                        adaptors.push(adaptor);
                    }
                    return adaptors;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.QueryEncodings = (port, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(port >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numEncodings = buf.readUInt16LE(0);
                    const encodings = [];
                    let off = 24;
                    for (let i = 0; i < numEncodings; ++i) {
                        const encoding = {
                            encoding: buf.readUInt32LE(off),
                            width: buf.readUInt16LE(off + 6),
                            height: buf.readUInt16LE(off + 8),
                            rate: {
                                numerator: buf.readInt32LE(off + 12),
                                denominator: buf.readInt32LE(off + 16)
                            }
                        };
                        const nameSize = buf.readUInt16LE(off + 4);
                        off += 20;
                        encoding.name = readString(buf, off, nameSize);
                        off += pad4(nameSize);
                        encodings.push(encoding);
                    }
                    return encodings;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // time: 0 = CurrentTime; reply is an ext.GrabPortStatus value
        ext.GrabPort = (port, time, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt32LE(time >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => opt,
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.UngrabPort = (port, time) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt32LE(time >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.QueryBestSize = (port, vidW, vidH, drwW, drwH, motion, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(12, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt16LE(vidW, 8);
            b.writeUInt16LE(vidH, 10);
            b.writeUInt16LE(drwW, 12);
            b.writeUInt16LE(drwH, 14);
            b.writeUInt8(motion ? 1 : 0, 16);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        width: buf.readUInt16LE(0),
                        height: buf.readUInt16LE(2)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.SetPortAttribute = (port, attribute, value) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(13, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt32LE(attribute >>> 0, 8);
            b.writeInt32LE(value, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.GetPortAttribute = (port, attribute, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(14, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt32LE(attribute >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readInt32LE(0),
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.QueryPortAttributes = (port, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(15, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(port >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numAttributes = buf.readUInt32LE(0);
                    const attributes = [];
                    let off = 24;
                    for (let i = 0; i < numAttributes; ++i) {
                        const attr = {
                            flags: buf.readUInt32LE(off),
                            min: buf.readInt32LE(off + 4),
                            max: buf.readInt32LE(off + 8)
                        };
                        const size = buf.readUInt32LE(off + 12);
                        off += 16;
                        attr.name = readString(buf, off, size);
                        off += pad4(size);
                        attributes.push(attr);
                    }
                    return attributes;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.ListImageFormats = (port, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(16, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(port >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numFormats = buf.readUInt32LE(0);
                    const formats = [];
                    let off = 24;
                    for (let i = 0; i < numFormats; ++i) {
                        // 128-byte XvImageFormatInfo
                        formats.push({
                            id: buf.readUInt32LE(off),
                            type: buf.readUInt8(off + 4),
                            byteOrder: buf.readUInt8(off + 5),
                            guid: Buffer.from(buf.subarray(off + 8, off + 24)),
                            bpp: buf.readUInt8(off + 24),
                            numPlanes: buf.readUInt8(off + 25),
                            depth: buf.readUInt8(off + 28),
                            redMask: buf.readUInt32LE(off + 32),
                            greenMask: buf.readUInt32LE(off + 36),
                            blueMask: buf.readUInt32LE(off + 40),
                            format: buf.readUInt8(off + 44),
                            ySampleBits: buf.readUInt32LE(off + 48),
                            uSampleBits: buf.readUInt32LE(off + 52),
                            vSampleBits: buf.readUInt32LE(off + 56),
                            horzYPeriod: buf.readUInt32LE(off + 60),
                            horzUPeriod: buf.readUInt32LE(off + 64),
                            horzVPeriod: buf.readUInt32LE(off + 68),
                            vertYPeriod: buf.readUInt32LE(off + 72),
                            vertUPeriod: buf.readUInt32LE(off + 76),
                            vertVPeriod: buf.readUInt32LE(off + 80),
                            compOrder: readString(buf, off + 84, 32),
                            scanlineOrder: buf.readUInt8(off + 116)
                        });
                        off += 128;
                    }
                    return formats;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.events = {
            VideoNotify: 0,
            PortNotify: 1
        };

        ext.VideoNotifyReason = {
            Started: 0,
            Stopped: 1,
            Busy: 2,
            Preempted: 3,
            HardError: 4
        };

        X.eventParsers[ext.firstEvent + ext.events.VideoNotify] = (type, seq, extra, code, raw) => {
            return {
                name: 'XvVideoNotify',
                type: type,
                seq: seq,
                reason: code,
                time: extra,
                drawable: raw.readUInt32LE(0),
                port: raw.readUInt32LE(4)
            };
        };

        X.eventParsers[ext.firstEvent + ext.events.PortNotify] = (type, seq, extra, code, raw) => {
            return {
                name: 'XvPortNotify',
                type: type,
                seq: seq,
                time: extra,
                port: raw.readUInt32LE(0),
                attribute: raw.readUInt32LE(4),
                value: raw.readInt32LE(8)
            };
        };

        ext.QueryExtension((err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
