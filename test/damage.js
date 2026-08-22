const x11 = require('../lib');
const should = require('should');

describe('DAMAGE extension', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.white = dpy.screen[0].white_pixel;
            self.black = dpy.screen[0].black_pixel;
            self.X.require('damage', (err, ext) => {
                should.not.exist(err);
                self.damage = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('Create + drawing should deliver a DamageNotify event', function(done) {
        const X = this.X;
        const wid = X.AllocID();
        X.CreateWindow(wid, this.root, 0, 0, 60, 60, 0, 0, 0, 0,
            { backgroundPixel: this.white });
        X.MapWindow(wid);
        const damage = X.AllocID();
        this.damage.Create(damage, wid, this.damage.ReportLevel.NonEmpty);
        const gc = X.AllocID();
        X.CreateGC(gc, wid, { foreground: this.black });
        const listener = ev => {
            if (ev.name !== 'DamageNotify' || ev.damage !== damage)
                return;
            X.removeListener('event', listener);
            ev.drawable.should.equal(wid);
            // routing by type must work as it does for every other event
            ev.type.should.equal(this.damage.firstEvent + this.damage.events.DamageNotify);
            this.damage.Destroy(damage);
            X.FreeGC(gc);
            X.DestroyWindow(wid);
            done();
        };
        X.on('event', listener);
        X.PolyFillRectangle(wid, gc, [10, 10, 20, 20]);
    });

    it('Destroy should be accepted by the server (regression: was BadLength)', function(done) {
        const X = this.X;
        const damage = X.AllocID();
        this.damage.Create(damage, this.root, this.damage.ReportLevel.NonEmpty);
        this.damage.Destroy(damage);
        const errors = [];
        const onError = err => errors.push(err);
        X.on('error', onError);
        // round-trip to flush any pending error for the requests above
        X.GetGeometry(this.root, err => {
            should.not.exist(err);
            X.removeListener('error', onError);
            errors.should.have.length(0);
            done();
        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
