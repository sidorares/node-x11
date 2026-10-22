const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('XC-MISC extension', () => {
    let display;
    let X;
    let xcmisc;

    before((t, done) => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            X.require('xc-misc', (err, ext) => {
                assert.ifError(err);
                xcmisc = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after((t, done) => {
        X.terminate();
        X.on('end', done);
    });

    it('GetVersion should return major 1, minor >= 1', (t, done) => {
        xcmisc.GetVersion(1, 1, (err, version) => {
            assert.ifError(err);
            assert.strictEqual(version[0], 1);
            assert.ok(version[1] >= 1);
            done();
        });
    });

    it('auto GetVersion should have set ext.major/ext.minor', () => {
        assert.strictEqual(xcmisc.major, 1);
        assert.ok(xcmisc.minor >= 1);
    });

    it('GetXIDRange should return a non-empty id range', (t, done) => {
        xcmisc.GetXIDRange((err, range) => {
            assert.ifError(err);
            assert.ok(range.startId > 0);
            assert.ok(range.count > 0);
            done();
        });
    });

    it('GetXIDList should return the requested number of ids', (t, done) => {
        xcmisc.GetXIDList(5, (err, ids) => {
            assert.ifError(err);
            assert.ok(Array.isArray(ids));
            assert.strictEqual(ids.length, 5);
            ids.forEach(id => {
                assert.strictEqual(typeof id, 'number');
                assert.ok(id > 0);
            });
            done();
        });
    });
});
