const assert = require('assert');
const x11 = require('../../lib');
const { createServer } = require('../../lib/xserver');
const { boot, sync } = require('./boot');

const em = x11.eventMask;

describe('xserver: grabs', () => {

    let server, A, B, root, winA, winB;

    beforeEach(done => {
        server = createServer();
        boot({ server }, (err, ctxA) => {
            if (err) return done(err);
            A = ctxA.X;
            root = ctxA.display.screen[0].root;
            boot({ server }, (err2, ctxB) => {
                if (err2) return done(err2);
                B = ctxB.X;
                winA = A.AllocID();
                A.CreateWindow(winA, root, 0, 0, 50, 50, 0, 0, 0, 0,
                    { eventMask: em.ButtonPress | em.ButtonRelease });
                A.MapWindow(winA);
                winB = B.AllocID();
                B.CreateWindow(winB, root, 100, 0, 50, 50, 0, 0, 0, 0,
                    { eventMask: em.PointerMotion | em.ButtonPress | em.KeyPress });
                B.MapWindow(winB);
                sync(A, () => sync(B, () => done()));
            });
        });
    });

    afterEach(() => {
        A.terminate();
        B.terminate();
        server = A = B = null;
    });

    it('GrabPointer succeeds; a second client gets AlreadyGrabbed', done => {
        A.GrabPointer(winA, 0, em.PointerMotion, 1, 1, 0, 0, 0, (err, status) => {
            if (err) return done(err);
            assert.strictEqual(status, 0); // Success
            B.GrabPointer(winB, 0, em.PointerMotion, 1, 1, 0, 0, 0, (err2, status2) => {
                if (err2) return done(err2);
                assert.strictEqual(status2, 1); // AlreadyGrabbed
                done();
            });
        });
    });

    it('active pointer grab redirects events to the grab window/client', done => {
        A.GrabPointer(winA, 0, em.PointerMotion, 1, 1, 0, 0, 0, (err, status) => {
            if (err) return done(err);
            assert.strictEqual(status, 0);
            let bGotMotion = false;
            B.on('event', ev => {
                if (ev.name === 'MotionNotify')
                    bGotMotion = true;
            });
            A.on('event', ev => {
                if (ev.name !== 'MotionNotify')
                    return;
                // pointer is over winB, but the grab reports relative to winA
                assert.strictEqual(ev.wid, winA);
                assert.strictEqual(ev.rootx, 110);
                assert.strictEqual(ev.x, 110);
                setTimeout(() => {
                    assert.strictEqual(bGotMotion, false, 'grabbed events must not leak');
                    done();
                }, 20);
            });
            server.injectPointerMove(110, 10); // over winB
        });
    });

    it('UngrabPointer restores normal delivery', done => {
        A.GrabPointer(winA, 0, em.PointerMotion, 1, 1, 0, 0, 0, (err, status) => {
            if (err) return done(err);
            assert.strictEqual(status, 0);
            A.UngrabPointer(0);
            sync(A, () => {
                B.on('event', ev => {
                    if (ev.name !== 'MotionNotify')
                        return;
                    assert.strictEqual(ev.wid, winB);
                    done();
                });
                server.injectPointerMove(120, 20);
            });
        });
    });

    it('GrabButton triggers an implicit active grab on a matching press', done => {
        // B grabs button 1 (any modifier) on winA - presses over winA go to B
        B.GrabButton(winA, 0, em.ButtonPress | em.ButtonRelease, 1, 1, 0, 0, 1, 0x8000);
        sync(B, () => {
            server.injectPointerMove(25, 25); // over winA
            B.on('event', ev => {
                if (ev.name === 'ButtonPress') {
                    assert.strictEqual(ev.wid, winA);
                    assert.strictEqual(ev.keycode, 1);
                    server.injectButton(1, false);
                } else if (ev.name === 'ButtonRelease') {
                    assert.strictEqual(ev.wid, winA);
                    // grab released: A gets plain presses again
                    let aGotPress = false;
                    A.on('event', ev2 => {
                        if (ev2.name === 'ButtonPress')
                            aGotPress = true;
                    });
                    sync(A, () => {
                        server.injectButton(2, true);
                        server.injectButton(2, false);
                        setTimeout(() => {
                            assert.ok(aGotPress, 'passive grab should be released');
                            done();
                        }, 20);
                    });
                }
            });
            server.injectButton(1, true);
        });
    });

    it('implicit grab keeps ButtonRelease with the pressing window', done => {
        server.injectPointerMove(25, 25); // over winA
        A.on('event', ev => {
            if (ev.name === 'ButtonPress') {
                // move away while the button is held
                server.injectPointerMove(120, 20); // over winB
                server.injectButton(1, false);
            } else if (ev.name === 'ButtonRelease') {
                assert.strictEqual(ev.wid, winA, 'release goes to the grab window');
                done();
            }
        });
        server.injectButton(1, true);
    });

    it('GrabKeyboard routes key events to the grabbing client', done => {
        server.injectPointerMove(110, 10); // over winB (B selects KeyPress)
        A.GrabKeyboard(winA, 0, 0, 1, 1, (err, status) => {
            if (err) return done(err);
            assert.strictEqual(status, 0);
            let bGotKey = false;
            B.on('event', ev => {
                if (ev.name === 'KeyPress')
                    bGotKey = true;
            });
            A.on('event', ev => {
                if (ev.name !== 'KeyPress')
                    return;
                assert.strictEqual(ev.wid, winA);
                assert.strictEqual(ev.keycode, 38);
                server.injectKey(38, false);
                A.UngrabKeyboard(0);
                setTimeout(() => {
                    assert.strictEqual(bGotKey, false);
                    done();
                }, 20);
            });
            server.injectKey(38, true);
        });
    });

    it('GrabKey activates a keyboard grab for the matching key only', done => {
        // A passively grabs key 38 on the root (ancestor of every window)
        A.GrabKey(root, 0, 0x8000, 38, 1, 1);
        sync(A, () => {
            server.injectPointerMove(110, 10); // over winB (which selects KeyPress)
            let aGot = null;
            A.on('event', ev => {
                if (ev.name === 'KeyPress')
                    aGot = ev;
            });
            const bGot = [];
            B.on('event', ev => {
                if (ev.name === 'KeyPress')
                    bGot.push(ev);
            });
            server.injectKey(38, true);   // grabbed by A, reported on root
            server.injectKey(38, false);
            server.injectKey(40, true);   // not grabbed -> B (pointer window)
            server.injectKey(40, false);
            setTimeout(() => {
                assert.ok(aGot, 'A received the grabbed key');
                assert.strictEqual(aGot.keycode, 38);
                assert.strictEqual(aGot.wid, root);
                assert.strictEqual(bGot.length, 1, 'B sees only the ungrabbed key');
                assert.strictEqual(bGot[0].keycode, 40);
                assert.strictEqual(bGot[0].wid, winB);
                done();
            }, 20);
        });
    });

    it('ChangeActivePointerGrab updates the grab event mask', done => {
        A.GrabPointer(winA, 0, 0, 1, 1, 0, 0, 0, (err, status) => {
            if (err) return done(err);
            assert.strictEqual(status, 0);
            let got = 0;
            A.on('event', ev => {
                if (ev.name === 'MotionNotify')
                    got++;
            });
            server.injectPointerMove(5, 5); // mask 0: nothing reported
            A.ChangeActivePointerGrab(0, 0, em.PointerMotion);
            sync(A, () => {
                server.injectPointerMove(6, 6);
                setTimeout(() => {
                    assert.strictEqual(got, 1);
                    done();
                }, 20);
            });
        });
    });
});
