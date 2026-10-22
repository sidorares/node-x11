const { describe, it, before, after, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');
const util = require('util');

describe('XTEST extension', () => {
    let display;
    let X;
    let xtest;
    before((t, done) => {
        const client = x11.createClient((err, dpy) => {
            if (!err) {
                display = dpy;
                X = display.client;
                X.require('xtest', (err, ext) => {
                    assert.ifError(err);
                    xtest = ext;
                    done();
                });
            } else {
                done(err);
            }
        });

        client.on('error', done);
    });

    describe('GetVersion', () => {
        it('should return version 2.2', (t, done) => {
            xtest.GetVersion(2, 2, (err, version) => {
                assert.deepStrictEqual(version, [2, 2]);
                done();
            });
        });
    });

    describe('CompareCursor', () => {
        it('should return true comparing None with a window without cursor', (t, done) => {
            const root = display.screen[0].root;
            const wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, 10, 10);
            xtest.CompareCursor(wid, xtest.Cursor.None, (err, same) => {
                X.DestroyWindow(wid);
                assert.ifError(err);
                assert.strictEqual(same, true);
                done();
            });
        });

        it('should match the cursor set on a window and mismatch None', (t, done) => {
            const root = display.screen[0].root;
            const fid = X.AllocID();
            X.OpenFont(fid, 'cursor');
            const cid = X.AllocID();
            // 68/69 - XC_left_ptr glyph and its mask in the standard cursor font
            X.CreateGlyphCursor(cid, fid, fid, 68, 69,
                { R: 0, G: 0, B: 0 }, { R: 0xffff, G: 0xffff, B: 0xffff });
            X.CloseFont(fid);
            const wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0, { cursor: cid });
            xtest.CompareCursor(wid, cid, (err, same) => {
                assert.ifError(err);
                assert.strictEqual(same, true);
                xtest.CompareCursor(wid, xtest.Cursor.None, (err, same) => {
                    X.DestroyWindow(wid);
                    X.FreeCursor(cid);
                    assert.ifError(err);
                    assert.strictEqual(same, false);
                    done();
                });
            });
        });
    });

    describe('FakeInput', () => {
        it('MotionNotify should move the pointer to the requested position', (t, done) => {
            const root = display.screen[0].root;
            X.QueryPointer(root, (err, before) => {
                assert.ifError(err);
                // detail 0 = absolute, root 0 = current screen
                xtest.FakeInput(xtest.MotionNotify, 0, 0, 0, 33, 44);
                X.QueryPointer(root, (err, pointer) => {
                    // always restore the shared pointer position
                    X.WarpPointer(0, root, 0, 0, 0, 0, before.rootX, before.rootY);
                    assert.ifError(err);
                    assert.strictEqual(pointer.rootX, 33);
                    assert.strictEqual(pointer.rootY, 44);
                    done();
                });
            });
        });
    });

    describe('GrabControl', () => {
        afterEach(() => {
            // never leave this client impervious to grabs on the shared server
            xtest.GrabControl(false);
        });

        it('should turn grab imperviousness on and off without error', (t, done) => {
            xtest.GrabControl(true);
            // sync round-trip: an error for GrabControl would arrive first
            X.GetInputFocus(err => {
                assert.ifError(err);
                xtest.GrabControl(false);
                X.GetInputFocus(err => {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });

    after((t, done) => {
        X.terminate();
        X.on('end', done);
    });
});
