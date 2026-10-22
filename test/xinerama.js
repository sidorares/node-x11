const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('XINERAMA extension', () => {
    let X, root, xinerama;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            X.require('xinerama', (err, ext) => {
                assert.ifError(err);
                xinerama = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('QueryVersion should report at least 1.1', function() {
        assert.ok(xinerama.major >= 1);
        assert.ok(xinerama.minor >= 1);
    });

    it('GetState should return a 0/1 flag for the root window', function(t, done) {
        xinerama.GetState(root, (err, state) => {
            assert.ifError(err);
            assert.ok(state >= 0 && state <= 1);
            done();
        });
    });

    it('GetScreenCount should return a number for the root window', function(t, done) {
        xinerama.GetScreenCount(root, (err, count) => {
            assert.ifError(err);
            assert.strictEqual(typeof count, 'number');
            assert.ok(count >= 0);
            done();
        });
    });

    it('IsActive and QueryScreens should agree with each other', function(t, done) {
        xinerama.IsActive((err, state) => {
            assert.ifError(err);
            xinerama.QueryScreens((err, screens) => {
                assert.ifError(err);
                assert.ok(Array.isArray(screens));
                if (state === 0) {
                    assert.strictEqual(screens.length, 0);
                } else {
                    assert.ok(screens.length > 0);
                    assert.ok(screens[0].width > 0);
                    assert.ok(screens[0].height > 0);
                }
                done();
            });
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});
