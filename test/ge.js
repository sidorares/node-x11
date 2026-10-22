const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Generic Event extension', () => {
    let X, ge;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            X.require('ge', (err, ext) => {
                assert.ifError(err);
                ge = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('QueryVersion should report at least 1.0', function() {
        assert.ok(ge.major >= 1);
        assert.ok(ge.minor >= 0);
    });

    it('explicit QueryVersion round-trip should agree with negotiated version', function(t, done) {
        ge.QueryVersion(1, 0, (err, vers) => {
            assert.ifError(err);
            assert.strictEqual(vers[0], ge.major);
            assert.strictEqual(vers[1], ge.minor);
            done();
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});
