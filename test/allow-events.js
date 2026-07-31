const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

// This test was ported from X Test Suite @ http://cgit.freedesktop.org/xorg/test/xts/

function warp_pointer(wid, x, y, cb) {
    const self = this;
    this.X.QueryPointer(wid, (err, old_pointer) => {
        if (err) {
            return cb(err);
        }

        self.X.WarpPointer(0,
                           wid,
                           0,
                           0,
                           0,
                           0,
                           x,
                           y);

        self.X.QueryPointer(wid, (err, new_pointer) => {
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

function is_pointer_frozen(cb) {
    const self = this;
    warp_pointer.call(this, this.wid, 0, 0, err => {
        if (err) {
            return cb(err);
        }

        warp_pointer.call(self, self.wid, 1, 1, (err, data) => {
            if (err) {
                return cb(err);
            }

            cb(undefined, data.old_x === data.new_x);
        });
    });
}

describe('AllowEvents', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.screen = dpy.screen[0];
            self.root = self.screen.root;
            self.wid = self.X.AllocID();
            self.X.CreateWindow(self.wid,
                                self.root,
                                0,
                                0,
                                self.screen.pixel_width,
                                self.screen.pixel_height);
            self.X.MapWindow(self.wid);
            done();
        });

        client.on('error', err => {
            console.error('Error : ', err);
        });
    });

    it('if pointer is frozen by the client calling AllowEvents with AsyncPointer should resume the processing', function(done) {
        const self = this;
        this.X.GrabPointer(
            this.wid,
            false,
            x11.eventMask.PointerMotion,
            0, // sync
            1, // async
            0, // None
            0, // None
            0
        );

        is_pointer_frozen.call(this, (err, frozen) => {
            should.not.exist(err);
            frozen.should.equal(true);
            self.X.AllowEvents(0, 0);
            is_pointer_frozen.call(self, (err, frozen) => {
                should.not.exist(err);
                frozen.should.equal(false);
                done();
            });
        });
    });

    after(function(done) {
        // This test grabs the pointer and never released it, and its client
        // stayed open for the rest of the run — so every later suite's
        // pointer events went to this connection instead of theirs. Nothing
        // noticed until XI2 device events arrived, because a grab redirects
        // those and leaves raw events alone: raw motion kept working while
        // ordinary motion vanished, in this file's absence and not otherwise.
        this.X.UngrabPointer(0);
        this.X.DestroyWindow(this.wid);
        this.X.terminate();
        this.X.on('end', done);
    });
});
