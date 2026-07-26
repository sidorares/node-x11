const assert = require('assert');
const x11 = require('../../lib');
const { boot } = require('./boot');

const em = x11.eventMask;

describe('xserver: atoms and properties', () => {

    let server, display, X, root, wid;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0,
                { eventMask: em.PropertyChange });
            done();
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = null;
    });

    it('InternAtom/GetAtomName round-trip for a fresh atom', done => {
        const name = 'XSRV_PROP_SUITE_ATOM_A';
        X.InternAtom(false, name, (err, atom) => {
            if (err) return done(err);
            assert.ok(atom >= 69, `fresh atom id ${atom} above the predefined range`);
            // ask the server directly (bypass the client-side cache)
            assert.strictEqual(server.atomsById.get(atom), name);
            X.InternAtom(true, 'XSRV_PROP_SUITE_NEVER_INTERNED_1', (err2, missing) => {
                if (err2) return done(err2);
                assert.strictEqual(missing, 0); // onlyIfExists on unknown name
                done();
            });
        });
    });

    it('predefined atoms 1-68 are preloaded server-side', () => {
        assert.strictEqual(server.atomsById.get(1), 'PRIMARY');
        assert.strictEqual(server.atomsById.get(31), 'STRING');
        assert.strictEqual(server.atomsById.get(68), 'WM_TRANSIENT_FOR');
        assert.strictEqual(server.atomsByName.get('WM_NAME'), 39);
    });

    it('ChangeProperty replace + GetProperty round-trips (format 8)', done => {
        const value = 'hello property';
        X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, value);
        X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 100, (err, prop) => {
            if (err) return done(err);
            assert.strictEqual(prop.type, X.atoms.STRING);
            assert.strictEqual(prop.bytesAfter, 0);
            assert.strictEqual(prop.data.toString(), value);
            done();
        });
    });

    it('append and prepend modes honour existing data', done => {
        X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'mid');
        X.ChangeProperty(2, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, '-end');   // append
        X.ChangeProperty(1, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'start-'); // prepend
        X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 100, (err, prop) => {
            if (err) return done(err);
            assert.strictEqual(prop.data.toString(), 'start-mid-end');
            done();
        });
    });

    it('round-trips format 32 data', done => {
        const values = [0x12345678, 0xdeadbeef, 7];
        const data = Buffer.alloc(12);
        values.forEach((v, i) => data.writeUInt32LE(v >>> 0, i * 4));
        X.ChangeProperty(0, wid, X.atoms.WM_HINTS, X.atoms.CARDINAL, 32, data);
        X.GetProperty(0, wid, X.atoms.WM_HINTS, X.atoms.CARDINAL, 0, 100, (err, prop) => {
            if (err) return done(err);
            assert.strictEqual(prop.data.length, 12);
            values.forEach((v, i) =>
                assert.strictEqual(prop.data.readUInt32LE(i * 4), v >>> 0));
            done();
        });
    });

    it('partial GetProperty honours longOffset/longLength and bytesAfter', done => {
        X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'ABCDEFGHIJ');
        X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 1, 1, (err, prop) => {
            if (err) return done(err);
            assert.strictEqual(prop.data.toString(), 'EFGH');
            assert.strictEqual(prop.bytesAfter, 2);
            done();
        });
    });

    it('GetProperty with a type mismatch returns type+bytesAfter, no data', done => {
        X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'abc');
        X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.ATOM, 0, 100, (err, prop) => {
            if (err) return done(err);
            assert.strictEqual(prop.type, X.atoms.STRING);
            assert.strictEqual(prop.bytesAfter, 3);
            assert.strictEqual(prop.data.length, 0);
            done();
        });
    });

    it('GetProperty with delete flag removes and notifies', done => {
        X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'gone');
        X.GetProperty(1, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 100, (err, prop) => {
            if (err) return done(err);
            assert.strictEqual(prop.data.toString(), 'gone');
        });
        X.on('event', ev => {
            if (ev.name === 'PropertyNotify' && ev.state === 1) { // Deleted
                assert.strictEqual(ev.atom, X.atoms.WM_NAME);
                X.GetProperty(0, wid, X.atoms.WM_NAME, 0, 0, 100, (err, prop) => {
                    if (err) return done(err);
                    assert.strictEqual(prop.type, 0);
                    assert.strictEqual(prop.data.length, 0);
                    done();
                });
            }
        });
    });

    it('PropertyNotify (NewValue) fires on ChangeProperty', done => {
        X.on('event', ev => {
            if (ev.name !== 'PropertyNotify')
                return;
            assert.strictEqual(ev.wid, wid);
            assert.strictEqual(ev.atom, X.atoms.WM_ICON_NAME);
            assert.strictEqual(ev.state, 0);
            assert.ok(ev.time > 0);
            done();
        });
        X.ChangeProperty(0, wid, X.atoms.WM_ICON_NAME, X.atoms.STRING, 8, 'x');
    });

    it('ListProperties returns the set atoms, DeleteProperty removes them', done => {
        X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'a');
        X.ChangeProperty(0, wid, X.atoms.WM_CLASS, X.atoms.STRING, 8, 'b');
        X.ListProperties(wid, (err, atoms) => {
            if (err) return done(err);
            assert.deepStrictEqual(atoms.sort((p, q) => p - q),
                [X.atoms.WM_NAME, X.atoms.WM_CLASS].sort((p, q) => p - q));
            X.DeleteProperty(wid, X.atoms.WM_NAME);
            X.ListProperties(wid, (err2, atoms2) => {
                if (err2) return done(err2);
                assert.deepStrictEqual(atoms2, [X.atoms.WM_CLASS]);
                done();
            });
        });
    });

    it('RotateProperties rotates values between properties', done => {
        X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'one');
        X.ChangeProperty(0, wid, X.atoms.WM_ICON_NAME, X.atoms.STRING, 8, 'two');
        X.RotateProperties(wid, 1, [X.atoms.WM_NAME, X.atoms.WM_ICON_NAME]);
        X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 100, (err, p1) => {
            if (err) return done(err);
            assert.strictEqual(p1.data.toString(), 'two');
            X.GetProperty(0, wid, X.atoms.WM_ICON_NAME, X.atoms.STRING, 0, 100, (err2, p2) => {
                if (err2) return done(err2);
                assert.strictEqual(p2.data.toString(), 'one');
                done();
            });
        });
    });
});
