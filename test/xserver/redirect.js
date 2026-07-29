const assert = require('assert');
const x11 = require('../../lib');
const { createServer } = require('../../lib/xserver');
const { boot, sync } = require('./boot');

const em = x11.eventMask;

// SubstructureRedirect: the window manager's half of the protocol. A client
// holding it on a parent gets MapRequest/ConfigureRequest/CirculateRequest
// instead of the request taking effect, and decides what really happens.
describe('xserver: substructure redirect', () => {

    let server, WM, C, root;

    // WM is the redirecting client, C an ordinary application client.
    beforeEach(done => {
        server = createServer();
        boot({ server }, (err, wmCtx) => {
            if (err) return done(err);
            WM = wmCtx.X;
            root = wmCtx.display.screen[0].root;
            boot({ server }, (err2, cCtx) => {
                if (err2) return done(err2);
                C = cCtx.X;
                done();
            });
        });
    });

    afterEach(() => {
        if (WM) WM.terminate();
        if (C) C.terminate();
        server = WM = C = null;
    });

    function onEvent(client, name, cb) {
        const listener = ev => {
            if (ev.name === name) {
                client.removeListener('event', listener);
                cb(ev);
            }
        };
        client.on('event', listener);
    }

    const claimRoot = cb => {
        WM.ChangeWindowAttributes(root, { eventMask: em.SubstructureRedirect });
        sync(WM, cb);
    };

    it('MapWindow becomes a MapRequest and the window stays unmapped', done => {
        claimRoot(() => {
            const wid = C.AllocID();
            C.CreateWindow(wid, root, 0, 0, 40, 30);
            onEvent(WM, 'MapRequest', ev => {
                assert.strictEqual(ev.parent, root);
                assert.strictEqual(ev.wid, wid);
                WM.GetWindowAttributes(wid, (err, attrs) => {
                    assert.ifError(err);
                    assert.strictEqual(attrs.mapState, 0, 'still unmapped');
                    done();
                });
            });
            C.MapWindow(wid);
        });
    });

    it('the window manager mapping it itself is not redirected', done => {
        claimRoot(() => {
            const wid = C.AllocID();
            C.CreateWindow(wid, root, 0, 0, 40, 30);
            sync(C, () => {
                WM.on('event', ev => {
                    assert.notStrictEqual(ev.name, 'MapRequest', 'no self-redirect');
                });
                WM.MapWindow(wid);
                sync(WM, () => {
                    WM.GetWindowAttributes(wid, (err, attrs) => {
                        assert.ifError(err);
                        assert.strictEqual(attrs.mapState, 2, 'viewable');
                        done();
                    });
                });
            });
        });
    });

    it('an override-redirect window maps straight through', done => {
        claimRoot(() => {
            const wid = C.AllocID();
            C.CreateWindow(wid, root, 0, 0, 40, 30, 0, 0, 0, 0, { overrideRedirect: 1 });
            WM.on('event', ev => {
                assert.notStrictEqual(ev.name, 'MapRequest', 'not redirected');
            });
            C.MapWindow(wid);
            sync(C, () => {
                C.GetWindowAttributes(wid, (err, attrs) => {
                    assert.ifError(err);
                    assert.strictEqual(attrs.mapState, 2, 'viewable');
                    done();
                });
            });
        });
    });

    it('re-mapping an already mapped window is not redirected', done => {
        const wid = C.AllocID();
        C.CreateWindow(wid, root, 0, 0, 40, 30);
        C.MapWindow(wid);
        sync(C, () => claimRoot(() => {
            WM.on('event', ev => {
                assert.notStrictEqual(ev.name, 'MapRequest', 'no state change');
            });
            C.MapWindow(wid);
            sync(C, () => sync(WM, done));
        }));
    });

    it('ConfigureWindow becomes a ConfigureRequest carrying the value mask', done => {
        claimRoot(() => {
            const wid = C.AllocID();
            C.CreateWindow(wid, root, 5, 6, 40, 30);
            onEvent(WM, 'ConfigureRequest', ev => {
                assert.strictEqual(ev.parent, root);
                assert.strictEqual(ev.wid, wid);
                assert.strictEqual(ev.width, 200);
                assert.strictEqual(ev.height, 300);
                // y was not in the request: the field carries the window's
                // current value and the mask says to ignore it
                assert.strictEqual(ev.y, 6);
                assert.strictEqual(ev.mask, 0x0004 | 0x0008, 'width|height only');
                C.GetGeometry(wid, (err, geom) => {
                    assert.ifError(err);
                    assert.strictEqual(geom.width, 40, 'unchanged');
                    assert.strictEqual(geom.height, 30, 'unchanged');
                    done();
                });
            });
            C.ConfigureWindow(wid, { width: 200, height: 300 });
        });
    });

    it('a redirected ConfigureWindow sends no ConfigureNotify', done => {
        claimRoot(() => {
            const wid = C.AllocID();
            C.CreateWindow(wid, root, 0, 0, 40, 30, 0, 0, 0, 0,
                { eventMask: em.StructureNotify });
            C.on('event', ev => {
                assert.notStrictEqual(ev.name, 'ConfigureNotify', 'nothing happened');
            });
            C.ConfigureWindow(wid, { width: 60 });
            sync(C, () => sync(WM, done));
        });
    });

    it('CirculateWindow becomes a CirculateRequest', done => {
        const a = C.AllocID(), b = C.AllocID();
        C.CreateWindow(a, root, 0, 0, 40, 30);
        C.CreateWindow(b, root, 0, 0, 40, 30);
        sync(C, () => claimRoot(() => {
            onEvent(WM, 'CirculateRequest', ev => {
                assert.strictEqual(ev.wid, a, 'the lowest child');
                assert.strictEqual(ev.place, 0, 'Top');
                C.QueryTree(root, (err, tree) => {
                    assert.ifError(err);
                    assert.deepStrictEqual(tree.children, [a, b], 'unchanged');
                    done();
                });
            });
            C.CirculateWindow(root, 0 /* RaiseLowest */);
        }));
    });

    it('only one client at a time may redirect a window', done => {
        claimRoot(() => {
            C.ChangeWindowAttributes(root, { eventMask: em.SubstructureRedirect });
            C.once('error', err => {
                assert.strictEqual(err.error, 10, 'BadAccess');
                done();
            });
            sync(C, () => {});
        });
    });

    it('the same client may re-select its own redirect', done => {
        claimRoot(() => {
            WM.on('error', err => done(err));
            WM.ChangeWindowAttributes(root, {
                eventMask: em.SubstructureRedirect | em.SubstructureNotify
            });
            sync(WM, done);
        });
    });

    it('the redirect is released when the window manager disconnects', done => {
        claimRoot(() => {
            WM.terminate();
            WM = null;
            // the server drops the client's masks with it, so the role is free
            setTimeout(() => {
                boot({ server }, (err, ctx) => {
                    assert.ifError(err);
                    const WM2 = ctx.X;
                    WM2.on('error', err2 => done(err2));
                    WM2.ChangeWindowAttributes(root, { eventMask: em.SubstructureRedirect });
                    sync(WM2, () => {
                        WM2.terminate();
                        done();
                    });
                });
            }, 10);
        });
    });
});
