const assert = require('assert');
const x11 = require('../../lib');
const { boot, sync } = require('./boot');

const em = x11.eventMask;

describe('xserver: windows', () => {

    let server, display, X, root;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            done();
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

    it('MapWindow generates MapNotify then Expose for the full window', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 10, 20, 50, 40, 0, 0, 0, 0,
            { eventMask: em.StructureNotify | em.Exposure });
        const seen = [];
        X.on('event', ev => {
            seen.push(ev.name);
            if (ev.name === 'MapNotify') {
                assert.strictEqual(ev.wid, wid);
                assert.strictEqual(ev.event, wid);
            }
            if (ev.name === 'Expose') {
                assert.deepStrictEqual(seen, ['MapNotify', 'Expose']);
                assert.strictEqual(ev.wid, wid);
                assert.strictEqual(ev.x, 0);
                assert.strictEqual(ev.y, 0);
                assert.strictEqual(ev.width, 50);
                assert.strictEqual(ev.height, 40);
                assert.strictEqual(ev.count, 0);
                done();
            }
        });
        X.MapWindow(wid);
    });

    it('CreateNotify goes to SubstructureNotify selectors on the parent', done => {
        const parent = X.AllocID();
        X.CreateWindow(parent, root, 0, 0, 100, 100, 0, 0, 0, 0,
            { eventMask: em.SubstructureNotify });
        const child = X.AllocID();
        onEvent('CreateNotify', ev => {
            assert.strictEqual(ev.parent, parent);
            assert.strictEqual(ev.wid, child);
            assert.strictEqual(ev.x, 5);
            assert.strictEqual(ev.y, 6);
            assert.strictEqual(ev.width, 30);
            assert.strictEqual(ev.height, 20);
            assert.strictEqual(ev.borderWidth, 2);
            done();
        });
        X.CreateWindow(child, parent, 5, 6, 30, 20, 2, 0, 0, 0);
    });

    it('GetWindowAttributes reports map state and event masks', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0,
            { eventMask: em.Exposure | em.KeyPress });
        X.GetWindowAttributes(wid, (err, attrs) => {
            if (err) return done(err);
            assert.strictEqual(attrs.mapState, 0);      // Unmapped
            assert.strictEqual(attrs.klass, 1);         // InputOutput
            assert.strictEqual(attrs.visual, display.screen[0].root_visual);
            assert.strictEqual(attrs.myEventMasks, em.Exposure | em.KeyPress);
            X.MapWindow(wid);
            X.GetWindowAttributes(wid, (err2, attrs2) => {
                if (err2) return done(err2);
                assert.strictEqual(attrs2.mapState, 2); // Viewable
                done();
            });
        });
    });

    it('ConfigureWindow moves/resizes, notifies and exposes grown areas', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 50, 40, 0, 0, 0, 0,
            { eventMask: em.StructureNotify | em.Exposure });
        X.MapWindow(wid);
        sync(X, () => {
            let sawConfigure = false;
            X.on('event', ev => {
                if (ev.name === 'ConfigureNotify') {
                    sawConfigure = true;
                    assert.strictEqual(ev.wid, wid);
                    assert.strictEqual(ev.x, 7);
                    assert.strictEqual(ev.y, 8);
                    assert.strictEqual(ev.width, 70);
                    assert.strictEqual(ev.height, 40);
                } else if (ev.name === 'Expose') {
                    // the newly exposed right-hand strip
                    assert.ok(sawConfigure, 'ConfigureNotify should precede Expose');
                    assert.strictEqual(ev.wid, wid);
                    assert.strictEqual(ev.x, 50);
                    assert.strictEqual(ev.y, 0);
                    assert.strictEqual(ev.width, 20);
                    assert.strictEqual(ev.height, 40);
                    done();
                }
            });
            X.ConfigureWindow(wid, { x: 7, y: 8, width: 70, height: 40 });
        });
    });

    it('resize preserves top-left content and paints background on new area', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 20, 20, 0, 0, 0, 0, { backgroundPixel: 0x00ff00 });
        const gc = X.AllocID();
        X.CreateGC(gc, wid, { foreground: 0xff0000 });
        X.PolyFillRectangle(wid, gc, [0, 0, 20, 20]); // all red
        X.ResizeWindow(wid, 30, 20);
        X.GetImage(2, wid, 0, 0, 30, 20, 0xffffffff, (err, img) => {
            if (err) return done(err);
            assert.strictEqual(img.data.readUInt32LE(0), 0xff0000);           // preserved
            assert.strictEqual(img.data.readUInt32LE((19 * 30 + 19) * 4), 0xff0000);
            assert.strictEqual(img.data.readUInt32LE(25 * 4), 0x00ff00);      // new strip
            done();
        });
    });

    it('QueryTree lists children bottom-to-top and follows restacking', done => {
        const a = X.AllocID();
        const b = X.AllocID();
        X.CreateWindow(a, root, 0, 0, 10, 10);
        X.CreateWindow(b, root, 0, 0, 10, 10);
        X.QueryTree(root, (err, tree) => {
            if (err) return done(err);
            assert.strictEqual(tree.root, root);
            assert.strictEqual(tree.parent, 0);
            assert.deepStrictEqual(tree.children, [a, b]);
            X.RaiseWindow(a);
            X.QueryTree(root, (err2, tree2) => {
                if (err2) return done(err2);
                assert.deepStrictEqual(tree2.children, [b, a]);
                X.LowerWindow(a);
                X.QueryTree(root, (err3, tree3) => {
                    if (err3) return done(err3);
                    assert.deepStrictEqual(tree3.children, [a, b]);
                    done();
                });
            });
        });
    });

    it('ConfigureWindow with sibling/stackMode stacks next to the sibling', done => {
        const a = X.AllocID(), b = X.AllocID(), c = X.AllocID();
        X.CreateWindow(a, root, 0, 0, 10, 10);
        X.CreateWindow(b, root, 0, 0, 10, 10);
        X.CreateWindow(c, root, 0, 0, 10, 10);
        // move a directly above b: [b, a, c]
        X.ConfigureWindow(a, { sibling: b, stackMode: 0 });
        X.QueryTree(root, (err, tree) => {
            if (err) return done(err);
            assert.deepStrictEqual(tree.children, [b, a, c]);
            done();
        });
    });

    it('ReparentWindow emits ReparentNotify with the new position', done => {
        const parent = X.AllocID();
        const child = X.AllocID();
        X.CreateWindow(parent, root, 0, 0, 100, 100);
        X.CreateWindow(child, root, 0, 0, 20, 20, 0, 0, 0, 0,
            { eventMask: em.StructureNotify });
        onEvent('ReparentNotify', ev => {
            assert.strictEqual(ev.wid, child);
            assert.strictEqual(ev.parent, parent);
            assert.strictEqual(ev.x, 5);
            assert.strictEqual(ev.y, 6);
            X.QueryTree(parent, (err, tree) => {
                if (err) return done(err);
                assert.deepStrictEqual(tree.children, [child]);
                done();
            });
        });
        X.ReparentWindow(child, parent, 5, 6);
    });

    it('UnmapWindow and DestroyWindow notify structure selectors', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0,
            { eventMask: em.StructureNotify });
        X.MapWindow(wid);
        onEvent('UnmapNotify', ev => {
            assert.strictEqual(ev.wid, wid);
            assert.strictEqual(ev.event, wid);
            assert.strictEqual(ev.fromConfigure, false);
            onEvent('DestroyNotify', ev2 => {
                assert.strictEqual(ev2.wid, wid);
                X.GetWindowAttributes(wid, err => {
                    assert.ok(err);
                    assert.strictEqual(err.error, 3); // BadWindow
                    done();
                    return true;
                });
            });
            X.DestroyWindow(wid);
        });
        X.UnmapWindow(wid);
    });

    it('DestroySubwindows destroys children but not the window itself', done => {
        const parent = X.AllocID();
        const child = X.AllocID();
        X.CreateWindow(parent, root, 0, 0, 100, 100);
        X.CreateWindow(child, parent, 0, 0, 10, 10);
        X.DestroySubwindows(parent);
        X.QueryTree(parent, (err, tree) => {
            if (err) return done(err);
            assert.deepStrictEqual(tree.children, []);
            X.GetWindowAttributes(child, err2 => {
                assert.strictEqual(err2.error, 3);
                done();
                return true;
            });
        });
    });

    it('CirculateWindow raises the lowest child with CirculateNotify', done => {
        const parent = X.AllocID();
        X.CreateWindow(parent, root, 0, 0, 100, 100, 0, 0, 0, 0,
            { eventMask: em.SubstructureNotify });
        const c1 = X.AllocID(), c2 = X.AllocID();
        X.CreateWindow(c1, parent, 0, 0, 50, 50);
        X.CreateWindow(c2, parent, 0, 0, 50, 50);
        let created = 0;
        X.on('event', ev => {
            if (ev.name === 'CreateNotify') {
                created++;
                return;
            }
            if (ev.name === 'CirculateNotify') {
                assert.strictEqual(created, 2);
                assert.strictEqual(ev.event, parent);
                assert.strictEqual(ev.wid, c1);
                assert.strictEqual(ev.place, 0); // Top
                X.QueryTree(parent, (err, tree) => {
                    if (err) return done(err);
                    assert.deepStrictEqual(tree.children, [c2, c1]);
                    done();
                });
            }
        });
        X.CirculateWindow(parent, 0); // RaiseLowest
    });

    it('MapSubwindows maps every unmapped child', done => {
        const parent = X.AllocID();
        const c1 = X.AllocID(), c2 = X.AllocID();
        X.CreateWindow(parent, root, 0, 0, 100, 100);
        X.CreateWindow(c1, parent, 0, 0, 10, 10);
        X.CreateWindow(c2, parent, 20, 0, 10, 10);
        X.MapWindow(parent);
        X.MapSubwindows(parent);
        X.GetWindowAttributes(c1, (err, a1) => {
            if (err) return done(err);
            assert.strictEqual(a1.mapState, 2);
            X.GetWindowAttributes(c2, (err2, a2) => {
                if (err2) return done(err2);
                assert.strictEqual(a2.mapState, 2);
                done();
            });
        });
    });

    it('GetGeometry works for windows and pixmaps', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 3, 4, 15, 16, 5);
        X.GetGeometry(wid, (err, g) => {
            if (err) return done(err);
            assert.strictEqual(g.xPos, 3);
            assert.strictEqual(g.yPos, 4);
            assert.strictEqual(g.width, 15);
            assert.strictEqual(g.height, 16);
            assert.strictEqual(g.borderWidth, 5);
            assert.strictEqual(g.depth, 24);
            const pix = X.AllocID();
            X.CreatePixmap(pix, root, 24, 7, 9);
            X.GetGeometry(pix, (err2, g2) => {
                if (err2) return done(err2);
                assert.strictEqual(g2.width, 7);
                assert.strictEqual(g2.height, 9);
                assert.strictEqual(g2.depth, 24);
                done();
            });
        });
    });
});
