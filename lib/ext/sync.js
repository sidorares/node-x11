// SYNC extension protocol
// https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/sync.txt
// wire format: autogen/proto/sync.xml

// INT64 values are transported as (hi: INT32, lo: CARD32) pairs and composed
// into plain JS numbers. Values with |value| > 2^53 lose precision (the public
// API deliberately avoids BigInt).
const readInt64 = (buf, offset) => {
    const hi = buf.readInt32LE(offset);
    const lo = buf.readUInt32LE(offset + 4);
    return hi * 0x100000000 + lo;
};

const writeInt64 = (buf, value, offset) => {
    const hi = Math.floor(value / 0x100000000);
    const lo = value - hi * 0x100000000;
    buf.writeInt32LE(hi, offset);
    buf.writeUInt32LE(lo >>> 0, offset + 4);
};

// [ attribute name, CA mask bit, is INT64 ] — order is the wire order of the
// value-list, INT64 entries occupy 8 bytes in the list.
const alarmAttributes = [
    ['counter',   1 << 0, false],
    ['valueType', 1 << 1, false],
    ['value',     1 << 2, true],
    ['testType',  1 << 3, false],
    ['delta',     1 << 4, true],
    ['events',    1 << 5, false]
];

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('SYNC', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.ValueType = {
            Absolute: 0,
            Relative: 1
        };

        ext.TestType = {
            PositiveTransition: 0,
            NegativeTransition: 1,
            PositiveComparison: 2,
            NegativeComparison: 3
        };

        ext.AlarmState = {
            Active: 0,
            Inactive: 1,
            Destroyed: 2
        };

        ext.CA = {
            Counter: 1 << 0,
            ValueType: 1 << 1,
            Value: 1 << 2,
            TestType: 1 << 3,
            Delta: 1 << 4,
            Events: 1 << 5
        };

        ext.Initialize = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt8(clientMaj, 4);
            b.writeUInt8(clientMin, 5);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt8(0), buf.readUInt8(1)];
                },
                cb
            ];
            X.pack_stream.submit(true);
        };

        ext.ListSystemCounters = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const nCounters = buf.readUInt32LE(0);
                    const counters = [];
                    let off = 24;
                    for (let i = 0; i < nCounters; ++i) {
                        const counter = buf.readUInt32LE(off);
                        const resolution = readInt64(buf, off + 4);
                        const nameLen = buf.readUInt16LE(off + 12);
                        const name = buf.toString('ascii', off + 14, off + 14 + nameLen);
                        counters.push({ counter, resolution, name });
                        off += 14 + nameLen;
                        off += (4 - (off & 3)) & 3; // each entry is padded to 4 bytes
                    }
                    return counters;
                },
                cb
            ];
            X.pack_stream.submit(true);
        };

        ext.CreateCounter = (id, initialValue) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(id >>> 0, 4);
            writeInt64(b, initialValue, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        ext.SetCounter = (counter, value) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(counter >>> 0, 4);
            writeInt64(b, value, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        ext.ChangeCounter = (counter, amount) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(counter >>> 0, 4);
            writeInt64(b, amount, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        ext.QueryCounter = (counter, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(counter >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return readInt64(buf, 0);
                },
                cb
            ];
            X.pack_stream.submit(true);
        };

        ext.DestroyCounter = counter => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(counter >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        // waitList: array of { counter, valueType, value, testType, eventThreshold }
        // Blocks (server side) further request processing for this client until
        // at least one condition is satisfied.
        ext.Await = waitList => {
            X.seq_num++;
            const b = Buffer.alloc(4 + waitList.length * 28);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(1 + waitList.length * 7, 2);
            let off = 4;
            waitList.forEach(cond => {
                b.writeUInt32LE(cond.counter >>> 0, off);
                b.writeUInt32LE(cond.valueType || 0, off + 4);
                writeInt64(b, cond.value || 0, off + 8);
                b.writeUInt32LE(cond.testType || 0, off + 16);
                writeInt64(b, cond.eventThreshold || 0, off + 20);
                off += 28;
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        const packAlarmRequest = (minorOpcode, id, values) => {
            let mask = 0;
            let size = 0;
            alarmAttributes.forEach(attr => {
                if (values[attr[0]] !== undefined) {
                    mask |= attr[1];
                    size += attr[2] ? 8 : 4;
                }
            });
            const b = Buffer.alloc(12 + size);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(minorOpcode, 1);
            b.writeUInt16LE((12 + size) >> 2, 2);
            b.writeUInt32LE(id >>> 0, 4);
            b.writeUInt32LE(mask >>> 0, 8);
            let off = 12;
            alarmAttributes.forEach(attr => {
                const value = values[attr[0]];
                if (value === undefined)
                    return;
                if (attr[2]) {
                    writeInt64(b, value, off);
                    off += 8;
                } else {
                    b.writeUInt32LE(+value >>> 0, off);
                    off += 4;
                }
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        // values: { counter, valueType, value, testType, delta, events }
        // omitted attributes keep server defaults (value-mask style request)
        ext.CreateAlarm = (id, values) => {
            X.seq_num++;
            packAlarmRequest(8, id, values || {});
        };

        ext.ChangeAlarm = (id, values) => {
            X.seq_num++;
            packAlarmRequest(9, id, values || {});
        };

        ext.QueryAlarm = (alarm, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(10, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(alarm >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        trigger: {
                            counter: buf.readUInt32LE(0),
                            waitType: buf.readUInt32LE(4),
                            waitValue: readInt64(buf, 8),
                            testType: buf.readUInt32LE(16)
                        },
                        delta: readInt64(buf, 20),
                        events: !!buf.readUInt8(28),
                        state: buf.readUInt8(29)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        };

        ext.DestroyAlarm = alarm => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(11, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(alarm >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        // id: client resource XID, or 0 for the requesting client
        ext.SetPriority = (id, priority) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(12, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(id >>> 0, 4);
            b.writeInt32LE(priority, 8);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        ext.GetPriority = (id, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(13, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(id >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return buf.readInt32LE(0);
                },
                cb
            ];
            X.pack_stream.submit(true);
        };

        // Fence requests (SYNC 3.1)

        ext.CreateFence = (drawable, fence, initiallyTriggered) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(14, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(fence >>> 0, 8);
            b.writeUInt8(initiallyTriggered ? 1 : 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        const simpleFenceRequest = minorOpcode => fence => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(minorOpcode, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(fence >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        ext.TriggerFence = simpleFenceRequest(15);
        ext.ResetFence = simpleFenceRequest(16);
        ext.DestroyFence = simpleFenceRequest(17);

        ext.QueryFence = (fence, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(18, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(fence >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return !!buf.readUInt8(0);
                },
                cb
            ];
            X.pack_stream.submit(true);
        };

        // Blocks (server side) further request processing for this client until
        // all fences in the list are in the triggered state.
        ext.AwaitFence = fenceList => {
            X.seq_num++;
            const b = Buffer.alloc(4 + fenceList.length * 4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(19, 1);
            b.writeUInt16LE(1 + fenceList.length, 2);
            fenceList.forEach((fence, i) => {
                b.writeUInt32LE(fence >>> 0, 4 + i * 4);
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        };

        ext.events = {
            CounterNotify: 0,
            AlarmNotify: 1
        };

        X.eventParsers[ext.firstEvent + ext.events.CounterNotify] = (type, seq, extra, code, raw) => {
            return {
                type,
                seq,
                name: 'CounterNotify',
                kind: code,
                counter: extra,
                waitValue: readInt64(raw, 0),
                counterValue: readInt64(raw, 8),
                time: raw.readUInt32LE(16),
                count: raw.readUInt16LE(20),
                destroyed: !!raw.readUInt8(22)
            };
        };

        X.eventParsers[ext.firstEvent + ext.events.AlarmNotify] = (type, seq, extra, code, raw) => {
            return {
                type,
                seq,
                name: 'AlarmNotify',
                kind: code,
                alarm: extra,
                counterValue: readInt64(raw, 0),
                alarmValue: readInt64(raw, 8),
                time: raw.readUInt32LE(16),
                state: raw.readUInt8(20)
            };
        };

        // the protocol requires Initialize before any other SYNC request
        ext.Initialize(3, 1, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
};
