var x11 = require('../lib');
var should = require('should');
var assert = require('assert');
var util = require('util');

describe('ConfigureWindow', function() {
    before(function(done) {
        var self = this;
        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X = dpy.client;
            self.wid = self.X.AllocID();
            self.wid_helper = self.X.AllocID();
            self.X.CreateWindow(self.wid, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
            self.X.CreateWindow(self.wid_helper, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
            self.X.QueryTree(dpy.screen[0].root, function(err, list) {
                should.not.exist(err);
                list.children.indexOf(self.wid).should.not.equal(-1);
                list.children.indexOf(self.wid_helper).should.not.equal(-1);
                self.X.ChangeWindowAttributes(self.wid, { eventMask: x11.eventMask.StructureNotify });
                done();
            });
        });

        client.on('error', done);
    });

    it('should ResizeWindow correctly to 200x300 pixels', function(done) {
        var self = this;
        this.X.ResizeWindow(this.wid, 200, 300);
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.height.should.equal(300);
            ev.width.should.equal(200);
            done();
        });
    });

    it('should MoveWindow correctly to x: 100, y: 150 pixels', function(done) {
        var self = this;
        this.X.MoveWindow(this.wid, 100, 150);
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.x.should.equal(100);
            ev.y.should.equal(150);
            done();
        });
    });

    it('should MoveResizeWindow correctly to x: 200, y: 250 and 500x100 pixels', function(done) {
        var self = this;
        this.X.MoveResizeWindow(this.wid, 200, 250, 500, 100);
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.x.should.equal(200);
            ev.y.should.equal(250);
            ev.height.should.equal(100);
            ev.width.should.equal(500);
            done();
        });
    });

    it('should RaiseWindow correctly', function(done) {
        var self = this;
        this.X.RaiseWindow(this.wid);
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.aboveSibling.should.equal(self.wid_helper);
            done();
        });
    });

    after(function(done) {
        this.X.DestroyWindow(this.wid);
        this.X.DestroyWindow(this.wid_helper);
        this.X.terminate();
        this.X.on('end', done);
    });
});
