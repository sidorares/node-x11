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

        client.on('error', function (err) {
            console.error('Error : ', err);
        });
    });

    it('should ResizeWindow correctly to 200x300 pixels', function(done) {
        var self = this;
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.height.should.equal(300);
            ev.width.should.equal(200);
            done();
        });
        this.X.ResizeWindow(this.wid, 200, 300);
    });

    it('should MoveWindow correctly to x: 100, y: 150 pixels', function(done) {
        var self = this;
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.x.should.equal(100);
            ev.y.should.equal(150);
            done();
        });
        this.X.MoveWindow(this.wid, 100, 150);
    });

    it('should MoveResizeWindow correctly to x: 200, y: 250 and 500x100 pixels', function(done) {
        var self = this;
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.x.should.equal(200);
            ev.y.should.equal(250);
            ev.height.should.equal(100);
            ev.width.should.equal(500);
            done();
        });
        this.X.MoveResizeWindow(this.wid, 200, 250, 500, 100);
    });

    it('should RaiseWindow correctly', function(done) {
        var self = this;
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.aboveSibling.should.equal(self.wid_helper);
            done();
        });
        this.X.RaiseWindow(this.wid);
    });

    it('should LowerWindow correctly', function(done) {
        var self = this;
        this.X.once('event', function(ev) {
            ev.type.should.equal(22); /* ConfigureNotify */
            ev.aboveSibling.should.equal(0); /* 0 -> no window below this */
            done();
        });
        this.X.LowerWindow(this.wid);
    });

    it('should ignore invalid mask values', function(done) {
        this.X.once('event', function(ev) {
            ev.x.should.equal(0);
            done();
        });

        this.X.ConfigureWindow(this.wid, { foo : 3, x : 0 }, function(err) {
            console.log(err);
        });
    });

    after(function(done) {
        this.X.removeAllListeners('event');
        this.X.DestroyWindow(this.wid);
        this.X.DestroyWindow(this.wid_helper);
        this.X.on('end', done);
        this.X.terminate();
    });
});
