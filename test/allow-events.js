const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

// This test was ported from X Test Suite @ http://cgit.freedesktop.org/xorg/test/xts/

function warp_pointer(X, wid, x, y, cb) {
    X.QueryPointer(wid, (err, old_pointer) => {
        if (err) {
            return cb(err);
        }

        X.WarpPointer(0,
                      wid,
                      0,
                      0,
                      0,
                      0,
                      x,
                      y);

        X.QueryPointer(wid, (err, new_pointer) => {
            if (err) {
                return cb(err);
            }

            cb(undefined, {
                old_x : old_pointer.childX,
                old_y : old_pointer.childY,
                new_x : new_pointer.childX,
                new_y : new_pointer.childY
            });
        });
    });
}

function is_pointer_frozen(X, wid, cb) {
    warp_pointer(X, wid, 0, 0, err => {
        if (err) {
            return cb(err);
        }

        warp_pointer(X, wid, 1, 1, (err, data) => {
            if (err) {
                return cb(err);
            }

            cb(undefined, data.old_x === data.new_x);
        });
    });
}

describe('AllowEvents', () => {
    let X, screen, root, wid;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            screen = dpy.screen[0];
            root = screen.root;
            wid = X.AllocID();
            X.CreateWindow(wid,
                           root,
                           0,
                           0,
                           screen.pixel_width,
                           screen.pixel_height);
            X.MapWindow(wid);
            done();
        });

        client.on('error', err => {
            console.error('Error : ', err);
        });
    });

    it('if pointer is frozen by the client calling AllowEvents with AsyncPointer should resume the processing', function(t, done) {
        X.GrabPointer(
            wid,
            false,
            x11.eventMask.PointerMotion,
            0, // sync
            1, // async
            0, // None
            0, // None
            0
        );

        is_pointer_frozen(X, wid, (err, frozen) => {
            should.not.exist(err);
            frozen.should.equal(true);
            X.AllowEvents(0, 0);
            is_pointer_frozen(X, wid, (err, frozen) => {
                should.not.exist(err);
                frozen.should.equal(false);
                done();
            });
        });
    });

    after(function(t, done) {
        // This test grabs the pointer and never released it, and its client
        // stayed open for the rest of the run — so every later suite's
        // pointer events went to this connection instead of theirs. Nothing
        // noticed until XI2 device events arrived, because a grab redirects
        // those and leaves raw events alone: raw motion kept working while
        // ordinary motion vanished, in this file's absence and not otherwise.
        X.UngrabPointer(0);
        X.DestroyWindow(wid);
        X.terminate();
        X.on('end', done);
    });
});
