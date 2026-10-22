const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('MIT-SCREEN-SAVER extension', () => {
    let display;
    let X;
    let saver;
    let root;

    before((t, done) => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            X.require('screen-saver', (err, ext) => {
                assert.ifError(err);
                saver = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after((t, done) => {
        // safety: never leave the shared server suspended or with saver attributes set
        saver.Suspend(false);
        saver.UnsetAttributes(root);
        X.GetInputFocus(() => {
            X.terminate();
            X.on('end', done);
        });
    });

    it('QueryVersion (auto) should report version 1.x', () => {
        assert.strictEqual(saver.major, 1);
        assert.ok(saver.minor >= 1);
    });

    it('QueryInfo should return saver info for the root window', (t, done) => {
        saver.QueryInfo(root, (err, info) => {
            assert.ifError(err);
            assert.ok(info.state >= 0 && info.state <= 3);
            assert.strictEqual(typeof info.idle, 'number');
            assert.strictEqual(typeof info.until, 'number');
            assert.ok(info.kind >= 0 && info.kind <= 2);
            done();
        });
    });

    it('SetAttributes then UnsetAttributes should be accepted', (t, done) => {
        // class/depth/visual 0 = CopyFromParent
        saver.SetAttributes(root, 0, 0, 100, 100, 0, 0, 0, 0,
            { backgroundPixel: display.screen[0].black_pixel });
        saver.UnsetAttributes(root);
        // sync: any error in the two requests above would arrive before this reply
        saver.QueryInfo(root, (err, info) => {
            assert.ifError(err);
            assert.ok(info != null);
            done();
        });
    });

    it('Suspend on/off should be accepted and leave the saver queryable', (t, done) => {
        saver.Suspend(true);
        saver.QueryInfo(root, (err, info) => {
            // always release the suspension, even if the assertion below throws
            saver.Suspend(false);
            assert.ifError(err);
            assert.ok(info != null);
            saver.QueryInfo(root, (err2, info2) => {
                assert.ifError(err2);
                assert.ok(info2.state >= 0 && info2.state <= 3);
                done();
            });
        });
    });
});
