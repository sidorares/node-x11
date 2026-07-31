const assert = require('assert');
const x11 = require('../lib');
const { unpackEvent, packers, eventTypes } = require('../lib/generated/core-events');

// The client splits a 32-byte packet exactly like this before parsing
// (lib/xcore.js, expectReplyHeader), so tests can parse a packed buffer
// without a server in the loop.
function parse(buf) {
    return unpackEvent(buf[0] & 0x7f, buf.readUInt16LE(2), buf.readUInt32LE(4),
        buf[1], buf.slice(8), buf);
}

describe('packEvent', () => {

    describe('wire layout', () => {
        // Hand-written from the protocol/ICCCM encodings rather than from the
        // parsers, so these fail if the generated field map itself drifts.

        it('packs ClientMessage: format in the detail byte, window, type, 5 longs', () => {
            const buf = x11.packEvent({
                name: 'ClientMessage',
                format: 32,
                wid: 0x00c00007,
                message_type: 0x0000015a,
                data: [1, 2, 3, 4, 5]
            });
            assert.strictEqual(buf.length, 32);
            assert.strictEqual(buf[0], 33);
            assert.strictEqual(buf[1], 32);
            assert.strictEqual(buf.readUInt16LE(2), 0, 'sequence number is the server\'s to fill in');
            assert.strictEqual(buf.readUInt32LE(4), 0x00c00007);
            assert.strictEqual(buf.readUInt32LE(8), 0x0000015a);
            for (let i = 0; i < 5; i++)
                assert.strictEqual(buf.readUInt32LE(12 + i * 4), i + 1);
        });

        it('packs ClientMessage data as 10 shorts at format 16 and 20 bytes at format 8', () => {
            const short = x11.packEvent({
                name: 'ClientMessage', format: 16, wid: 1, message_type: 2,
                data: [0x1111, 0x2222]
            });
            assert.strictEqual(short[1], 16);
            assert.strictEqual(short.readUInt16LE(12), 0x1111);
            assert.strictEqual(short.readUInt16LE(14), 0x2222);
            assert.strictEqual(short.readUInt16LE(16), 0, 'unused data is zeroed');

            const byte = x11.packEvent({
                name: 'ClientMessage', format: 8, wid: 1, message_type: 2,
                data: [0xde, 0xad]
            });
            assert.strictEqual(byte[1], 8);
            assert.strictEqual(byte[12], 0xde);
            assert.strictEqual(byte[13], 0xad);
            assert.strictEqual(byte[14], 0);
        });

        it('packs SelectionNotify the way a selection owner answers a request', () => {
            // ICCCM 2.2: echo time/requestor/selection/target, property = None
            // to refuse.
            const buf = x11.packEvent({
                name: 'SelectionNotify',
                time: 0x11223344,
                requestor: 0x00a00001,
                selection: 40,
                target: 31,
                property: 0
            });
            assert.strictEqual(buf[0], 31);
            assert.strictEqual(buf.readUInt32LE(4), 0x11223344);
            assert.strictEqual(buf.readUInt32LE(8), 0x00a00001);
            assert.strictEqual(buf.readUInt32LE(12), 40);
            assert.strictEqual(buf.readUInt32LE(16), 31);
            assert.strictEqual(buf.readUInt32LE(20), 0);
        });

        it('packs the ICCCM 4.1.5 synthetic ConfigureNotify', () => {
            // `wid` is the event window and `wid1` the configured window —
            // for this message both are the client's top-level window.
            const buf = x11.packEvent({
                name: 'ConfigureNotify',
                wid: 0x00a00001,
                wid1: 0x00a00001,
                aboveSibling: 0,
                x: 100, y: -20, width: 640, height: 480,
                borderWidth: 0,
                overrideRedirect: 0
            });
            assert.strictEqual(buf[0], 22);
            assert.strictEqual(buf.readUInt32LE(4), 0x00a00001);
            assert.strictEqual(buf.readUInt32LE(8), 0x00a00001);
            assert.strictEqual(buf.readUInt32LE(12), 0);
            assert.strictEqual(buf.readInt16LE(16), 100);
            assert.strictEqual(buf.readInt16LE(18), -20, 'negative coordinates wrap, they do not throw');
            assert.strictEqual(buf.readUInt16LE(20), 640);
            assert.strictEqual(buf.readUInt16LE(22), 480);
            assert.strictEqual(buf.readUInt16LE(24), 0);
            assert.strictEqual(buf[26], 0);
        });

        it('packs the ICCCM synthetic UnmapNotify used to withdraw a window', () => {
            // Here event and window differ: the event window is the root.
            const buf = x11.packEvent({
                name: 'UnmapNotify',
                event: 0x00000129,
                wid: 0x00a00001,
                fromConfigure: false
            });
            assert.strictEqual(buf[0], 18);
            assert.strictEqual(buf.readUInt32LE(4), 0x00000129);
            assert.strictEqual(buf.readUInt32LE(8), 0x00a00001);
            assert.strictEqual(buf[12], 0);
        });

        it('leaves the 0x80 synthetic bit to the server', () => {
            assert.strictEqual(x11.packEvent({ name: 'Expose', wid: 1 })[0], 12);
            // ... and accepts a numeric type that already has it set
            assert.strictEqual(x11.packEvent({ type: 12 | 0x80, wid: 1 })[0], 12);
        });

        it('zeroes a reused buffer so no stale bytes leak into the pads', () => {
            const buf = Buffer.alloc(32, 0xff);
            x11.packEvent({ name: 'Expose', wid: 0, x: 0, y: 0, width: 0, height: 0, count: 0 }, buf);
            assert.deepStrictEqual(buf, Buffer.concat([Buffer.from([12]), Buffer.alloc(31)]));
        });

        it('packs into a larger buffer and returns the 32 bytes of the event', () => {
            const slot = Buffer.alloc(64, 0xff);
            const out = x11.packEvent({ name: 'Expose', wid: 7 }, slot);
            assert.strictEqual(out.length, 32, 'SendEvent takes exactly 32 bytes');
            assert.strictEqual(out.readUInt32LE(4), 7);
            assert.strictEqual(slot[31], 0, 'the event bytes are zeroed');
            assert.strictEqual(slot[32], 0xff, 'the rest of the caller\'s buffer is left alone');
        });
    });

    describe('values wider than their field wrap instead of throwing', () => {
        // Buffer.write* throws ERR_OUT_OF_RANGE on values a field cannot
        // hold. Events routinely carry such values — XDND composes data words
        // as (x << 16) | y, which is negative in JS — so the packers mask.

        it('32-bit fields take negative and full-range values', () => {
            const buf = x11.packEvent({
                name: 'SelectionNotify',
                time: -1,
                requestor: 0xffffffff,
                selection: 0x80000000,
                target: (40000 << 16) | 300,
                property: 0
            });
            assert.strictEqual(buf.readUInt32LE(4), 0xffffffff);
            assert.strictEqual(buf.readUInt32LE(8), 0xffffffff);
            assert.strictEqual(buf.readUInt32LE(12), 0x80000000);
            assert.strictEqual(buf.readUInt32LE(16), ((40000 << 16) | 300) >>> 0);
        });

        it('ClientMessage data words keep their bits at every format', () => {
            const wide = x11.packEvent({
                name: 'ClientMessage', format: 32, wid: 1, message_type: 2,
                data: [(40000 << 16) | 300, -1, 0xffffffff, 0x80000000, 0]
            });
            assert.strictEqual(wide.readUInt32LE(12), ((40000 << 16) | 300) >>> 0);
            assert.strictEqual(wide.readUInt32LE(16), 0xffffffff);
            assert.strictEqual(wide.readUInt32LE(20), 0xffffffff);
            assert.strictEqual(wide.readUInt32LE(24), 0x80000000);

            const short = x11.packEvent({
                name: 'ClientMessage', format: 16, wid: 1, message_type: 2, data: [-1, 0x1ffff]
            });
            assert.strictEqual(short.readUInt16LE(12), 0xffff);
            assert.strictEqual(short.readUInt16LE(14), 0xffff);
        });

        it('coordinates outside INT16 range wrap the way the wire encodes them', () => {
            const buf = x11.packEvent({
                name: 'ConfigureNotify', wid: 1, wid1: 1, aboveSibling: 0,
                x: 40000, y: -40000, width: 0x1ffff, height: 480,
                borderWidth: 0, overrideRedirect: 0
            });
            assert.strictEqual(buf.readUInt16LE(16), 40000 & 0xffff);
            assert.strictEqual(buf.readUInt16LE(18), -40000 & 0xffff);
            assert.strictEqual(buf.readUInt16LE(20), 0xffff);
        });
    });

    describe('round trip against the parsers', () => {
        // Probe every byte of every event: set exactly one byte, parse, pack.
        // The *parser* decides what should happen — if the byte changed what
        // it reported, the packer must put that byte back exactly where it
        // was; if the parser ignored it (a pad), the packer must leave zero.
        // Letting the packer's own output define which bytes matter would
        // excuse a field it silently dropped.
        const names = Object.keys(eventTypes);

        names.forEach(name => {
            it(`${name} survives parse → pack unchanged, byte by byte`, () => {
                const type = eventTypes[name];
                // an otherwise empty event of this type; for ClientMessage the
                // detail byte is the format, and only 8/16/32 are legal there
                const base = Buffer.alloc(32);
                base[0] = type;
                if (type === eventTypes.ClientMessage)
                    base[1] = 32;
                const baseFields = JSON.stringify(parse(base));

                for (let i = 1; i < 32; i++) {
                    if (i === 1 && base[1])
                        continue;
                    const buf = Buffer.from(base);
                    // wider than a byte and asymmetric, so a field written at
                    // the wrong width or offset cannot come back looking right
                    buf[i] = 0x81;

                    const parsed = parse(buf);
                    const read = JSON.stringify(parsed) !== baseFields;
                    const out = x11.packEvent(parsed);

                    if (!read) {
                        assert.ok(out.equals(base), `${name}: byte ${i} is a pad the parser ` +
                            `ignores, but packing wrote ${out.toString('hex')}`);
                        continue;
                    }
                    // BOOL fields are normalised to 1 on the way out; that is
                    // exact for the 0/1 a server actually sends
                    const asBool = Buffer.from(buf);
                    asBool[i] = 1;
                    assert.ok(out.equals(buf) || out.equals(asBool),
                        `${name}: byte ${i} is a field, but parse → pack turned ` +
                        `${buf.toString('hex')} into ${out.toString('hex')}`);
                }
            });
        });

        it('covers every event the parsers handle', () => {
            assert.deepStrictEqual(Object.keys(packers).sort(), Object.keys(eventTypes)
                .map(n => String(eventTypes[n])).sort());
            assert.strictEqual(names.length, 33);
        });

        // one per shape of the detail byte: keycode, button, the crossing and
        // focus `detail` enum, ConfigureRequest's stack mode, and none at all
        [
            { name: 'KeyPress', keycode: 38, time: 0x0f0f0f0f, root: 0x129, wid: 0x00a00001,
                child: 0, rootx: 100, rooty: 200, x: 10, y: 20, buttons: 0x0011, sameScreen: 1 },
            { name: 'ButtonPress', keycode: 3, time: 9, root: 2, wid: 3, child: 4,
                rootx: 5, rooty: 6, x: 7, y: 8, buttons: 0x100, sameScreen: 0 },
            { name: 'EnterNotify', detail: 2, time: 9, root: 2, wid: 3, child: 4,
                rootx: 5, rooty: 6, x: 7, y: 8, buttons: 0x100, mode: 1, sameScreenFocus: 3 },
            { name: 'FocusIn', detail: 2, wid: 3, mode: 1 },
            { name: 'ConfigureRequest', stackMode: 4, parent: 1, wid: 2, sibling: 3,
                x: 4, y: 5, width: 6, height: 7, borderWidth: 8, mask: 0x7f },
            { name: 'PropertyNotify', wid: 1, atom: 2, time: 3, state: 1 }
        ].forEach(ev => {
            it(`reproduces a parsed ${ev.name} exactly`, () => {
                const back = parse(x11.packEvent(ev));
                for (const key of Object.keys(ev)) {
                    if (key === 'name')
                        continue;
                    assert.strictEqual(back[key], ev[key], `${ev.name}.${key}`);
                }
            });
        });

        it('round-trips KeymapNotify, which has no sequence number', () => {
            const keys = Buffer.alloc(31);
            keys[1] = 0xff;
            keys[30] = 0x81;
            const back = parse(x11.packEvent({ name: 'KeymapNotify', keys }));
            assert.deepStrictEqual(back.keys, keys);
            assert.strictEqual(back.seq, undefined);
        });

        it('treats missing fields as zero', () => {
            const back = parse(x11.packEvent({ name: 'Expose', wid: 7 }));
            assert.strictEqual(back.wid, 7);
            assert.strictEqual(back.width, 0);
            assert.strictEqual(back.count, 0);
        });
    });

    describe('rejects what the server would reject', () => {
        it('an unknown event name', () => {
            assert.throws(() => x11.packEvent({ name: 'NoSuchEvent' }), /unknown event name/);
        });

        it('GenericEvent, which has no 32-byte form', () => {
            assert.throws(() => x11.packEvent({ type: 35 }), /GenericEvent/);
        });

        it('an event with neither a name nor a type', () => {
            assert.throws(() => x11.packEvent({ wid: 1 }), /name or a numeric type/);
            assert.throws(() => x11.packEvent(null), /expected an event object/);
        });

        it('an extension event that borrows a core event name', () => {
            // XFixes has its own SelectionNotify (firstEvent + 0); packing it
            // by name would put a completely different layout on the wire
            assert.throws(() => x11.packEvent({ type: 86, name: 'SelectionNotify', requestor: 1 }),
                /extension events are not packed by name/);
            // ... while a core event carrying both stays fine
            assert.strictEqual(x11.packEvent({ type: 31, name: 'SelectionNotify' })[0], 31);
        });

        it('a target that is not a Buffer', () => {
            assert.throws(() => x11.packEvent({ name: 'Expose' }, 'nope'), /must be a Buffer/);
        });

        it('a ClientMessage format other than 8, 16 or 32', () => {
            assert.throws(() => x11.packEvent({ name: 'ClientMessage', format: 24 }),
                /format must be 8, 16 or 32/);
            assert.throws(() => x11.packEvent({ name: 'ClientMessage' }),
                /format must be 8, 16 or 32/);
        });

        it('more ClientMessage data than the format has room for', () => {
            assert.throws(() => x11.packEvent({
                name: 'ClientMessage', format: 32, data: [1, 2, 3, 4, 5, 6]
            }), /holds 5 values at format 32, got 6/);
            assert.throws(() => x11.packEvent({
                name: 'ClientMessage', format: 8, data: new Array(21).fill(0)
            }), /holds 20 values at format 8, got 21/);
        });

        it('a target buffer that is too short', () => {
            assert.throws(() => x11.packEvent({ name: 'Expose' }, Buffer.alloc(31)),
                /at least 32 bytes/);
        });
    });
});

describe('SendEvent with an event object', function() {

    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.wid = self.X.AllocID();
            self.X.CreateWindow(self.wid, self.root, 0, 0, 1, 1);
            self.X.InternAtom(false, 'X11_TEST_PACK', (err, atom) => {
                assert.ifError(err);
                self.atom = atom;
                done();
            });
        });
        client.on('error', done);
    });

    after(function() {
        if (this.X) {
            this.X.DestroyWindow(this.wid);
            this.X.terminate();
        }
    });

    // An empty event mask delivers to the client that created the destination
    // window — us. That is how ICCCM/XEmbed/XDND messages reach their target,
    // and it lets the test observe every event type without selecting it.
    function expect(X, name, cb) {
        X.once('event', ev => {
            assert.strictEqual(ev.name, name);
            cb(ev);
        });
    }

    it('delivers a ClientMessage built from an object', function(done) {
        const self = this;
        expect(this.X, 'ClientMessage', ev => {
            assert.strictEqual(ev.wid, self.wid);
            assert.strictEqual(ev.message_type, self.atom);
            assert.strictEqual(ev.format, 32);
            assert.deepStrictEqual(ev.data, [1, 2, 3, 0, 0]);
            done();
        });
        this.X.SendEvent(this.wid, 0, 0, {
            name: 'ClientMessage',
            format: 32,
            wid: this.wid,
            message_type: this.atom,
            data: [1, 2, 3]
        });
    });

    it('delivers a SelectionNotify built from an object', function(done) {
        const self = this;
        expect(this.X, 'SelectionNotify', ev => {
            assert.strictEqual(ev.requestor, self.wid);
            assert.strictEqual(ev.selection, self.atom);
            assert.strictEqual(ev.target, self.atom);
            assert.strictEqual(ev.property, 0);
            assert.strictEqual(ev.time, 0x11223344);
            done();
        });
        this.X.SendEvent(this.wid, 0, 0, {
            name: 'SelectionNotify',
            time: 0x11223344,
            requestor: this.wid,
            selection: this.atom,
            target: this.atom,
            property: 0
        });
    });

    it('delivers a synthetic ConfigureNotify to a StructureNotify selection', function(done) {
        const self = this;
        this.X.ChangeWindowAttributes(this.wid, { eventMask: x11.eventMask.StructureNotify });
        expect(this.X, 'ConfigureNotify', ev => {
            assert.strictEqual(ev.wid, self.wid);
            assert.strictEqual(ev.wid1, self.wid);
            assert.strictEqual(ev.x, 100);
            assert.strictEqual(ev.y, -20);
            assert.strictEqual(ev.width, 640);
            assert.strictEqual(ev.height, 480);
            self.X.ChangeWindowAttributes(self.wid, { eventMask: 0 });
            done();
        });
        this.X.SendEvent(this.wid, 0, x11.eventMask.StructureNotify, {
            name: 'ConfigureNotify',
            wid: this.wid,
            wid1: this.wid,
            aboveSibling: 0,
            x: 100, y: -20, width: 640, height: 480,
            borderWidth: 0,
            overrideRedirect: 0
        });
    });

    it('still accepts the raw 32 bytes of a received event', function(done) {
        const self = this;
        this.X.once('event', first => {
            assert.strictEqual(first.name, 'ClientMessage');
            expect(self.X, 'ClientMessage', ev => {
                assert.deepStrictEqual(ev.data, first.data);
                done();
            });
            self.X.SendEvent(self.wid, 0, 0, first.rawData);
        });
        this.X.SendEvent(this.wid, 0, 0, {
            name: 'ClientMessage', format: 8, wid: this.wid,
            message_type: this.atom, data: [9, 8, 7]
        });
    });

    it('rejects a buffer that is not 32 bytes', function() {
        assert.throws(() => this.X.SendEvent(this.wid, 0, 0, Buffer.alloc(40)),
            /must be exactly 32 bytes/);
    });

    it('leaves the connection usable after a rejected event', function(done) {
        // A request that throws while packing never reaches the wire, so the
        // sequence number must not advance — otherwise every later reply is
        // matched to the wrong callback and the connection silently stops
        // answering.
        const self = this;
        const before = this.X.seq_num;
        assert.throws(() => this.X.SendEvent(this.wid, 0, 0, Buffer.alloc(40)));
        assert.throws(() => this.X.SendClientMessage(this.wid, this.wid, this.atom, 12, []));
        assert.throws(() => this.X.SendEvent(this.wid, 0, 0, { name: 'NoSuchEvent' }));
        assert.strictEqual(this.X.seq_num, before, 'sequence number advanced for unsent requests');

        this.X.InternAtom(false, 'X11_TEST_PACK_AFTER_THROW', (err, atom) => {
            assert.ifError(err);
            assert.ok(atom > 0);
            self.X.GetGeometry(self.wid, (err, geom) => {
                assert.ifError(err);
                assert.strictEqual(geom.width, 1);
                done();
            });
        });
    });

    describe('SendClientMessage', () => {
        it('sends with an explicit empty mask, the way WM_PROTOCOLS does', function(done) {
            const self = this;
            expect(this.X, 'ClientMessage', ev => {
                assert.strictEqual(ev.wid, self.wid);
                assert.strictEqual(ev.message_type, self.atom);
                assert.deepStrictEqual(ev.data, [self.atom, 0, 0, 0, 0]);
                done();
            });
            this.X.SendClientMessage(this.wid, this.wid, this.atom, 32, [this.atom], 0);
        });

        it('defaults the mask to SubstructureRedirect|SubstructureNotify', function(done) {
            const self = this;
            // What EWMH root-window messages use; select those bits on our own
            // window so the default is observable.
            this.X.ChangeWindowAttributes(this.wid, {
                eventMask: x11.eventMask.SubstructureNotify | x11.eventMask.SubstructureRedirect
            });
            expect(this.X, 'ClientMessage', ev => {
                assert.strictEqual(ev.format, 32);
                assert.deepStrictEqual(ev.data, [1, 2, 0, 0, 0]);
                self.X.ChangeWindowAttributes(self.wid, { eventMask: 0 });
                done();
            });
            this.X.SendClientMessage(this.wid, this.wid, this.atom, 32, [1, 2]);
        });

        it('takes a trailing callback in place of the mask', function(done) {
            const self = this;
            let pending = 2;
            const finish = () => {
                if (--pending === 0) {
                    self.X.ChangeWindowAttributes(self.wid, { eventMask: 0 });
                    done();
                }
            };
            this.X.ChangeWindowAttributes(this.wid, {
                eventMask: x11.eventMask.SubstructureNotify | x11.eventMask.SubstructureRedirect
            });
            expect(this.X, 'ClientMessage', ev => {
                assert.strictEqual(ev.format, 8);
                assert.strictEqual(ev.data[0], 1);
                finish();
            });
            // no mask argument: the callback is recognised in its place, and
            // the request is still checked (issue #85) rather than silent
            this.X.SendClientMessage(this.wid, this.wid, this.atom, 8, [1], err => {
                assert.ifError(err);
                finish();
            });
        });

        it('reports a bad format instead of letting the server BadValue it', function() {
            assert.throws(() => this.X.SendClientMessage(this.wid, this.wid, this.atom, 12, []),
                /format must be 8, 16 or 32/);
        });
    });
});
