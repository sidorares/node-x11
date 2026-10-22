const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

const TEST_PROPERTY = 'My Test Property';

describe('ChangeProperty', () => {
    let X, wid, wid_helper;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            wid = X.AllocID();
            wid_helper = X.AllocID();
            X.CreateWindow(wid, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
            X.QueryTree(dpy.screen[0].root, (err, list) => {
                assert.ifError(err);
                assert.notStrictEqual(list.children.indexOf(wid), -1);
                X.ChangeWindowAttributes(wid, { eventMask: x11.eventMask.PropertyChange });
                done();
            });
        });

        client.on('error', done);
    });

    it('should add a new WINDOW property with length 1', function(t, done) {
        X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            assert.ifError(err);
            const raw = Buffer.alloc(4);
            raw.writeUInt32LE(wid, 0);
            X.ChangeProperty(0, wid, atom, X.atoms.WINDOW, 32, raw);
            X.once('event', ev => {
                assert.strictEqual(ev.type, 28);
                assert.strictEqual(ev.atom, atom);
                assert.strictEqual(ev.wid, wid);
                X.GetProperty(0, wid, atom, X.atoms.WINDOW, 0, 1000000000, (err, prop) => {
                    assert.ifError(err);
                    assert.strictEqual(prop.data.readUInt32LE(0), wid);
                    done();
                });
            });
        });
    });

    it('should add a new WINDOW property with length 2', function(t, done) {
        X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            assert.ifError(err);
            const raw = Buffer.from(new Array(8));
            raw.writeUInt32LE(wid, 0);
            raw.writeUInt32LE(wid_helper, 4);
            X.ChangeProperty(0, wid, atom, X.atoms.ATOM, 32, raw);
            X.once('event', ev => {
                assert.strictEqual(ev.type, 28);
                assert.strictEqual(ev.atom, atom);
                assert.strictEqual(ev.wid, wid);
                X.GetProperty(0, wid, atom, X.atoms.ATOM, 0, 1000000000, (err, prop) => {
                    assert.ifError(err);
                    assert.strictEqual(prop.data.readUInt32LE(0), wid);
                    assert.strictEqual(prop.data.readUInt32LE(4), wid_helper);
                    done();
                });
            });
        });
    });

    it('should replace a the WINDOW property with length 0', function(t, done) {
        X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            assert.ifError(err);
            const raw = Buffer.alloc(0);
            X.ChangeProperty(0, wid, atom, X.atoms.WINDOW, 32, raw);
            X.once('event', ev => {
                assert.strictEqual(ev.type, 28);
                assert.strictEqual(ev.atom, atom);
                assert.strictEqual(ev.wid, wid);
                X.GetProperty(0, wid, atom, X.atoms.WINDOW, 0, 1000000000, (err, prop) => {
                    assert.ifError(err);
                    assert.strictEqual(prop.data.length, 0);
                    done();
                });
            });
        });
    });

    it('should encode a number array at the declared format width', function(t, done) {
        // Buffer.from([1366]) keeps only the low byte, so this used to reach
        // the server as an empty property with one garbage byte behind it
        const strut = [0, 0, 0, 23, 0, 0, 0, 0, 0, 0, 0, 1366];
        X.InternAtom(false, 'X11_TEST_STRUT', (err, atom) => {
            assert.ifError(err);
            X.ChangeProperty(0, wid, atom, X.atoms.CARDINAL, 32, strut);
            X.GetProperty(0, wid, atom, X.atoms.CARDINAL, 0, 100, (err, prop) => {
                assert.ifError(err);
                assert.strictEqual(prop.data.length, 48);
                const out = [];
                for (let i = 0; i + 4 <= prop.data.length; i += 4)
                    out.push(prop.data.readUInt32LE(i));
                assert.deepStrictEqual(out, strut);
                done();
            });
        });
    });

    it('should encode a bare number as one element of the declared format', function(t, done) {
        X.InternAtom(false, 'X11_TEST_NUMBER', (err, atom) => {
            assert.ifError(err);
            X.ChangeProperty(0, wid, atom, X.atoms.CARDINAL, 32, 0xdeadbeef);
            X.GetProperty(0, wid, atom, X.atoms.CARDINAL, 0, 100, (err, prop) => {
                assert.ifError(err);
                assert.strictEqual(prop.data.length, 4);
                assert.strictEqual(prop.data.readUInt32LE(0), 0xdeadbeef);
                done();
            });
        });
    });

    it('should keep packing a byte array at format 8', function(t, done) {
        X.InternAtom(false, 'X11_TEST_BYTES', (err, atom) => {
            assert.ifError(err);
            X.ChangeProperty(0, wid, atom, X.atoms.STRING, 8, [104, 105]);
            X.GetProperty(0, wid, atom, X.atoms.STRING, 0, 100, (err, prop) => {
                assert.ifError(err);
                assert.strictEqual(prop.data.toString(), 'hi');
                done();
            });
        });
    });

    after(function(t, done) {
        X.DestroyWindow(wid);
        X.terminate();
        X.on('end', done);
    });
});

