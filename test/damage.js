const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('DAMAGE extension', () => {
    let X, root, white, black, damageExt;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            white = dpy.screen[0].white_pixel;
            black = dpy.screen[0].black_pixel;
            X.require('damage', (err, ext) => {
                assert.ifError(err);
                damageExt = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('Create + drawing should deliver a DamageNotify event', function(t, done) {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 60, 60, 0, 0, 0, 0,
            { backgroundPixel: white });
        X.MapWindow(wid);
        const damage = X.AllocID();
        damageExt.Create(damage, wid, damageExt.ReportLevel.NonEmpty);
        const gc = X.AllocID();
        X.CreateGC(gc, wid, { foreground: black });
        const listener = ev => {
            if (ev.name !== 'DamageNotify' || ev.damage !== damage)
                return;
            X.removeListener('event', listener);
            assert.strictEqual(ev.drawable, wid);
            // routing by type must work as it does for every other event
            assert.strictEqual(ev.type, damageExt.firstEvent + damageExt.events.DamageNotify);
            damageExt.Destroy(damage);
            X.FreeGC(gc);
            X.DestroyWindow(wid);
            done();
        };
        X.on('event', listener);
        X.PolyFillRectangle(wid, gc, [10, 10, 20, 20]);
    });

    it('Destroy should be accepted by the server (regression: was BadLength)', function(t, done) {
        const damage = X.AllocID();
        damageExt.Create(damage, root, damageExt.ReportLevel.NonEmpty);
        damageExt.Destroy(damage);
        const errors = [];
        const onError = err => errors.push(err);
        X.on('error', onError);
        // round-trip to flush any pending error for the requests above
        X.GetGeometry(root, err => {
            assert.ifError(err);
            X.removeListener('error', onError);
            assert.strictEqual(errors.length, 0);
            done();
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});
