var x11 = require('../lib');
var should = require('should');

describe('ConfigureRequest', function() {
    before(function(done) {
        var self = this;
        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.wid = self.X.AllocID();
            /* self.X acts like a WM */
            self.X.ChangeWindowAttributes(self.root, { eventMask: x11.eventMask.SubstructureRedirect });
            self.X.CreateWindow(self.wid, self.root, 0, 0, 1, 1); // 1x1 pixel window
            self.X.QueryTree(self.root, function(err, list) {
                should.not.exist(err);
                list.children.indexOf(self.wid).should.not.equal(-1);
                done();
            });
        });

        client.on('error', function (err) {
            console.error('Error : ', err);
        });
    });

    it('should be emitted to the WM if this.wid is configured by a client', function(done) {
        var self = this;
        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X.once('event', function(ev) {
                ev.name.should.equal('ConfigureRequest');
                ev.x.should.equal(0);
                ev.y.should.equal(20);
                ev.width.should.equal(200);
                ev.height.should.equal(300);
                ev.wid.should.equal(self.wid);
                done();
            });

            var X = dpy.client;
            X.MoveResizeWindow(self.wid, 0, 20, 200, 300);
        });

        client.on('error', done);
    });

    after(function(done) {
        this.X.DestroyWindow(this.wid);
        this.X.on('end', done);
        this.X.terminate();
    });
});
