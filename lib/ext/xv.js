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

        // Stops video (or a still image) the port is putting into `drawable`
        // and releases the association between the two - the teardown half of
        // PutImage/PutStill, and what makes the server send an XvVideoNotify
        // with reason Stopped. Void request; `cb` is checked as for
        // SelectVideoNotify below.
        ext.StopVideo = (port, drawable, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(9, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            if (cb) {
                X.replies[seq] = [null, cb];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // Ask for XvVideoNotify events on `drawable`. Void request; with a
        // callback it fires cb(null) once the server has processed it (forced
        // by a round trip) or cb(err) if it errored.
        ext.SelectVideoNotify = (drawable, onoff, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(10, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt8(onoff ? 1 : 0, 8);
            if (cb) {
                X.replies[seq] = [null, cb];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // Ask for XvPortNotify events (attribute changes) on `port`.
        ext.SelectPortNotify = (port, onoff, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(11, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt8(onoff ? 1 : 0, 8);
            if (cb) {
                X.replies[seq] = [null, cb];
                X._scheduleVoidSync(seq);
            }
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

        // Plane layout of image format `id` at `width` x `height` on `port`.
        // cb(err, {numPlanes, dataSize, width, height, pitches, offsets}) --
        // the server may round the size up, so use the width/height it
        // answers (and its pitches/offsets) to lay the image out for PutImage.
        ext.QueryImageAttributes = (port, id, width, height, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(17, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt32LE(id >>> 0, 8);
            b.writeUInt16LE(width, 12);
            b.writeUInt16LE(height, 14);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numPlanes = buf.readUInt32LE(0);
                    const pitches = [];
                    const offsets = [];
                    for (let i = 0; i < numPlanes; ++i) {
                        pitches.push(buf.readUInt32LE(24 + i * 4));
                        offsets.push(buf.readUInt32LE(24 + numPlanes * 4 + i * 4));
                    }
                    return {
                        numPlanes: numPlanes,
                        dataSize: buf.readUInt32LE(4),
                        width: buf.readUInt16LE(8),
                        height: buf.readUInt16LE(10),
                        pitches: pitches,
                        offsets: offsets
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // img: { srcX, srcY, srcWidth, srcHeight, drwX, drwY, drwWidth,
        //        drwHeight, width, height, data }
        // `width`/`height` describe the image in `data` (laid out per
        // QueryImageAttributes); src* selects the part of it to show, drw*
        // the destination rectangle in `drawable`. The adaptor scales and
        // color-converts. `id` is an id from ListImageFormats.
        //
        // Void request: pass `cb` to have it checked (costs a round trip, so
        // not per frame in a playback loop).
        ext.PutImage = (port, drawable, gc, id, img, cb) => {
            const data = img.data;
            const padded = pad4(data.length);
            // 40-byte header (10 words) + padded image data
            const reqLen = 10 + padded / 4;
            // A frame the connection cannot carry has to be refused here:
            // sent anyway, the server rejects the length and drops the
            // connection rather than just this request.
            const maxLen = display.max_request_length || 0xffff;
            if (reqLen + (reqLen > 0xffff ? 1 : 0) > maxLen) {
                const err = new Error(
                    `Xv PutImage: frame of ${data.length} bytes exceeds this connection's ` +
                    `maximum request length (${maxLen * 4} bytes). Send a smaller image ` +
                    'and let the adaptor scale it up, or use ShmPutImage.');
                if (cb)
                    return process.nextTick(() => cb(err));
                throw err;
            }
            let b;
            if (reqLen <= 0xffff) {
                // fits the 16-bit length field: plain encoding, valid whether
                // or not BIG-REQUESTS was negotiated
                b = Buffer.alloc(40);
                b.writeUInt8(ext.majorOpcode, 0);
                b.writeUInt8(18, 1);
                b.writeUInt16LE(reqLen, 2);
            } else {
                // too large for a 16-bit length: BIG-REQUESTS encoding (length
                // field 0, then a CARD32 holding the real length + 1 for the
                // extra word). Needs BIG-REQUESTS enabled at connect (the
                // default) and a server max_request_length that fits the frame.
                b = Buffer.alloc(44);
                b.writeUInt8(ext.majorOpcode, 0);
                b.writeUInt8(18, 1);
                b.writeUInt16LE(0, 2);
                b.writeUInt32LE((reqLen + 1) >>> 0, 4);
            }
            const o = b.length - 36; // first field after the length encoding
            b.writeUInt32LE(port >>> 0, o);
            b.writeUInt32LE(drawable >>> 0, o + 4);
            b.writeUInt32LE(gc >>> 0, o + 8);
            b.writeUInt32LE(id >>> 0, o + 12);
            b.writeInt16LE(img.srcX, o + 16);
            b.writeInt16LE(img.srcY, o + 18);
            b.writeUInt16LE(img.srcWidth, o + 20);
            b.writeUInt16LE(img.srcHeight, o + 22);
            b.writeInt16LE(img.drwX, o + 24);
            b.writeInt16LE(img.drwY, o + 26);
            b.writeUInt16LE(img.drwWidth, o + 28);
            b.writeUInt16LE(img.drwHeight, o + 30);
            b.writeUInt16LE(img.width, o + 32);
            b.writeUInt16LE(img.height, o + 34);
            X.seq_num++;
            const seq = X.seq_num;
            if (cb) {
                X.replies[seq] = [null, cb];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.put(data);
            if (padded !== data.length)
                X.pack_stream.put(Buffer.alloc(padded - data.length));
            X.pack_stream.submit();
        }

        // Same as PutImage, with the pixels already in a shared segment
        // (MIT-SHM) at `offset` instead of on the wire.
        // img: { srcX, srcY, srcWidth, srcHeight, drwX, drwY, drwWidth,
        //        drwHeight, width, height, offset, sendEvent }
        // With sendEvent the server sends a ShmCompletion event once it has
        // finished reading the segment, which is what lets a caller recycle
        // the buffer safely (see lib/ext/shm.js).
        ext.ShmPutImage = (port, drawable, gc, shmseg, id, img, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(52);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(19, 1);
            b.writeUInt16LE(13, 2);
            b.writeUInt32LE(port >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            b.writeUInt32LE(gc >>> 0, 12);
            b.writeUInt32LE(shmseg >>> 0, 16);
            b.writeUInt32LE(id >>> 0, 20);
            b.writeUInt32LE((img.offset || 0) >>> 0, 24);
            b.writeInt16LE(img.srcX, 28);
            b.writeInt16LE(img.srcY, 30);
            b.writeUInt16LE(img.srcWidth, 32);
            b.writeUInt16LE(img.srcHeight, 34);
            b.writeInt16LE(img.drwX, 36);
            b.writeInt16LE(img.drwY, 38);
            b.writeUInt16LE(img.drwWidth, 40);
            b.writeUInt16LE(img.drwHeight, 42);
            b.writeUInt16LE(img.width, 44);
            b.writeUInt16LE(img.height, 46);
            b.writeUInt8(img.sendEvent ? 1 : 0, 48);
            if (cb) {
                X.replies[seq] = [null, cb];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
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
