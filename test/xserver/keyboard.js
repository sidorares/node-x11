const assert = require('assert');
const x11 = require('../../lib');
const { boot } = require('./boot');

const XK = x11.keySyms;

describe('xserver: keyboard and pointer state', () => {

    let server, display, X;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            done();
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = null;
    });

    it('GetKeyboardMapping matches the server keymap module', done => {
        X.GetKeyboardMapping(38, 3, (err, rows) => {
            if (err) return done(err);
            assert.strictEqual(rows.length, 3);
            assert.deepStrictEqual(rows[0], [XK.XK_a.code, XK.XK_A.code]);
            assert.deepStrictEqual(rows[1], [XK.XK_s.code, XK.XK_S.code]);
            assert.deepStrictEqual(rows[2], [XK.XK_d.code, XK.XK_D.code]);
            assert.deepStrictEqual(rows[0], server.keymap.syms[38]);
            done();
        });
    });

    it('GetKeyboardMapping honours first/count over the whole range', done => {
        X.GetKeyboardMapping(8, 248, (err, rows) => {
            if (err) return done(err);
            assert.strictEqual(rows.length, 248);
            assert.deepStrictEqual(rows[65 - 8], [XK.XK_space.code, XK.XK_space.code]);
            assert.deepStrictEqual(rows[9 - 8], [XK.XK_Escape.code, XK.XK_Escape.code]);
            done();
        });
    });

    it('keycodeForKeysym reverse lookup prefers the unshifted column', () => {
        assert.strictEqual(server.keymap.keycodeForKeysym(XK.XK_a.code), 38);
        assert.strictEqual(server.keymap.keycodeForKeysym(XK.XK_A.code), 38);
        assert.strictEqual(server.keymap.keycodeForKeysym(XK.XK_space.code), 65);
        assert.strictEqual(server.keymap.keycodeForKeysym(XK.XK_Return.code), 36);
        assert.strictEqual(server.keymap.keycodeForKeysym(0xffffff), 0);
    });

    it('ChangeKeyboardMapping stores syms and sends MappingNotify', done => {
        X.on('event', ev => {
            if (ev.name !== 'MappingNotify')
                return;
            assert.strictEqual(ev.request, 1); // Keyboard
            assert.strictEqual(ev.firstKeyCode, 200);
            assert.strictEqual(ev.count, 1);
            X.GetKeyboardMapping(200, 1, (err, rows) => {
                if (err) return done(err);
                assert.deepStrictEqual(rows[0], [XK.XK_F1.code, XK.XK_F2.code]);
                done();
            });
        });
        X.ChangeKeyboardMapping(200, 2, [XK.XK_F1.code, XK.XK_F2.code]);
    });

    it('GetModifierMapping serves the default modifier rows', done => {
        X.GetModifierMapping((err, rows) => {
            if (err) return done(err);
            assert.strictEqual(rows.length, 8);
            assert.deepStrictEqual(rows[0], [50, 62]);  // Shift
            assert.deepStrictEqual(rows[1], [66, 0]);   // Lock
            assert.deepStrictEqual(rows[2], [37, 105]); // Control
            assert.deepStrictEqual(rows[3], [64, 108]); // Mod1
            done();
        });
    });

    it('SetModifierMapping round-trips', done => {
        X.SetModifierMapping([[50], [66], [37], [64], [0], [0], [0], [0]], (err, status) => {
            if (err) return done(err);
            assert.strictEqual(status, 0); // Success
            X.GetModifierMapping((err2, rows) => {
                if (err2) return done(err2);
                assert.deepStrictEqual(rows[0], [50]);
                assert.deepStrictEqual(rows[2], [37]);
                done();
            });
        });
    });

    it('Bell emits a server-side bell event', done => {
        server.once('bell', percent => {
            assert.strictEqual(percent, 42);
            done();
        });
        X.Bell(42);
    });

    it('Change/GetKeyboardControl round-trips', done => {
        X.GetKeyboardControl((err, kc) => {
            if (err) return done(err);
            assert.strictEqual(kc.bellPitch, 400);
            assert.strictEqual(kc.globalAutoRepeat, 1);
            assert.strictEqual(kc.autoRepeats.length, 32);
            X.ChangeKeyboardControl({ bellPitch: 220, bellDuration: 80, bellPercent: 90 });
            X.GetKeyboardControl((err2, kc2) => {
                if (err2) return done(err2);
                assert.strictEqual(kc2.bellPitch, 220);
                assert.strictEqual(kc2.bellDuration, 80);
                assert.strictEqual(kc2.bellPercent, 90);
                done();
            });
        });
    });

    it('Get/ChangePointerControl round-trips', done => {
        X.GetPointerControl((err, pc) => {
            if (err) return done(err);
            assert.strictEqual(pc.accelNumerator, 2);
            assert.strictEqual(pc.accelDenominator, 1);
            assert.strictEqual(pc.threshold, 4);
            X.ChangePointerControl(7, 3, 11, true, true);
            X.GetPointerControl((err2, pc2) => {
                if (err2) return done(err2);
                assert.strictEqual(pc2.accelNumerator, 7);
                assert.strictEqual(pc2.accelDenominator, 3);
                assert.strictEqual(pc2.threshold, 11);
                done();
            });
        });
    });

    it('Get/SetPointerMapping round-trips', done => {
        X.GetPointerMapping((err, map) => {
            if (err) return done(err);
            assert.deepStrictEqual(map, [1, 2, 3, 4, 5]);
            X.SetPointerMapping([3, 2, 1, 4, 5], (err2, status) => {
                if (err2) return done(err2);
                assert.strictEqual(status, 0);
                X.GetPointerMapping((err3, map2) => {
                    if (err3) return done(err3);
                    assert.deepStrictEqual(map2, [3, 2, 1, 4, 5]);
                    done();
                });
            });
        });
    });
});
