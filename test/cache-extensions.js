const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

// No server has this, so QueryExtension always answers present = 0.
const ABSENT = 'NoSuchExtension-node-x11';

describe('requiring an X11 extension on same connection', () => {
    let X;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            done();
        });

        client.on('error', err => {
            console.error('Error : ', err);
        });
    });

    it('should be cached', function(t, done) {
        X.require('xtest', (err, randr) => {
            assert.ifError(err);
            X.require('xtest', (err, randr1) => {
                assert.ifError(err);
                assert.strictEqual(randr, randr1);
                done();
            });
        });
    });

    it('should not re-ask the server for an extension it already queried', function(t, done) {
        X.QueryExtension('XTEST', (err, first) => {
            assert.ifError(err);
            const put = t.mock.method(X.pack_stream, 'put');
            X.QueryExtension('XTEST', (err, second) => {
                assert.ifError(err);
                assert.strictEqual(second.majorOpcode, first.majorOpcode);
                assert.strictEqual(put.mock.callCount(), 0);
                done();
            });
        });
    });

    // The reason this cache exists: require() remembers only the extensions it
    // resolved, so a client that keeps probing for a missing one used to put a
    // QueryExtension on the wire every single time.
    it('should not re-ask for an extension the server does not have', function(t, done) {
        X.QueryExtension(ABSENT, (err, first) => {
            assert.ifError(err);
            assert.strictEqual(first.present, 0);
            const put = t.mock.method(X.pack_stream, 'put');
            X.QueryExtension(ABSENT, (err, second) => {
                assert.ifError(err);
                assert.strictEqual(second.present, 0);
                assert.strictEqual(put.mock.callCount(), 0);
                done();
            });
        });
    });

    it('should keep a failing require() off the wire after the first try', function(t, done) {
        X.require('dri3', () => {
            // Whether this server has DRI3 or not, asking again is free.
            const put = t.mock.method(X.pack_stream, 'put');
            X.require('dri3', () => {
                assert.strictEqual(put.mock.callCount(), 0);
                done();
            });
        });
    });

    // requireExt() hangs the extension's own methods off the reply object it
    // is handed, so handing out the cached one would let it be decorated once
    // and then reused in that state.
    it('should hand out a fresh reply object each time', function(t, done) {
        X.QueryExtension('XTEST', (err, first) => {
            assert.ifError(err);
            first.scribble = 'mutated';
            X.QueryExtension('XTEST', (err, second) => {
                assert.ifError(err);
                assert.notStrictEqual(second, first);
                assert.ok(second.scribble == null);
                done();
            });
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});
