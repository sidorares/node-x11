const x11 = require('../lib');
const should = require('should');
const assert = require('assert');
const util = require('util');

describe('XTEST extension', () => {
    let display;
    let X;
    let xtest;
    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (!err) {
                display = dpy;
                X = display.client;
                X.require('xtest', (err, ext) => {
                    should.not.exist(err);
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
        it('should return version 2.2', done => {
            xtest.GetVersion(2, 2, (err, version) => {
                version.should.eql([2, 2]);
                done();
            });
        });
    });

    describe('CompareCursor', () => {
        it('should return true comparing None with a window without cursor', done => {
            const root = display.screen[0].root;
            const wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, 10, 10);
            xtest.CompareCursor(wid, xtest.Cursor.None, (err, same) => {
                X.DestroyWindow(wid);
                should.not.exist(err);
                same.should.equal(true);
                done();
            });
        });

        it('should match the cursor set on a window and mismatch None', done => {
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
                should.not.exist(err);
                same.should.equal(true);
                xtest.CompareCursor(wid, xtest.Cursor.None, (err, same) => {
                    X.DestroyWindow(wid);
                    X.FreeCursor(cid);
                    should.not.exist(err);
                    same.should.equal(false);
                    done();
                });
            });
        });
    });

    describe('FakeInput', () => {
        it('MotionNotify should move the pointer to the requested position', done => {
            const root = display.screen[0].root;
            X.QueryPointer(root, (err, before) => {
                should.not.exist(err);
                // detail 0 = absolute, root 0 = current screen
                xtest.FakeInput(xtest.MotionNotify, 0, 0, 0, 33, 44);
                X.QueryPointer(root, (err, pointer) => {
                    // always restore the shared pointer position
                    X.WarpPointer(0, root, 0, 0, 0, 0, before.rootX, before.rootY);
                    should.not.exist(err);
                    pointer.rootX.should.equal(33);
                    pointer.rootY.should.equal(44);
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

        it('should turn grab imperviousness on and off without error', done => {
            xtest.GrabControl(true);
            // sync round-trip: an error for GrabControl would arrive first
            X.GetInputFocus(err => {
                should.not.exist(err);
                xtest.GrabControl(false);
                X.GetInputFocus(err => {
                    should.not.exist(err);
                    done();
                });
            });
        });
    });

    after(done => {
        X.terminate();
        X.on('end', done);
    });
});
