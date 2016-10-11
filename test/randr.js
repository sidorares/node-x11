var x11 = require('../lib');
var async = require('async');
var should = require('should');
var assert = require('assert');
var util = require('util');

describe('RANDR extension', function() {
    before(function(done) {
        var self = this;
        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X = dpy.client;
            self.screen = dpy.screen[0];
            self.root = self.screen.root;
            self.X.require('randr', function(err, ext) {
                should.not.exist(err);
                self.randr = ext;
                /* We HAVE to QueryVersion before using it. Otherwise it does not work as expected */
                self.randr.QueryVersion(1, 2, done);
            });
        });

        client.on('error', done);
    });

    it('GetScreenInfo should get same px and mm width and height as in display.screen[0]', function(done) {
        var self = this;
        this.randr.GetScreenInfo(this.root, function(err, info) {
            should.not.exist(err);
            var active_screen = info.screens[info.sizeID];
            active_screen.px_width.should.equal(self.screen.pixel_width);
            active_screen.px_height.should.equal(self.screen.pixel_height);
            active_screen.mm_width.should.equal(self.screen.mm_width);
            active_screen.mm_height.should.equal(self.screen.mm_height);
            done();
        });
    });

    it('GetScreenResources && GetOutputInfo', function(done) {
        var self = this;
        this.randr.GetScreenResources(this.root, function(err, resources) {
            should.not.exist(err);
            should.exist(resources);
            async.each(
                resources.outputs,
                function(output, cb) {
                    self.randr.GetOutputInfo(output, 0, function(err, info) {
                        should.not.exist(err);
                        should.exist(info);
                        cb();
                    });
                },
                done
            );

        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
