const assert = require('assert');
const x11 = require('../../lib');
const { createServer } = require('../../lib/xserver');
const { boot, sync } = require('./boot');

const em = x11.eventMask;

describe('xserver: multiple clients', () => {

    let server, A, B, dispA, dispB, root;

    beforeEach(done => {
        server = createServer();
        boot({ server }, (err, ctxA) => {
            if (err) return done(err);
            A = ctxA.X;
            dispA = ctxA.display;
            root = dispA.screen[0].root;
            boot({ server }, (err2, ctxB) => {
                if (err2) return done(err2);
                B = ctxB.X;
                dispB = ctxB.display;
                done();
            });
        });
    });

    afterEach(() => {
        if (A) A.terminate();
        if (B) B.terminate();
        server = A = B = null;
    });

    it('another client sees CreateNotify via SubstructureNotify on the root', done => {
        B.ChangeWindowAttributes(root, { eventMask: em.SubstructureNotify });
        sync(B, () => {
            const wid = A.AllocID();
            B.on('event', ev => {
                if (ev.name !== 'CreateNotify')
                    return;
                assert.strictEqual(ev.parent, root);
                assert.strictEqual(ev.wid, wid);
                done();
            });
            A.CreateWindow(wid, root, 0, 0, 30, 30);
        });
    });

    it('per-client event isolation: Expose goes only to the selecting client', done => {
        const wid = A.AllocID();
        A.CreateWindow(wid, root, 0, 0, 30, 30, 0, 0, 0, 0,
            { eventMask: em.Exposure });
        const bEvents = [];
        B.on('event', ev => bEvents.push(ev.name));
        A.on('event', ev => {
            if (ev.name !== 'Expose')
                return;
            assert.strictEqual(ev.wid, wid);
            setTimeout(() => {
                assert.deepStrictEqual(bEvents, [], 'B selected nothing, gets nothing');
                done();
            }, 20);
        });
        A.MapWindow(wid);
    });

    it('client disconnect destroys its windows with DestroyNotify to others', done => {
        B.ChangeWindowAttributes(root, { eventMask: em.SubstructureNotify });
        const wid = A.AllocID();
        A.CreateWindow(wid, root, 0, 0, 30, 30);
        A.MapWindow(wid);
        sync(A, () => sync(B, () => {
            B.on('event', ev => {
                if (ev.name !== 'DestroyNotify')
                    return;
                assert.strictEqual(ev.wid, wid);
                assert.ok(!server.resources.has(wid), 'resource freed');
                B.GetWindowAttributes(wid, err => {
                    assert.strictEqual(err.error, 3); // BadWindow
                    done();
                    return true;
                });
            });
            A.terminate();
            A = null;
        }));
    });

    it('KillClient by resource id closes that client and frees resources', done => {
        const wid = A.AllocID();
        A.CreateWindow(wid, root, 0, 0, 30, 30);
        sync(A, () => {
            A.on('end', () => {
                assert.ok(!server.resources.has(wid));
                A = null;
                done();
            });
            B.KillClient(wid);
        });
    });

    it('selection handover: request/notify flow between clients', done => {
        const owner = A.AllocID();
        A.CreateWindow(owner, root, 0, 0, 5, 5);
        const requestor = B.AllocID();
        B.CreateWindow(requestor, root, 0, 0, 5, 5);
        A.InternAtom(false, 'XSRV_MC_SELECTION', (err, selection) => {
            if (err) return done(err);
            A.SetSelectionOwner(owner, selection);
            A.GetSelectionOwner(selection, (err2, got) => {
                if (err2) return done(err2);
                assert.strictEqual(got, owner);
                A.on('event', ev => {
                    if (ev.name !== 'SelectionRequest')
                        return;
                    assert.strictEqual(ev.owner, owner);
                    assert.strictEqual(ev.requestor, requestor);
                    assert.strictEqual(ev.selection, selection);
                    // owner answers with a SelectionNotify through SendEvent
                    A.SendEvent(ev.requestor, false, 0, {
                        name: 'SelectionNotify',
                        time: ev.time,
                        requestor: ev.requestor,
                        selection: ev.selection,
                        target: ev.target,
                        property: ev.property
                    });
                });
                B.on('event', ev => {
                    if (ev.name !== 'SelectionNotify')
                        return;
                    assert.strictEqual(ev.requestor, requestor);
                    assert.strictEqual(ev.selection, selection);
                    assert.ok(ev.property !== 0);
                    done();
                });
                B.ConvertSelection(requestor, selection, 31 /* STRING */, 31, 0);
            });
        });
    });

    it('ConvertSelection with no owner refuses with property None', done => {
        const requestor = B.AllocID();
        B.CreateWindow(requestor, root, 0, 0, 5, 5);
        B.InternAtom(false, 'XSRV_MC_NO_OWNER_SEL', (err, selection) => {
            if (err) return done(err);
            B.on('event', ev => {
                if (ev.name !== 'SelectionNotify')
                    return;
                assert.strictEqual(ev.property, 0);
                assert.strictEqual(ev.requestor, requestor);
                done();
            });
            B.ConvertSelection(requestor, selection, 31, 31, 0);
        });
    });

    it('SetSelectionOwner change sends SelectionClear to the old owner', done => {
        const winA = A.AllocID();
        A.CreateWindow(winA, root, 0, 0, 5, 5);
        const winB = B.AllocID();
        B.CreateWindow(winB, root, 0, 0, 5, 5);
        A.InternAtom(false, 'XSRV_MC_CLEAR_SEL', (err, selection) => {
            if (err) return done(err);
            A.SetSelectionOwner(winA, selection);
            A.on('event', ev => {
                if (ev.name !== 'SelectionClear')
                    return;
                assert.strictEqual(ev.owner, winA);
                assert.strictEqual(ev.selection, selection);
                done();
            });
            sync(A, () => B.SetSelectionOwner(winB, selection));
        });
    });

    it('SendEvent delivers a ClientMessage with the send_event flag', done => {
        const wid = A.AllocID();
        A.CreateWindow(wid, root, 0, 0, 5, 5, 0, 0, 0, 0,
            { eventMask: em.PropertyChange });
        sync(A, () => {
            A.on('event', ev => {
                if (ev.name !== 'ClientMessage')
                    return;
                assert.strictEqual(ev.wid, wid);
                assert.strictEqual(ev.format, 32);
                assert.strictEqual(ev.message_type, 6); // CARDINAL
                assert.deepStrictEqual(ev.data, [11, 22, 33, 44, 55]);
                assert.strictEqual(ev.rawData[0] & 0x80, 0x80, 'send_event bit set');
                done();
            });
            // event-mask 0: goes to the window's creator (A) even if B sends it
            B.SendClientMessage(wid, wid, 6 /* CARDINAL */, 32, [11, 22, 33, 44, 55], 0);
        });
    });
});
