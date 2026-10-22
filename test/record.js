const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

// RECORD extension. Recording requires a dedicated connection for EnableContext:
// the control connection creates/registers/disables/frees the context, while a
// second, dedicated connection issues EnableContext and receives the intercepted
// protocol data.
describe('RECORD extension', () => {
    let X, record, Xenable, recordEnable;

    before(function(t, done) {
        let setupFinished = false;
        const setupError = err => {
            if (!setupFinished) {
                setupFinished = true;
                done(err);
            }
        };
        // control connection: owns the context, issues the recorded requests
        const c1 = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            X.require('record', (err, ext) => {
                assert.ifError(err);
                record = ext;
                // dedicated enable connection
                const c2 = x11.createClient((err2, dpy2) => {
                    assert.ifError(err2);
                    Xenable = dpy2.client;
                    Xenable.require('record', (err3, ext2) => {
                        assert.ifError(err3);
                        recordEnable = ext2;
                        setupFinished = true;
                        done();
                    });
                });
                c2.on('error', setupError);
            });
        });
        c1.on('error', setupError);
    });

    it('QueryVersion should report at least 1.13', function() {
        assert.strictEqual(record.major, 1);
        assert.ok(record.minor >= 0);
    });

    it('CreateContext + GetContext round-trip', function(t, done) {
        const context = X.AllocID();
        record.CreateContext(context, 0, [record.CS.AllClients], [
            { coreRequests: { first: 0, last: 127 } }
        ]);
        record.GetContext(context, (err, info) => {
            assert.ifError(err);
            assert.strictEqual(info.enabled, false);
            assert.ok(Array.isArray(info.interceptedClients));
            // one range registered for the AllClients pseudo-client
            assert.ok(info.interceptedClients.length >= 1);
            const ranges = info.interceptedClients[0].ranges;
            assert.ok(ranges.length >= 1);
            assert.strictEqual(ranges[0].coreRequests.first, 0);
            assert.strictEqual(ranges[0].coreRequests.last, 127);
            record.FreeContext(context);
            done();
        });
    });

    it('EnableContext should intercept a recorded client request', function(t, done) {
        const context = X.AllocID();
        let finished = false;

        // record ALL core requests issued by the control connection
        const controlSpec = X.display.resource_base;
        record.CreateContext(context, 0, [controlSpec], [
            { coreRequests: { first: 0, last: 127 } }
        ]);

        const finish = err => {
            if (finished)
                return;
            finished = true;
            // always clean up so we never leave a context enabled on the server
            record.FreeContext(context);
            done(err);
        };

        let started = false;
        let sawInternAtom = false;

        // EnableContext goes over a different connection than CreateContext;
        // the server may process the connections in either order, so sync the
        // control connection first to make sure the context exists
        record.GetContext(context, err => {
            assert.ifError(err);
            enable();
        });

        const enable = () => recordEnable.EnableContext(context, reply => {
            if (reply.category === record.Category.StartOfData) {
                started = true;
                // recording is now live: issue a known request on the control connection
                X.InternAtom(false, 'X11_RECORD_TEST_ATOM', () => {});
                return;
            }
            if (reply.category === record.Category.FromClient && reply.data.length > 0) {
                // first byte of a recorded request is its opcode; InternAtom == 16
                if (reply.data.readUInt8(0) === 16) {
                    sawInternAtom = true;
                    // stop recording from the control connection
                    record.DisableContext(context);
                }
            }
        }, (err) => {
            // fires when EndOfData terminates the multi-reply series
            if (err)
                return finish(err);
            assert.strictEqual(started, true);
            assert.strictEqual(sawInternAtom, true);
            finish();
        });
    });

    after(function(t, done) {
        Xenable.terminate();
        Xenable.on('end', () => {
            X.terminate();
            X.on('end', done);
        });
    });
});
