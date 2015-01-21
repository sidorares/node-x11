var x11 = require('../lib');
var should = require('should');
var assert = require('assert');

// This test was ported from X Test Suite @ http://cgit.freedesktop.org/xorg/test/xts/

function warp_pointer(wid, x, y, cb) {
    var self = this;
    this.X.QueryPointer(wid, function(err, old_pointer) {
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

        self.X.QueryPointer(wid, function(err, new_pointer) {
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
    var self = this;
    warp_pointer.call(this, this.wid, 0, 0, function(err) {
        if (err) {
            return cb(err);
        }

        warp_pointer.call(self, self.wid, 1, 1, function(err, data) {
            if (err) {
                return cb(err);
            }

            cb(undefined, data.old_x === data.new_x);
        });
    });
}

describe('AllowEvents', function() {
    before(function(done) {
        var self = this;
        var client = x11.createClient(function(err, dpy) {
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

        client.on('error', function (err) {
            console.error('Error : ', err);
        });
    });

    it('if pointer is frozen by the client calling AllowEvents with AsyncPointer should resume the processing', function(done) {
        var self = this;
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

        is_pointer_frozen.call(this, function(err, frozen) {
            should.not.exist(err);
            frozen.should.equal(true);
            self.X.AllowEvents(0, 0);
            is_pointer_frozen.call(self, function(err, frozen) {
                should.not.exist(err);
                frozen.should.equal(false);
                done();
            });
        });
    });
});
