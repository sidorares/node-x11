var x11 = require('../lib');
var should = require('should');

describe('CreateGC', function() {
    before(function(done) {
        var self = this;
        this.client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.white = dpy.screen[0].white_pixel;
            self.black = dpy.screen[0].black_pixel;
            self.wid = self.X.AllocID();
            self.X.CreateWindow(self.wid, self.root, 0, 0, 1, 1); // 1x1 pixel window
            self.X.MapWindow(self.wid);
            self.X.QueryTree(self.root, function(err, list) {
                should.not.exist(err);
                list.children.indexOf(self.wid).should.not.equal(-1);
                done();
            });
        });
    });

    it('should create a Graphic Context correctly', function() {
        var self = this;
        this.client.on('error', function(err) {
            should.not.exist(err);
        });

        this.gc = this.X.AllocID();
        this.X.CreateGC(this.gc,
                        this.wid,
                        {
                            foreground: this.black,
                            background: this.white,
                            lineStyle : 0
                        }
        );
        
        this.X.ChangeGC(this.gc,
                        {
                            foreground: 0xffff00,
                            background: 0x0000ff,
                            lineStyle : 2
                        }
        );
    });

    after(function(done) {
        this.X.DestroyWindow(this.wid);
        this.X.on('end', done);
        this.X.terminate();
    });
});
