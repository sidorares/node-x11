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
