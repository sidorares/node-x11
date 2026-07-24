const x11 = require('../lib');
const should = require('should');

// Present events (CompleteNotify etc.) are GenericEvents, dispatched via
// X.geEventParsers (see lib/ext/present.js); the last test below covers the
// event path, the rest validate requests (PresentPixmap through a core
// GetImage read-back).

describe('Present extension', () => {

    const W = 40;
    const H = 40;

    let display;
    let X;
    let root;
    let white;
    let black;
    let depth;
    let present;
    let wid;
    let pixmap;
    let gc;
    let bytesPP;

    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            white = display.screen[0].white_pixel;
            black = display.screen[0].black_pixel;
            depth = display.screen[0].root_depth;
            bytesPP = depth <= 8 ? 1 : (depth <= 16 ? 2 : 4);
            X.require('present', (err, ext) => {
                should.not.exist(err);
                present = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after(done => {
        if (gc) X.FreeGC(gc);
        if (pixmap) X.FreePixmap(pixmap);
        if (wid) X.DestroyWindow(wid);
        X.terminate();
        X.on('end', done);
    });

    function getPixel(imageData, x, y) {
        const off = (y * W + x) * bytesPP;
        let value = 0;
        for (let i = 0; i < bytesPP; ++i)
            value += imageData[off + i] << (8 * i);
        return value >>> 0;
    }

    it('QueryVersion should report at least 1.0', () => {
        present.major.should.be.aboveOrEqual(1);
        present.minor.should.be.aboveOrEqual(0);
    });

    it('QueryCapabilities should return a capability mask for the root window', done => {
        present.QueryCapabilities(root, (err, caps) => {
            should.not.exist(err);
            caps.should.be.a.Number();
            const known = present.Capability.Async | present.Capability.Fence |
                present.Capability.UST | 8 /* AsyncMayTear */ | 16 /* Syncobj */;
            (caps & ~known).should.equal(0);
            done();
        });
    });

    it('PresentPixmap should copy pixmap contents onto a mapped window', function(done) {
        this.timeout(5000);
        wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, W, H, 0, 0, 0, 0, {
            backgroundPixel: black,
            eventMask: x11.eventMask.Exposure | x11.eventMask.StructureNotify
        });
        X.MapWindow(wid);

        const onMapped = () => {
            pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, depth, W, H);
            gc = X.AllocID();
            X.CreateGC(gc, pixmap, { foreground: white, background: black });
            X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]); // all white

            present.Pixmap(wid, pixmap, {
                serial: 1,
                options: present.Option.Async | present.Option.Copy
            });

            // the copy happens at the (fake) vblank - poll the window
            let attempts = 0;
            const poll = () => {
                X.GetImage(2, wid, 0, 0, W, H, 0xffffffff, (err, img) => {
                    should.not.exist(err);
                    if (getPixel(img.data, W >> 1, H >> 1) === (white >>> 0))
                        return done();
                    if (++attempts > 40)
                        return done(new Error('presented pixel never appeared on the window'));
                    setTimeout(poll, 50);
                });
            };
            poll();
        };

        // no WM on Xvfb: MapNotify arrives almost immediately
        const listener = ev => {
            if (ev.name === 'MapNotify' && ev.wid === wid) {
                X.removeListener('event', listener);
                onMapped();
            }
        };
        X.on('event', listener);
    });

    it('NotifyMSC with no event selection should not error', function(done) {
        this.timeout(3000);
        const errors = [];
        const onError = err => errors.push(err);
        X.on('error', onError);
        present.NotifyMSC(wid, 42, 0, 0, 0);
        // nobody selected for Present events, so the completion event is
        // dropped by the server; just verify the request itself is accepted
        setTimeout(() => {
            present.QueryCapabilities(root, (err, caps) => {
                X.removeListener('error', onError);
                should.not.exist(err);
                errors.should.have.length(0);
                done();
            });
        }, 100);
    });

    it('SelectInput with an empty mask should be accepted', done => {
        const errors = [];
        const onError = err => errors.push(err);
        X.on('error', onError);
        const eid = X.AllocID();
        present.SelectInput(eid, wid, present.EventMask.NoEvent);
        present.QueryCapabilities(root, (err, caps) => {
            X.removeListener('error', onError);
            should.not.exist(err);
            errors.should.have.length(0);
            done();
        });
    });

    it('SelectInput + NotifyMSC should deliver a PresentCompleteNotify GenericEvent', function(done) {
        this.timeout(3000);
        const eid = X.AllocID();
        const serial = 12345;
        const listener = ev => {
            if (ev.name !== 'PresentCompleteNotify')
                return;
            X.removeListener('event', listener);
            ev.kind.should.equal(present.CompleteKind.NotifyMSC);
            ev.window.should.equal(wid);
            ev.serial.should.equal(serial);
            ev.msc.should.be.a.Number();
            // a later request must still round-trip: proves the variable-length
            // GenericEvent did not corrupt the reply stream framing
            present.QueryCapabilities(root, (err, caps) => {
                should.not.exist(err);
                present.SelectInput(eid, wid, present.EventMask.NoEvent);
                done();
            });
        };
        X.on('event', listener);
        present.SelectInput(eid, wid, present.EventMask.CompleteNotify);
        present.NotifyMSC(wid, serial, 0, 0, 0);
    });
});
