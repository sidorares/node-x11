const assert = require('assert');
const x11 = require('../../lib');
const { boot, sync } = require('./boot');

const em = x11.eventMask;
const CROSSING = em.EnterWindow | em.LeaveWindow;
const DETAIL = ['Ancestor', 'Virtual', 'Inferior', 'Nonlinear', 'NonlinearVirtual'];

// A pointer move between two windows is reported to every window it passes
// on the way through their nearest common ancestor, not only to the two ends:
// the windows between them get the Virtual and NonlinearVirtual details. Every
// list below is what Xvfb reports: this file passes unchanged against a real
// server, given a `boot` that connects to one and a `server.injectPointerMove`
// that is a WarpPointer to root coordinates.
describe('xserver: crossing events', () => {

    // root
    //   A  at (10,10), 200x150
    //     B  at (30,30) on the screen, 100x80
    //       C  at (40,40), 40x30, selecting nothing, as a GL surface does
    //     F  at (140,30), 50x50
    //   D  at (300,10), 100x100
    //     E  at (310,20), 50x50
    let server, display, X, root, names, wins, heard;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            names = new Map([[root, 'root']]);
            wins = {};
            const make = (name, parent, x, y, width, height, mask) => {
                const id = X.AllocID();
                X.CreateWindow(id, parent, x, y, width, height, 0, 0, 0, 0,
                    mask ? { eventMask: mask } : {});
                names.set(id, name);
                wins[name] = id;
            };
            X.ChangeWindowAttributes(root, { eventMask: CROSSING });
            make('A', root, 10, 10, 200, 150, CROSSING);
            make('B', wins.A, 20, 20, 100, 80, CROSSING);
            make('C', wins.B, 10, 10, 40, 30, 0);
            make('F', wins.A, 130, 20, 50, 50, CROSSING);
            make('D', root, 300, 10, 100, 100, CROSSING);
            make('E', wins.D, 10, 10, 50, 50, CROSSING);
            X.MapSubwindows(wins.A);
            X.MapSubwindows(wins.B);
            X.MapSubwindows(wins.D);
            X.MapWindow(wins.A);
            X.MapWindow(wins.D);
            heard = [];
            X.on('event', ev => {
                if (ev.name === 'EnterNotify' || ev.name === 'LeaveNotify')
                    heard.push(ev);
            });
            server.injectPointerMove(700, 500); // over the root
            sync(X, () => done());
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = null;
    });

    function line(ev) {
        const child = ev.child ? ` child=${names.get(ev.child)}` : '';
        return `${ev.name.slice(0, 5)} ${names.get(ev.wid)} ${DETAIL[ev.detail]}${child}`;
    }

    // Each move, then what every window heard from it, in order.
    function moves(steps, done) {
        const step = i => {
            if (i === steps.length)
                return done();
            const [x, y, expected] = steps[i];
            heard.length = 0;
            server.injectPointerMove(x, y);
            sync(X, () => {
                try {
                    assert.deepStrictEqual(heard.map(line), expected, `move ${i + 1}, to ${x},${y}`);
                } catch (err) {
                    return done(err);
                }
                step(i + 1);
            });
        };
        step(0);
    }

    it('a pointer leaving from over a child that selects no input is heard by every window above it', done => {
        moves([
            [45, 45, [
                'Leave root Inferior',
                'Enter A Virtual child=B',
                'Enter B Virtual child=C'
            ]],
            [700, 500, [
                'Leave B Virtual child=C',
                'Leave A Virtual child=B',
                'Enter root Inferior'
            ]]
        ], done);
    });

    it('down into a descendant and back up, the windows between the two say Virtual', done => {
        moves([
            [90, 80, [
                'Leave root Inferior',
                'Enter A Virtual child=B',
                'Enter B Ancestor'
            ]],
            [15, 15, ['Leave B Ancestor', 'Enter A Inferior']],
            [45, 45, ['Leave A Inferior', 'Enter B Virtual child=C']],
            [15, 15, ['Leave B Virtual child=C', 'Enter A Inferior']],
            [90, 80, ['Leave A Inferior', 'Enter B Ancestor']],
            [45, 45, ['Leave B Inferior']]
        ], done);
    });

    it('between two toplevels, the leaves go up to the common ancestor and the enters come down from it', done => {
        moves([
            [45, 45, [
                'Leave root Inferior',
                'Enter A Virtual child=B',
                'Enter B Virtual child=C'
            ]],
            [315, 25, [
                'Leave B NonlinearVirtual child=C',
                'Leave A NonlinearVirtual child=B',
                'Enter D NonlinearVirtual child=E',
                'Enter E Nonlinear'
            ]],
            [90, 80, [
                'Leave E Nonlinear',
                'Leave D NonlinearVirtual child=E',
                'Enter A NonlinearVirtual child=B',
                'Enter B Nonlinear'
            ]],
            [15, 15, ['Leave B Ancestor', 'Enter A Inferior']],
            [315, 25, [
                'Leave A Nonlinear',
                'Enter D NonlinearVirtual child=E',
                'Enter E Nonlinear'
            ]],
            [45, 45, [
                'Leave E Nonlinear',
                'Leave D NonlinearVirtual child=E',
                'Enter A NonlinearVirtual child=B',
                'Enter B NonlinearVirtual child=C'
            ]]
        ], done);
    });

    it('between two children, the window holding both hears nothing', done => {
        moves([
            [45, 45, [
                'Leave root Inferior',
                'Enter A Virtual child=B',
                'Enter B Virtual child=C'
            ]],
            [160, 50, ['Leave B NonlinearVirtual child=C', 'Enter F Nonlinear']],
            [90, 80, ['Leave F Nonlinear', 'Enter B Nonlinear']],
            [700, 500, [
                'Leave B Ancestor',
                'Leave A Virtual child=B',
                'Enter root Inferior'
            ]]
        ], done);
    });

    it('a move inside one window crosses nothing', done => {
        moves([
            [15, 15, ['Leave root Inferior', 'Enter A Ancestor']],
            [25, 20, []],
            [45, 45, ['Leave A Inferior', 'Enter B Virtual child=C']],
            [50, 50, []]
        ], done);
    });

    it('every event of one move is in its own window\'s coordinates, at one time', done => {
        server.injectPointerMove(45, 45);
        sync(X, () => {
            const fields = heard.map(ev => ({
                win: names.get(ev.wid), root: ev.root, x: ev.x, y: ev.y,
                rootx: ev.rootx, rooty: ev.rooty, mode: ev.mode, state: ev.buttons
            }));
            const at = (win, x, y) => ({
                win, root, x, y, rootx: 45, rooty: 45, mode: 0 /* Normal */, state: 0
            });
            assert.deepStrictEqual(fields, [at('root', 45, 45), at('A', 35, 35), at('B', 15, 15)]);
            assert.ok(heard.every(ev => ev.time === heard[0].time), 'one move, one time');
            done();
        });
    });

    // The flags byte: bit 1 same screen, bit 0 the keyboard focus reaching the
    // window, by being PointerRoot, the window itself or an ancestor of it.
    it('each event says whether the keyboard focus reaches its window', done => {
        const step = (focus, x, y, cb) => {
            X.SetInputFocus(focus, 1 /* revert to PointerRoot */);
            sync(X, () => {
                heard.length = 0;
                server.injectPointerMove(x, y);
                sync(X, () => cb(heard.map(ev => `${names.get(ev.wid)} ${ev.sameScreenFocus}`)));
            });
        };
        step(1 /* PointerRoot */, 45, 45, pointerRoot => {
            step(wins.A, 700, 500, onA => {
                step(0 /* None */, 45, 45, none => {
                    assert.deepStrictEqual(pointerRoot, ['root 3', 'A 3', 'B 3']);
                    assert.deepStrictEqual(onA, ['B 3', 'A 3', 'root 2']);
                    assert.deepStrictEqual(none, ['root 2', 'A 2', 'B 2']);
                    done();
                });
            });
        });
    });
});
