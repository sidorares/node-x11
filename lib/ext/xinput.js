// XInputExtension (partial): XI1 GetExtensionVersion / ListInputDevices
// plus XI2 XIQueryVersion / XIQueryDevice.
// https://xorg.freedesktop.org/releases/X11R7.7/doc/inputproto/XIproto.txt
// Wire layouts cross-checked against X11/extensions/XIproto.h and XI2proto.h.

const extName = 'XInputExtension';

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension(extName, (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        // XI1 device use
        ext.DeviceUse = {
            IsXPointer: 0,
            IsXKeyboard: 1,
            IsXExtensionDevice: 2,
            IsXExtensionKeyboard: 3,
            IsXExtensionPointer: 4
        };
        // XI1 input class ids
        ext.InputClass = {
            Key: 0, Button: 1, Valuator: 2,
            Feedback: 3, Proximity: 4, Focus: 5, Other: 6
        };
        // XI2 device types
        ext.DeviceType = {
            MasterPointer: 1,
            MasterKeyboard: 2,
            SlavePointer: 3,
            SlaveKeyboard: 4,
            FloatingSlave: 5
        };
        // XI2 device class types
        ext.ClassType = {
            Key: 0, Button: 1, Valuator: 2, Scroll: 3, Touch: 8, Gesture: 9
        };
        ext.AllDevices = 0;
        ext.AllMasterDevices = 1;

        // XI2 event types. These are the `evtype` field of the GenericEvent,
        // and the bit position of the corresponding XISelectEvents mask.
        ext.EventType = {
            DeviceChanged: 1,
            KeyPress: 2,
            KeyRelease: 3,
            ButtonPress: 4,
            ButtonRelease: 5,
            Motion: 6,
            Enter: 7,
            Leave: 8,
            FocusIn: 9,
            FocusOut: 10,
            HierarchyChanged: 11,
            PropertyEvent: 12,
            RawKeyPress: 13,
            RawKeyRelease: 14,
            RawButtonPress: 15,
            RawButtonRelease: 16,
            RawMotion: 17,
            TouchBegin: 18,
            TouchUpdate: 19,
            TouchEnd: 20,
            TouchOwnership: 21,
            RawTouchBegin: 22,
            RawTouchUpdate: 23,
            RawTouchEnd: 24,
            BarrierHit: 25,
            BarrierLeave: 26
        };

        // Mask bits for XISelectEvents: one per event type, at its own number.
        ext.EventMask = {};
        for (const name in ext.EventType)
            ext.EventMask[name] = 1 << ext.EventType[name];

        // Per-event `flags`
        ext.KeyEventFlags = { KeyRepeat: 1 << 16 };
        ext.PointerEventFlags = { PointerEmulated: 1 << 16 };
        ext.TouchEventFlags = { TouchPendingEnd: 1 << 16, TouchEmulating: 1 << 17 };

        // XI1 GetExtensionVersion (opcode 1)
        ext.GetExtensionVersion = cb => {
            X.seq_num++;
            const nameLen = extName.length;
            const b = Buffer.alloc(8 + ((nameLen + 3) & ~3));
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(b.length / 4, 2);
            b.writeUInt16LE(nameLen, 4);
            b.write(extName, 8, 'latin1');
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        serverMajor: buf.readUInt16LE(0),
                        serverMinor: buf.readUInt16LE(2),
                        present: buf[4]
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        }

        // XI1 ListInputDevices (opcode 2)
        ext.ListInputDevices = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const nDevices = buf[0];
                    const devices = [];
                    let off = 24;
                    for (let i = 0; i < nDevices; ++i) {
                        devices.push({
                            type: buf.readUInt32LE(off),
                            id: buf[off + 4],
                            numClasses: buf[off + 5],
                            use: buf[off + 6],
                            attached: buf[off + 7],
                            classes: []
                        });
                        off += 8;
                    }
                    // class info structs, per device, in device order
                    devices.forEach(dev => {
                        for (let i = 0; i < dev.numClasses; ++i) {
                            const classId = buf[off];
                            const len = buf[off + 1]; // length in bytes
                            const cls = { classId: classId };
                            if (classId === ext.InputClass.Key) {
                                cls.minKeycode = buf[off + 2];
                                cls.maxKeycode = buf[off + 3];
                                cls.numKeys = buf.readUInt16LE(off + 4);
                            } else if (classId === ext.InputClass.Button) {
                                cls.numButtons = buf.readUInt16LE(off + 2);
                            } else if (classId === ext.InputClass.Valuator) {
                                cls.mode = buf[off + 3];
                                cls.motionBufferSize = buf.readUInt32LE(off + 4);
                                cls.axes = [];
                                const numAxes = buf[off + 2];
                                for (let a = 0; a < numAxes; ++a) {
                                    const aoff = off + 8 + a * 12;
                                    cls.axes.push({
                                        resolution: buf.readUInt32LE(aoff),
                                        min: buf.readInt32LE(aoff + 4),
                                        max: buf.readInt32LE(aoff + 8)
                                    });
                                }
                            }
                            dev.classes.push(cls);
                            off += len;
                        }
                    });
                    // names: one counted (Pascal-style) string per device
                    devices.forEach(dev => {
                        const nameLen = buf[off];
                        dev.name = buf.toString('latin1', off + 1, off + 1 + nameLen);
                        off += 1 + nameLen;
                    });
                    return devices;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        // XI2 XIQueryVersion (opcode 47). Announces the client's supported
        // version; must precede any other XI2 request.
        ext.XIQueryVersion = (clientMajor, clientMinor, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(47, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(clientMajor, 4);
            b.writeUInt16LE(clientMinor, 6);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        majorVersion: buf.readUInt16LE(0),
                        minorVersion: buf.readUInt16LE(2)
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        }

        // FP3232 fixed point -> Number (53-bit mantissa: fine for input axes)
        const fp3232 = (buf, off) =>
            buf.readInt32LE(off) + buf.readUInt32LE(off + 4) / 0x100000000;

        const parseDeviceClass = (buf, off) => {
            const cls = {
                type: buf.readUInt16LE(off),
                sourceId: buf.readUInt16LE(off + 4)
            };
            if (cls.type === ext.ClassType.Key) {
                const numKeycodes = buf.readUInt16LE(off + 6);
                cls.keycodes = [];
                for (let i = 0; i < numKeycodes; ++i)
                    cls.keycodes.push(buf.readUInt32LE(off + 8 + i * 4));
            } else if (cls.type === ext.ClassType.Button) {
                const numButtons = buf.readUInt16LE(off + 6);
                cls.numButtons = numButtons;
                const maskWords = (numButtons + 31) >> 5;
                cls.state = [];
                for (let i = 0; i < maskWords; ++i)
                    cls.state.push(buf.readUInt32LE(off + 8 + i * 4));
                cls.labels = [];
                for (let i = 0; i < numButtons; ++i)
                    cls.labels.push(buf.readUInt32LE(off + 8 + maskWords * 4 + i * 4));
            } else if (cls.type === ext.ClassType.Valuator) {
                cls.number = buf.readUInt16LE(off + 6);
                cls.label = buf.readUInt32LE(off + 8);
                cls.min = fp3232(buf, off + 12);
                cls.max = fp3232(buf, off + 20);
                cls.value = fp3232(buf, off + 28);
                cls.resolution = buf.readUInt32LE(off + 36);
                cls.mode = buf[off + 40];
            } else if (cls.type === ext.ClassType.Scroll) {
                cls.number = buf.readUInt16LE(off + 6);
                cls.scrollType = buf.readUInt16LE(off + 8);
                cls.flags = buf.readUInt32LE(off + 12);
                cls.increment = fp3232(buf, off + 16);
            }
            return cls;
        }

        // XI2 XIQueryDevice (opcode 48).
        // deviceId: a device id, or AllDevices (0) / AllMasterDevices (1).
        ext.XIQueryDevice = (deviceId, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(48, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(deviceId, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const nDevices = buf.readUInt16LE(0);
                    const devices = [];
                    let off = 24;
                    for (let i = 0; i < nDevices; ++i) {
                        const dev = {
                            deviceId: buf.readUInt16LE(off),
                            use: buf.readUInt16LE(off + 2),
                            attachment: buf.readUInt16LE(off + 4),
                            enabled: buf[off + 10],
                            classes: []
                        };
                        const numClasses = buf.readUInt16LE(off + 6);
                        const nameLen = buf.readUInt16LE(off + 8);
                        off += 12;
                        dev.name = buf.toString('latin1', off, off + nameLen);
                        off += (nameLen + 3) & ~3;
                        for (let c = 0; c < numClasses; ++c) {
                            dev.classes.push(parseDeviceClass(buf, off));
                            off += buf.readUInt16LE(off + 2) * 4; // length is in 4-byte units
                        }
                        devices.push(dev);
                    }
                    return devices;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        // XI2 XISelectEvents (opcode 46). Void.
        //
        // `masks` is one entry per device, or a single entry on its own:
        //   { deviceId, mask }   mask being a bitmask from ext.EventMask,
        //                        or an array of event-type names or numbers
        //
        // Selecting replaces this client's selection on that window for that
        // device rather than adding to it, so an empty mask deselects. Note
        // the device is part of the key: selecting on AllMasterDevices does
        // not clear a selection made on a specific device.
        ext.XISelectEvents = (window, masks) => {
            const list = Array.isArray(masks) ? masks : [masks];
            // widest bit anyone asked for decides the mask length; the wire
            // format counts it in 4-byte units per device
            const entries = list.map(entry => {
                let bits = entry.mask;
                if (Array.isArray(bits)) {
                    bits = bits.reduce((acc, e) => {
                        const type = typeof e === 'string' ? ext.EventType[e] : e;
                        if (type === undefined)
                            throw new Error(`xinput.XISelectEvents: unknown event type ${e}`);
                        return acc | (1 << type);
                    }, 0);
                }
                bits = bits >>> 0;
                let bytes = 0;
                for (let b = bits; b; b >>>= 1) bytes++;
                const maskLen = Math.ceil(bytes / 32) || 1;
                return { deviceId: entry.deviceId, bits, maskLen };
            });

            const bodyLen = entries.reduce((n, e) => n + 4 + e.maskLen * 4, 0);
            const b = Buffer.alloc(12 + bodyLen);
            X.seq_num++;
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(46, 1);
            b.writeUInt16LE(b.length / 4, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt16LE(entries.length, 8);
            let off = 12;
            for (const e of entries) {
                b.writeUInt16LE(e.deviceId, off);
                b.writeUInt16LE(e.maskLen, off + 2);
                // little-endian bit order within the mask, low word first
                for (let w = 0; w < e.maskLen; ++w)
                    b.writeUInt32LE(w === 0 ? e.bits : 0, off + 4 + w * 4);
                off += 4 + e.maskLen * 4;
            }
            X.pack_stream.put(b);
            return X.pack_stream.flush();
        }

        // FP1616 fixed point -> Number, the screen-coordinate form
        const fp1616 = (buf, off) => buf.readInt32LE(off) / 65536;

        /** Bits set in a little-endian mask of `len` 4-byte words at `off`. */
        const maskBits = (buf, off, len) => {
            const set = [];
            for (let w = 0; w < len; ++w) {
                const word = buf.readUInt32LE(off + w * 4);
                for (let bit = 0; bit < 32; ++bit)
                    if (word & (1 << bit)) set.push(w * 32 + bit);
            }
            return set;
        };

        // XI2 GenericEvent parsers. `raw` starts at absolute byte 8, so every
        // offset here is the XI2proto.h struct offset minus 8.
        //
        // The three event shapes: device events carry a full pointer state
        // and a valuator mask, raw events carry the device's own unaccelerated
        // axis values and no window, and both put their axis values behind a
        // variable-length mask rather than at a fixed offset.
        const parseDeviceEvent = (event, raw) => {
            event.deviceId = raw.readUInt16LE(2);
            event.time = raw.readUInt32LE(4);
            event.detail = raw.readUInt32LE(8);   // keycode, or button number
            event.root = raw.readUInt32LE(12);
            event.wid = raw.readUInt32LE(16);
            event.child = raw.readUInt32LE(20);
            event.rootx = fp1616(raw, 24);
            event.rooty = fp1616(raw, 28);
            event.x = fp1616(raw, 32);
            event.y = fp1616(raw, 36);
            const buttonsLen = raw.readUInt16LE(40);
            const valuatorsLen = raw.readUInt16LE(42);
            event.sourceId = raw.readUInt16LE(44);
            event.flags = raw.readUInt32LE(48);
            event.mods = {
                base: raw.readUInt32LE(52),
                latched: raw.readUInt32LE(56),
                locked: raw.readUInt32LE(60),
                effective: raw.readUInt32LE(64)
            };
            event.group = {
                base: raw[68],
                latched: raw[69],
                locked: raw[70],
                effective: raw[71]
            };
            event.buttons = maskBits(raw, 72, buttonsLen);
            const valuatorMaskAt = 72 + buttonsLen * 4;
            const axes = maskBits(raw, valuatorMaskAt, valuatorsLen);
            let off = valuatorMaskAt + valuatorsLen * 4;
            event.valuators = {};
            for (const axis of axes) {
                event.valuators[axis] = fp3232(raw, off);
                off += 8;
            }
            return event;
        };

        const parseRawEvent = (event, raw) => {
            event.deviceId = raw.readUInt16LE(2);
            event.time = raw.readUInt32LE(4);
            event.detail = raw.readUInt32LE(8);
            event.sourceId = raw.readUInt16LE(12);
            const valuatorsLen = raw.readUInt16LE(14);
            event.flags = raw.readUInt32LE(16);
            const axes = maskBits(raw, 24, valuatorsLen);
            // two FP3232 arrays follow the mask: the values after the pointer
            // acceleration curve, then the device's own numbers. A scroll
            // wheel reports its increment in the raw pair and nothing useful
            // in the accelerated one.
            let off = 24 + valuatorsLen * 4;
            event.valuators = {};
            event.rawValuators = {};
            for (const axis of axes) {
                event.valuators[axis] = fp3232(raw, off);
                off += 8;
            }
            for (const axis of axes) {
                event.rawValuators[axis] = fp3232(raw, off);
                off += 8;
            }
            return event;
        };

        const eventNames = {};
        for (const name in ext.EventType)
            eventNames[ext.EventType[name]] = `XI${name}`;

        const DEVICE_EVENTS = new Set([
            ext.EventType.KeyPress, ext.EventType.KeyRelease,
            ext.EventType.ButtonPress, ext.EventType.ButtonRelease,
            ext.EventType.Motion,
            ext.EventType.TouchBegin, ext.EventType.TouchUpdate, ext.EventType.TouchEnd
        ]);
        const RAW_EVENTS = new Set([
            ext.EventType.RawKeyPress, ext.EventType.RawKeyRelease,
            ext.EventType.RawButtonPress, ext.EventType.RawButtonRelease,
            ext.EventType.RawMotion,
            ext.EventType.RawTouchBegin, ext.EventType.RawTouchUpdate, ext.EventType.RawTouchEnd
        ]);

        X.geEventParsers[ext.majorOpcode] = (type, seq, extra, code, raw) => {
            const evtype = raw.readUInt16LE(0);
            const event = {
                type: type,
                seq: seq,
                extension: code,
                evtype: evtype,
                name: eventNames[evtype] || `XIEvent${evtype}`
            };
            if (DEVICE_EVENTS.has(evtype))
                return parseDeviceEvent(event, raw);
            if (RAW_EVENTS.has(evtype))
                return parseRawEvent(event, raw);
            // Everything else - DeviceChanged, Enter/Leave, Focus,
            // HierarchyChanged, PropertyEvent, barriers - shares only the
            // first eight bytes. Report those and leave the body raw rather
            // than guessing at layouts this has no way to exercise yet.
            event.deviceId = raw.readUInt16LE(2);
            event.time = raw.readUInt32LE(4);
            event.data = raw;
            return event;
        };

        // Announce XI2 support (required by the XI2 spec before other XI2
        // requests), then report the XI1 extension version.
        ext.XIQueryVersion(2, 2, (err, xi2) => {
            if (err) {
                // pre-XI2 server: still usable for the XI1 requests
                ext.xi2 = null;
            } else {
                ext.xi2 = xi2;
            }
            ext.GetExtensionVersion((err, vers) => {
                if (err)
                    return callback(err);
                ext.serverMajor = vers.serverMajor;
                ext.serverMinor = vers.serverMinor;
                callback(null, ext);
            });
        });
    });
}
