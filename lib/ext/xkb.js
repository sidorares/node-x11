// XKEYBOARD extension (partial)
// https://xorg.freedesktop.org/releases/X11R7.7/doc/kbproto/xkbproto.txt
// Wire layouts cross-checked against X11/extensions/XKBproto.h
// (note: xcb-proto xkb.xml omits the modLatches byte of LatchLockState).
//
// Implemented requests: UseExtension:0, SelectEvents:1, Bell:3, GetState:4,
// LatchLockState:5, GetControls:6, GetNames:17.
// The notoriously complex GetMap:8 (and Set* siblings) are NOT implemented.

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('XKEYBOARD', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        // DeviceSpec / BellClassSpec / IDSpec shorthands
        ext.UseCoreKbd = 0x100;
        ext.UseCorePtr = 0x200;
        ext.DfltXIClass = 0x300;
        ext.DfltXIId = 0x400;
        ext.AllXIClass = 0x500;
        ext.AllXIId = 0x600;
        ext.XINone = 0xff00;

        ext.ModMask = {
            Shift: 1, Lock: 2, Control: 4,
            Mod1: 8, Mod2: 16, Mod3: 32, Mod4: 64, Mod5: 128
        };

        ext.EventType = {
            NewKeyboardNotify: 1 << 0,
            MapNotify: 1 << 1,
            StateNotify: 1 << 2,
            ControlsNotify: 1 << 3,
            IndicatorStateNotify: 1 << 4,
            IndicatorMapNotify: 1 << 5,
            NamesNotify: 1 << 6,
            CompatMapNotify: 1 << 7,
            BellNotify: 1 << 8,
            ActionMessage: 1 << 9,
            AccessXNotify: 1 << 10,
            ExtensionDeviceNotify: 1 << 11
        };

        ext.NameDetail = {
            Keycodes: 1 << 0,
            Geometry: 1 << 1,
            Symbols: 1 << 2,
            PhysSymbols: 1 << 3,
            Types: 1 << 4,
            Compat: 1 << 5,
            KeyTypeNames: 1 << 6,
            KTLevelNames: 1 << 7,
            IndicatorNames: 1 << 8,
            KeyNames: 1 << 9,
            KeyAliases: 1 << 10,
            VirtualModNames: 1 << 11,
            GroupNames: 1 << 12,
            RGNames: 1 << 13
        };

        // UseExtension: must be the first XKB request a client issues.
        ext.UseExtension = (wantedMajor, wantedMinor, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(wantedMajor, 4);
            b.writeUInt16LE(wantedMinor, 6);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        supported: opt,
                        serverMajor: buf.readUInt16LE(0),
                        serverMinor: buf.readUInt16LE(2)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // Per-event detail payloads of SelectEvents, in wire (= bit) order.
        // [ EventType bit, details key, per-item byte width ]
        // MapNotify (bit 1) is controlled by affectMap/map, not by the switch.
        const selectEventsDetails = [
            [ext.EventType.NewKeyboardNotify, 'newKeyboardNotify', 2],
            [ext.EventType.StateNotify, 'stateNotify', 2],
            [ext.EventType.ControlsNotify, 'controlsNotify', 4],
            [ext.EventType.IndicatorStateNotify, 'indicatorStateNotify', 4],
            [ext.EventType.IndicatorMapNotify, 'indicatorMapNotify', 4],
            [ext.EventType.NamesNotify, 'namesNotify', 2],
            [ext.EventType.CompatMapNotify, 'compatMapNotify', 1],
            [ext.EventType.BellNotify, 'bellNotify', 1],
            [ext.EventType.ActionMessage, 'actionMessage', 1],
            [ext.EventType.AccessXNotify, 'accessXNotify', 2],
            [ext.EventType.ExtensionDeviceNotify, 'extensionDeviceNotify', 2]
        ];

        // SelectEvents. For every bit in (affectWhich & ~clear & ~selectAll)
        // an [ affect, details ] pair must be supplied in the `details` object,
        // keyed by event name (e.g. { stateNotify: [ 0x3fff, 0x3fff ] }).
        // Bits in `clear` / `selectAll` need no detail pair, so the common
        // "select everything about these events" call is simply
        //     SelectEvents(deviceSpec, mask, 0, mask, 0, 0)
        ext.SelectEvents = (deviceSpec, affectWhich, clear, selectAll, affectMap, map, details) => {
            const detailBits = affectWhich & ~clear & ~selectAll;
            let extraLen = 0;
            selectEventsDetails.forEach(spec => {
                if (detailBits & spec[0]) {
                    if (!details || !details[spec[1]])
                        throw new Error('xkb.SelectEvents: missing details.' + spec[1]);
                    extraLen += 2 * spec[2];
                }
            });
            const b = Buffer.alloc(16 + ((extraLen + 3) & ~3));
            X.seq_num++;
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(b.length / 4, 2);
            b.writeUInt16LE(deviceSpec, 4);
            b.writeUInt16LE(affectWhich, 6);
            b.writeUInt16LE(clear, 8);
            b.writeUInt16LE(selectAll, 10);
            b.writeUInt16LE(affectMap, 12);
            b.writeUInt16LE(map, 14);
            let off = 16;
            selectEventsDetails.forEach(spec => {
                if (!(detailBits & spec[0]))
                    return;
                const pair = details[spec[1]];
                for (let i = 0; i < 2; ++i) {
                    if (spec[2] === 1)
                        b.writeUInt8(pair[i], off);
                    else if (spec[2] === 2)
                        b.writeUInt16LE(pair[i], off);
                    else
                        b.writeUInt32LE(pair[i] >>> 0, off);
                    off += spec[2];
                }
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // Bell. name/window may be 0 (None).
        ext.Bell = (deviceSpec, bellClass, bellID, percent, forceSound, eventOnly, pitch, duration, name, window) => {
            X.seq_num++;
            const b = Buffer.alloc(28);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(7, 2);
            b.writeUInt16LE(deviceSpec, 4);
            b.writeUInt16LE(bellClass, 6);
            b.writeUInt16LE(bellID, 8);
            b.writeInt8(percent, 10);
            b.writeUInt8(forceSound ? 1 : 0, 11);
            b.writeUInt8(eventOnly ? 1 : 0, 12);
            b.writeInt16LE(pitch, 14);
            b.writeInt16LE(duration, 16);
            b.writeUInt32LE(name >>> 0, 20);
            b.writeUInt32LE(window >>> 0, 24);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.GetState = (deviceSpec, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(deviceSpec, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        deviceID: opt,
                        mods: buf[0],
                        baseMods: buf[1],
                        latchedMods: buf[2],
                        lockedMods: buf[3],
                        group: buf[4],
                        lockedGroup: buf[5],
                        baseGroup: buf.readInt16LE(6),
                        latchedGroup: buf.readInt16LE(8),
                        compatState: buf[10],
                        grabMods: buf[11],
                        compatGrabMods: buf[12],
                        lookupMods: buf[13],
                        compatLookupMods: buf[14],
                        ptrBtnState: buf.readUInt16LE(16)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.LatchLockState = (deviceSpec, affectModLocks, modLocks, lockGroup, groupLock, affectModLatches, modLatches, latchGroup, groupLatch) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt16LE(deviceSpec, 4);
            b.writeUInt8(affectModLocks, 6);
            b.writeUInt8(modLocks, 7);
            b.writeUInt8(lockGroup ? 1 : 0, 8);
            b.writeUInt8(groupLock, 9);
            b.writeUInt8(affectModLatches, 10);
            b.writeUInt8(modLatches, 11);
            b.writeUInt8(latchGroup ? 1 : 0, 13);
            b.writeInt16LE(groupLatch, 14);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.GetControls = (deviceSpec, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(deviceSpec, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const perKeyRepeat = [];
                    for (let i = 0; i < 32; ++i)
                        perKeyRepeat.push(buf[52 + i]);
                    return {
                        deviceID: opt,
                        mouseKeysDfltBtn: buf[0],
                        numGroups: buf[1],
                        groupsWrap: buf[2],
                        internalModsMask: buf[3],
                        ignoreLockModsMask: buf[4],
                        internalModsRealMods: buf[5],
                        ignoreLockModsRealMods: buf[6],
                        internalModsVmods: buf.readUInt16LE(8),
                        ignoreLockModsVmods: buf.readUInt16LE(10),
                        repeatDelay: buf.readUInt16LE(12),
                        repeatInterval: buf.readUInt16LE(14),
                        slowKeysDelay: buf.readUInt16LE(16),
                        debounceDelay: buf.readUInt16LE(18),
                        mouseKeysDelay: buf.readUInt16LE(20),
                        mouseKeysInterval: buf.readUInt16LE(22),
                        mouseKeysTimeToMax: buf.readUInt16LE(24),
                        mouseKeysMaxSpeed: buf.readUInt16LE(26),
                        mouseKeysCurve: buf.readInt16LE(28),
                        accessXOption: buf.readUInt16LE(30),
                        accessXTimeout: buf.readUInt16LE(32),
                        accessXTimeoutOptionsMask: buf.readUInt16LE(34),
                        accessXTimeoutOptionsValues: buf.readUInt16LE(36),
                        accessXTimeoutMask: buf.readUInt32LE(40),
                        accessXTimeoutValues: buf.readUInt32LE(44),
                        enabledControls: buf.readUInt32LE(48),
                        perKeyRepeat: perKeyRepeat
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        const popcount = v => {
            let n = 0;
            for (; v; v >>>= 1)
                n += v & 1;
            return n;
        }

        ext.GetNames = (deviceSpec, which, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(17, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt16LE(deviceSpec, 4);
            b.writeUInt32LE(which >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const names = {
                        deviceID: opt,
                        which: buf.readUInt32LE(0),
                        minKeyCode: buf[4],
                        maxKeyCode: buf[5],
                        nTypes: buf[6],
                        groupNames: buf[7],
                        virtualMods: buf.readUInt16LE(8),
                        firstKey: buf[10],
                        nKeys: buf[11],
                        indicators: buf.readUInt32LE(12),
                        nRadioGroups: buf[16],
                        nKeyAliases: buf[17],
                        nKTLevels: buf.readUInt16LE(18)
                    };
                    let off = 24;
                    const atom = () => {
                        const v = buf.readUInt32LE(off);
                        off += 4;
                        return v;
                    };
                    const atoms = n => {
                        const list = [];
                        for (let i = 0; i < n; ++i)
                            list.push(atom());
                        return list;
                    };
                    const w = names.which;
                    const nd = ext.NameDetail;
                    // value-list order matches the server's write order
                    // (which is NOT ascending bit order for the last groups)
                    if (w & nd.Keycodes)
                        names.keycodesName = atom();
                    if (w & nd.Geometry)
                        names.geometryName = atom();
                    if (w & nd.Symbols)
                        names.symbolsName = atom();
                    if (w & nd.PhysSymbols)
                        names.physSymbolsName = atom();
                    if (w & nd.Types)
                        names.typesName = atom();
                    if (w & nd.Compat)
                        names.compatName = atom();
                    if (w & nd.KeyTypeNames)
                        names.typeNames = atoms(names.nTypes);
                    if (w & nd.KTLevelNames) {
                        const nLevelsPerType = [];
                        for (let i = 0; i < names.nTypes; ++i)
                            nLevelsPerType.push(buf[off + i]);
                        off += (names.nTypes + 3) & ~3;
                        names.nLevelsPerType = nLevelsPerType;
                        names.ktLevelNames = atoms(nLevelsPerType.reduce((a, v) => a + v, 0));
                    }
                    if (w & nd.IndicatorNames)
                        names.indicatorNames = atoms(popcount(names.indicators));
                    if (w & nd.VirtualModNames)
                        names.virtualModNames = atoms(popcount(names.virtualMods));
                    if (w & nd.GroupNames)
                        names.groupNamesList = atoms(popcount(names.groupNames));
                    if (w & nd.KeyNames) {
                        names.keyNames = [];
                        for (let i = 0; i < names.nKeys; ++i) {
                            const raw = buf.toString('latin1', off, off + 4);
                            names.keyNames.push(raw.replace(/\0+$/, ''));
                            off += 4;
                        }
                    }
                    if (w & nd.KeyAliases) {
                        names.keyAliases = [];
                        for (let i = 0; i < names.nKeyAliases; ++i) {
                            names.keyAliases.push({
                                real: buf.toString('latin1', off, off + 4).replace(/\0+$/, ''),
                                alias: buf.toString('latin1', off + 4, off + 8).replace(/\0+$/, '')
                            });
                            off += 8;
                        }
                    }
                    if (w & nd.RGNames)
                        names.radioGroupNames = atoms(names.nRadioGroups);
                    return names;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // XKB multiplexes all its events on one event code; byte 1 of the
        // event ("code" here) is the xkbType.
        ext.events = {
            StateNotify: 2,
            BellNotify: 8
        };

        X.eventParsers[ext.firstEvent] = (type, seq, extra, code, raw) => {
            const event = {
                type: type,
                seq: seq,
                xkbType: code,
                time: extra,
                deviceID: raw[0]
            };
            if (code === ext.events.StateNotify) {
                event.name = 'XkbStateNotify';
                event.mods = raw[1];
                event.baseMods = raw[2];
                event.latchedMods = raw[3];
                event.lockedMods = raw[4];
                event.group = raw[5];
                event.baseGroup = raw.readInt16LE(6);
                event.latchedGroup = raw.readInt16LE(8);
                event.lockedGroup = raw[10];
                event.compatState = raw[11];
                event.grabMods = raw[12];
                event.compatGrabMods = raw[13];
                event.lookupMods = raw[14];
                event.compatLookupMods = raw[15];
                event.ptrBtnState = raw.readUInt16LE(16);
                event.changed = raw.readUInt16LE(18);
                event.keycode = raw[20];
                event.eventType = raw[21];
                event.requestMajor = raw[22];
                event.requestMinor = raw[23];
            } else if (code === ext.events.BellNotify) {
                event.name = 'XkbBellNotify';
                event.bellClass = raw[1];
                event.bellID = raw[2];
                event.percent = raw[3];
                event.pitch = raw.readUInt16LE(4);
                event.duration = raw.readUInt16LE(6);
                event.atomName = raw.readUInt32LE(8);
                event.window = raw.readUInt32LE(12);
                event.eventOnly = raw[16];
            } else {
                event.name = 'XkbEvent';
                event.raw = raw;
            }
            return event;
        };

        // The protocol requires UseExtension before any other XKB request.
        ext.UseExtension(1, 0, (err, res) => {
            if (err)
                return callback(err);
            ext.supported = res.supported;
            ext.serverMajor = res.serverMajor;
            ext.serverMinor = res.serverMinor;
            callback(null, ext);
        });
    });
}
