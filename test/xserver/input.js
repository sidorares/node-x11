const assert = require('assert');
const x11 = require('../../lib');
const { boot, sync } = require('./boot');

const em = x11.eventMask;

describe('xserver: input injection', () => {

    let server, display, X, root, wid;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            wid = X.AllocID();
            X.CreateWindow(wid, root, 10, 10, 100, 80, 0, 0, 0, 0, {
                eventMask: em.PointerMotion | em.ButtonPress | em.ButtonRelease |
                    em.KeyPress | em.KeyRelease | em.EnterWindow | em.LeaveWindow |
                    em.FocusChange
            });
            X.MapWindow(wid);
            sync(X, () => done());
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = null;
    });

    function onEvent(name, cb) {
        const listener = ev => {
            if (ev.name === name) {
                X.removeListener('event', listener);
                cb(ev);
            }
        };
        X.on('event', listener);
    }

    it('injectPointerMove delivers MotionNotify with correct coordinates', done => {
        onEvent('MotionNotify', ev => {
            assert.strictEqual(ev.wid, wid);
            assert.strictEqual(ev.root, root);
            assert.strictEqual(ev.child, 0);
            assert.strictEqual(ev.rootx, 30);
            assert.strictEqual(ev.rooty, 40);
            assert.strictEqual(ev.x, 20);       // window-relative
            assert.strictEqual(ev.y, 30);
            assert.strictEqual(ev.buttons, 0);  // state
            assert.strictEqual(ev.sameScreen, 1);
            done();
        });
        server.injectPointerMove(30, 40);
    });

    it('injectButton delivers press/release with button state bits', done => {
        server.injectPointerMove(30, 40);
        onEvent('ButtonPress', press => {
            assert.strictEqual(press.keycode, 1);       // detail = button
            assert.strictEqual(press.wid, wid);
            assert.strictEqual(press.buttons & 0x100, 0); // state is pre-event
            onEvent('ButtonRelease', release => {
                assert.strictEqual(release.keycode, 1);
                assert.strictEqual(release.buttons & 0x100, 0x100); // Button1Mask
                done();
            });
            server.injectButton(1, false);
        });
        server.injectButton(1, true);
    });

    it('injectKey delivers KeyPress to the pointer window (PointerRoot focus)', done => {
        server.injectPointerMove(30, 40);
        const keycode = server.keymap.keycodeForKeysym(x11.keySyms.XK_a.code);
        assert.strictEqual(keycode, 38);
        onEvent('KeyPress', ev => {
            assert.strictEqual(ev.keycode, 38);
            assert.strictEqual(ev.wid, wid);
            onEvent('KeyRelease', ev2 => {
                assert.strictEqual(ev2.keycode, 38);
                done();
            });
            server.injectKey(38, false);
        });
        server.injectKey(38, true);
    });

    it('modifier keys contribute to the event state', done => {
        server.injectPointerMove(30, 40);
        server.injectKey(50, true); // Shift_L
        onEvent('ButtonPress', ev => {
            assert.strictEqual(ev.buttons & 1, 1); // ShiftMask
            server.injectButton(1, false);
            server.injectKey(50, false);
            done();
        });
        server.injectButton(1, true);
    });

    it('Enter/LeaveNotify fire when crossing window boundaries', done => {
        const other = X.AllocID();
        X.CreateWindow(other, root, 200, 10, 50, 50, 0, 0, 0, 0,
            { eventMask: em.EnterWindow | em.LeaveWindow });
        X.MapWindow(other);
        sync(X, () => {
            onEvent('EnterNotify', enter => {
                assert.strictEqual(enter.wid, wid);
                onEvent('LeaveNotify', leave => {
                    assert.strictEqual(leave.wid, wid);
                    onEvent('EnterNotify', enter2 => {
                        assert.strictEqual(enter2.wid, other);
                        assert.strictEqual(enter2.x, 10);
                        assert.strictEqual(enter2.y, 20);
                        done();
                    });
                });
                server.injectPointerMove(210, 30); // into `other`
            });
            server.injectPointerMove(30, 40); // into `wid`
        });
    });

    it('QueryPointer reports position, state and same-screen', done => {
        server.injectPointerMove(55, 66);
        X.QueryPointer(root, (err, res) => {
            if (err) return done(err);
            assert.strictEqual(res.root, root);
            assert.strictEqual(res.rootX, 55);
            assert.strictEqual(res.rootY, 66);
            assert.strictEqual(res.child, wid);
            assert.strictEqual(res.sameScreen, 1);
            X.QueryPointer(wid, (err2, res2) => {
                if (err2) return done(err2);
                assert.strictEqual(res2.childX, 45); // window-relative
                assert.strictEqual(res2.childY, 56);
                done();
            });
        });
    });

    it('WarpPointer moves the pointer and generates motion', done => {
        onEvent('MotionNotify', ev => {
            assert.strictEqual(ev.rootx, 15);
            assert.strictEqual(ev.rooty, 17);
            done();
        });
        X.WarpPointer(0, wid, 0, 0, 0, 0, 5, 7); // wid abs (10,10) + (5,7)
    });

    it('TranslateCoordinates maps between window spaces', done => {
        X.TranslateCoordinates(root, wid, 30, 40, (err, res) => {
            if (err) return done(err);
            assert.strictEqual(res.destX, 20);
            assert.strictEqual(res.destY, 30);
            assert.strictEqual(res.sameScreen, 1);
            X.TranslateCoordinates(root, root, 15, 15, (err2, res2) => {
                if (err2) return done(err2);
                assert.strictEqual(res2.child, wid); // child containing point
                done();
            });
        });
    });

    it('SetInputFocus sends FocusIn and routes key events to the focus window', done => {
        // pointer over root, but focus forced to wid
        server.injectPointerMove(500, 500);
        onEvent('FocusIn', fev => {
            assert.strictEqual(fev.wid, wid);
            X.GetInputFocus((err, focus) => {
                if (err) return done(err);
                assert.strictEqual(focus.focus, wid);
                assert.strictEqual(focus.revertTo, 2);
                onEvent('KeyPress', kev => {
                    assert.strictEqual(kev.wid, wid);
                    assert.strictEqual(kev.keycode, 38);
                    server.injectKey(38, false);
                    done();
                });
                server.injectKey(38, true);
            });
        });
        X.SetInputFocus(wid, 2);
    });

    it('GetMotionEvents returns an empty list', done => {
        X.GetMotionEvents(root, 0, 0, (err, events) => {
            if (err) return done(err);
            assert.deepStrictEqual(events, []);
            done();
        });
    });

    it('QueryKeymap reflects injected key state', done => {
        server.injectKey(38, true);
        X.QueryKeymap((err, keys) => {
            if (err) return done(err);
            assert.strictEqual(keys.length, 32);
            assert.strictEqual((keys[38 >> 3] >> (38 & 7)) & 1, 1);
            server.injectKey(38, false);
            X.QueryKeymap((err2, keys2) => {
                if (err2) return done(err2);
                assert.strictEqual((keys2[38 >> 3] >> (38 & 7)) & 1, 0);
                done();
            });
        });
    });
});
