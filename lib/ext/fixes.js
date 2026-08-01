// https://xorg.freedesktop.org/releases/X11R7.7/doc/fixesproto/fixesproto.txt
// wire layout: autogen/proto/xfixes.xml

const x11 = require('..');
// TODO: move to templates

function parse_rectangle(buf, pos) {
    if (!pos) {
        pos = 0;
    }

    return {
        x : buf[pos],
        y : buf[pos + 1],
        width : buf[pos + 2],
        height : buf[pos + 3]
    }
}

const pad4 = n => (n + 3) & ~3;

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('XFIXES', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        const writeRectangles = (b, off, rects) => {
            rects.forEach(rect => {
                b.writeInt16LE(rect.x, off);
                b.writeInt16LE(rect.y, off + 2);
                b.writeUInt16LE(rect.width, off + 4);
                b.writeUInt16LE(rect.height, off + 6);
                off += 8;
            });
        };

        // opcode 0
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
        }

        ext.SaveSetMode = { Insert: 0, Delete: 1 };
        ext.SaveSetTarget = { Nearest: 0, Root: 1 };
        ext.SaveSetMap = { Map: 0, Unmap: 1 };

        // opcode 1
        ext.ChangeSaveSet = (window, mode, target, map) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt8(mode, 4);
            b.writeUInt8(target, 5);
            b.writeUInt8(map, 6);
            b.writeUInt32LE(window >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        ext.SelectionEvent = {
            SetSelectionOwner: 0,
            SelectionWindowDestroy: 1,
            SelectionClientClose: 2
        };

        ext.SelectionEventMask = {
            SetSelectionOwner: 1,
            SelectionWindowDestroy: 2,
            SelectionClientClose: 4
        };

        // opcode 2
        ext.SelectSelectionInput = (window, selection, eventMask) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(selection >>> 0, 8);
            b.writeUInt32LE(eventMask >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.CursorNotify = { DisplayCursor: 0 };
        ext.CursorNotifyMask = { DisplayCursor: 1 };

        // opcode 3
        ext.SelectCursorInput = (window, eventMask) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(eventMask >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        const parseCursorImageReply = buf => {
            const width = buf.readUInt16LE(4);
            const height = buf.readUInt16LE(6);
            return {
                x: buf.readInt16LE(0),
                y: buf.readInt16LE(2),
                width: width,
                height: height,
                xhot: buf.readUInt16LE(8),
                yhot: buf.readUInt16LE(10),
                cursorSerial: buf.readUInt32LE(12),
                // width*height packed ARGB32 pixels, premultiplied alpha
                cursorImage: Buffer.from(buf.slice(24, 24 + width * height * 4))
            };
        };

        // opcode 4
        ext.GetCursorImage = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => parseCursorImageReply(buf),
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.WindowRegionKind = {
            Bounding : 0,
            Clip : 1
        };

        // opcode 5
        ext.CreateRegion = (region, rects) => {
            X.seq_num ++;
            const b = Buffer.alloc(8 + rects.length * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(2 + (rects.length << 1), 2);
            b.writeUInt32LE(region >>> 0, 4);
            writeRectangles(b, 8, rects);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 6
        ext.CreateRegionFromBitmap = (region, bitmap) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeUInt32LE(bitmap >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 7
        ext.CreateRegionFromWindow = (region, wid, kind) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeUInt32LE(wid >>> 0, 8);
            b.writeUInt8(kind, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 8
        ext.CreateRegionFromGC = (region, gc) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(8, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeUInt32LE(gc >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 9
        ext.CreateRegionFromPicture = (region, picture) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(9, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeUInt32LE(picture >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 10
        ext.DestroyRegion = region => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(10, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(region >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 11
        ext.SetRegion = (region, rects) => {
            X.seq_num ++;
            const b = Buffer.alloc(8 + rects.length * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(11, 1);
            b.writeUInt16LE(2 + (rects.length << 1), 2);
            b.writeUInt32LE(region >>> 0, 4);
            writeRectangles(b, 8, rects);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 12
        ext.CopyRegion = (src, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(12, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(src >>> 0, 4);
            b.writeUInt32LE(dst >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 13
        ext.UnionRegion = (src1, src2, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(13, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(src1 >>> 0, 4);
            b.writeUInt32LE(src2 >>> 0, 8);
            b.writeUInt32LE(dst >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 14
        ext.IntersectRegion = (src1, src2, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(14, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(src1 >>> 0, 4);
            b.writeUInt32LE(src2 >>> 0, 8);
            b.writeUInt32LE(dst >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 15
        ext.SubtractRegion = (src1, src2, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(15, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(src1 >>> 0, 4);
            b.writeUInt32LE(src2 >>> 0, 8);
            b.writeUInt32LE(dst >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 16; bounds is { x, y, width, height }
        ext.InvertRegion = (src, bounds, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(16, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt32LE(src >>> 0, 4);
            writeRectangles(b, 8, [bounds]);
            b.writeUInt32LE(dst >>> 0, 16);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 17
        ext.TranslateRegion = (region, dx, dy) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(17, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(region >>> 0, 4);
            b.writeInt16LE(dx, 8);
            b.writeInt16LE(dy, 10);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 18
        ext.RegionExtents = (src, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(18, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(src >>> 0, 4);
            b.writeUInt32LE(dst >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 19
        ext.FetchRegion = (region, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(19, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(region >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const n_rectangles = (buf.length - 24) >> 3;
                    const res = [
                        buf.readInt16LE(0),
                        buf.readInt16LE(2),
                        buf.readUInt16LE(4),
                        buf.readUInt16LE(6)
                    ];
                    for (let i = 0; i < n_rectangles; ++i) {
                        const off = 24 + i * 8;
                        res.push(
                            buf.readInt16LE(off),
                            buf.readInt16LE(off + 2),
                            buf.readUInt16LE(off + 4),
                            buf.readUInt16LE(off + 6)
                        );
                    }
                    const reg = {
                        extents : parse_rectangle(res),
                        rectangles : []
                    };

                    for (let i = 0; i < n_rectangles; ++ i) {
                        reg.rectangles.push(parse_rectangle(res, 4 + (i << 2)));
                    }

                    return reg;
                },
                cb
            ];

            X.pack_stream.submit(true);
        }

        // opcode 20; region 0 = None (remove clip)
        ext.SetGCClipRegion = (gc, region, xOrigin, yOrigin) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(20, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(gc >>> 0, 4);
            b.writeUInt32LE(region >>> 0, 8);
            b.writeInt16LE(xOrigin, 12);
            b.writeInt16LE(yOrigin, 14);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 21; kind from ext.WindowRegionKind (+ Input: 2 with SHAPE), region 0 = None
        ext.SetWindowShapeRegion = (dest, destKind, xOffset, yOffset, region) => {
            X.seq_num ++;
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(21, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt32LE(dest >>> 0, 4);
            b.writeUInt8(destKind, 8);
            b.writeInt16LE(xOffset, 12);
            b.writeInt16LE(yOffset, 14);
            b.writeUInt32LE(region >>> 0, 16);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 22; region 0 = None
        ext.SetPictureClipRegion = (picture, region, xOrigin, yOrigin) => {
            X.seq_num ++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(22, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(picture >>> 0, 4);
            b.writeUInt32LE(region >>> 0, 8);
            b.writeInt16LE(xOrigin, 12);
            b.writeInt16LE(yOrigin, 14);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 23
        ext.SetCursorName = (cursor, name) => {
            X.seq_num ++;
            const nameBuf = Buffer.from(name, 'latin1');
            const b = Buffer.alloc(12 + pad4(nameBuf.length));
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(23, 1);
            b.writeUInt16LE(b.length >> 2, 2);
            b.writeUInt32LE(cursor >>> 0, 4);
            b.writeUInt16LE(nameBuf.length, 8);
            nameBuf.copy(b, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 24
        ext.GetCursorName = (cursor, cb) => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(24, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(cursor >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const nbytes = buf.readUInt16LE(4);
                    return {
                        atom: buf.readUInt32LE(0),
                        name: buf.toString('latin1', 24, 24 + nbytes)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // opcode 25
        ext.GetCursorImageAndName = cb => {
            X.seq_num ++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(25, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const res = parseCursorImageReply(buf);
                    res.cursorAtom = buf.readUInt32LE(16);
                    const nbytes = buf.readUInt16LE(20);
                    // the server sends the image first, the name after it
                    const nameOff = 24 + res.width * res.height * 4;
                    res.cursorName = buf.toString('latin1', nameOff, nameOff + nbytes);
                    return res;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // opcode 26
        ext.ChangeCursor = (src, dst) => {
            X.seq_num ++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(26, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(src >>> 0, 4);
            b.writeUInt32LE(dst >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 27
        ext.ChangeCursorByName = (src, name) => {
            X.seq_num ++;
            const nameBuf = Buffer.from(name, 'latin1');
            const b = Buffer.alloc(12 + pad4(nameBuf.length));
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(27, 1);
            b.writeUInt16LE(b.length >> 2, 2);
            b.writeUInt32LE(src >>> 0, 4);
            b.writeUInt16LE(nameBuf.length, 8);
            nameBuf.copy(b, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 28
        ext.ExpandRegion = (src, dst, left, right, top, bottom) => {
            X.seq_num ++;
            const b = Buffer.alloc(20);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(28, 1);
            b.writeUInt16LE(5, 2);
            b.writeUInt32LE(src >>> 0, 4);
            b.writeUInt32LE(dst >>> 0, 8);
            b.writeUInt16LE(left, 12);
            b.writeUInt16LE(right, 14);
            b.writeUInt16LE(top, 16);
            b.writeUInt16LE(bottom, 18);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 29
        ext.HideCursor = window => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(29, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 30
        ext.ShowCursor = window => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(30, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(window >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.BarrierDirections = {
            PositiveX: 1,
            PositiveY: 2,
            NegativeX: 4,
            NegativeY: 8
        };

        // opcode 31 (XFIXES 5.0); devices: optional array of XInput2 device ids
        // (empty/omitted = all master pointers)
        ext.CreatePointerBarrier = (barrier, window, x1, y1, x2, y2, directions, devices) => {
            if (!devices)
                devices = [];
            X.seq_num ++;
            const b = Buffer.alloc(28 + pad4(devices.length * 2));
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(31, 1);
            b.writeUInt16LE(b.length >> 2, 2);
            b.writeUInt32LE(barrier >>> 0, 4);
            b.writeUInt32LE(window >>> 0, 8);
            b.writeUInt16LE(x1, 12);
            b.writeUInt16LE(y1, 14);
            b.writeUInt16LE(x2, 16);
            b.writeUInt16LE(y2, 18);
            b.writeUInt32LE(directions >>> 0, 20);
            b.writeUInt16LE(devices.length, 26);
            devices.forEach((dev, i) => b.writeUInt16LE(dev, 28 + i * 2));
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // opcode 32 (XFIXES 5.0)
        ext.DeletePointerBarrier = barrier => {
            X.seq_num ++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(32, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(barrier >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.events = {
            SelectionNotify: 0,
            CursorNotify: 1
        }

        X.eventParsers[ext.firstEvent + ext.events.SelectionNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.type = type;
            event.seq = seq;
            event.subtype = code;       // ext.SelectionEvent
            event.window = extra;
            event.owner = raw.readUInt32LE(0);
            event.selection = raw.readUInt32LE(4);
            event.timestamp = raw.readUInt32LE(8);
            event.selectionTimestamp = raw.readUInt32LE(12);
            event.name = 'SelectionNotify';
            return event;
        };

        X.eventParsers[ext.firstEvent + ext.events.CursorNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            event.type = type;
            event.seq = seq;
            event.subtype = code;       // ext.CursorNotify
            event.window = extra;
            event.cursorSerial = raw.readUInt32LE(0);
            event.timestamp = raw.readUInt32LE(4);
            event.cursorName = raw.readUInt32LE(8); // atom, 0 if unnamed (XFIXES >= 2)
            event.name = 'CursorNotify';
            return event;
        };

        ext.QueryVersion(5, 0, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
