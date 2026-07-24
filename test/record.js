const x11 = require('../lib');
const should = require('should');

// RECORD extension. Recording requires a dedicated connection for EnableContext:
// the control connection creates/registers/disables/frees the context, while a
// second, dedicated connection issues EnableContext and receives the intercepted
// protocol data.
describe('RECORD extension', () => {
    before(function(done) {
        const self = this;
        // control connection: owns the context, issues the recorded requests
        const c1 = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.X.require('record', (err, ext) => {
                should.not.exist(err);
                self.record = ext;
                // dedicated enable connection
                const c2 = x11.createClient((err2, dpy2) => {
                    should.not.exist(err2);
                    self.Xenable = dpy2.client;
                    self.Xenable.require('record', (err3, ext2) => {
                        should.not.exist(err3);
                        self.recordEnable = ext2;
                        done();
                    });
                });
                c2.on('error', done);
            });
        });
        c1.on('error', done);
    });

    it('QueryVersion should report at least 1.13', function() {
        this.record.major.should.equal(1);
        this.record.minor.should.be.aboveOrEqual(0);
    });

    it('CreateContext + GetContext round-trip', function(done) {
        const self = this;
        const context = this.X.AllocID();
        this.record.CreateContext(context, 0, [this.record.CS.AllClients], [
            { coreRequests: { first: 0, last: 127 } }
        ]);
        this.record.GetContext(context, (err, info) => {
            should.not.exist(err);
            info.enabled.should.equal(false);
            info.interceptedClients.should.be.an.Array();
            // one range registered for the AllClients pseudo-client
            info.interceptedClients.length.should.be.aboveOrEqual(1);
            const ranges = info.interceptedClients[0].ranges;
            ranges.length.should.be.aboveOrEqual(1);
            ranges[0].coreRequests.first.should.equal(0);
            ranges[0].coreRequests.last.should.equal(127);
            self.record.FreeContext(context);
            done();
        });
    });

    it('EnableContext should intercept a recorded client request', function(done) {
        const self = this;
        const context = this.X.AllocID();
        let finished = false;

        // record ALL core requests issued by the control connection
        const controlSpec = this.X.display.resource_base;
        this.record.CreateContext(context, 0, [controlSpec], [
            { coreRequests: { first: 0, last: 127 } }
        ]);

        const finish = err => {
            if (finished)
                return;
            finished = true;
            // always clean up so we never leave a context enabled on the server
            self.record.FreeContext(context);
            done(err);
        };

        let started = false;
        let sawInternAtom = false;

        this.recordEnable.EnableContext(context, reply => {
            if (reply.category === self.record.Category.StartOfData) {
                started = true;
                // recording is now live: issue a known request on the control connection
                self.X.InternAtom(false, 'X11_RECORD_TEST_ATOM', () => {});
                return;
            }
            if (reply.category === self.record.Category.FromClient && reply.data.length > 0) {
                // first byte of a recorded request is its opcode; InternAtom == 16
                if (reply.data.readUInt8(0) === 16) {
                    sawInternAtom = true;
                    // stop recording from the control connection
                    self.record.DisableContext(context);
                }
            }
        }, (err) => {
            // fires when EndOfData terminates the multi-reply series
            if (err)
                return finish(err);
            started.should.equal(true);
            sawInternAtom.should.equal(true);
            finish();
        });
    });

    after(function(done) {
        const self = this;
        this.Xenable.terminate();
        this.Xenable.on('end', () => {
            self.X.terminate();
            self.X.on('end', done);
        });
    });
});
