const x11 = require('../lib');
const should = require('should');

describe('XINERAMA extension', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.root = dpy.screen[0].root;
            self.X.require('xinerama', (err, ext) => {
                should.not.exist(err);
                self.xinerama = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('QueryVersion should report at least 1.1', function() {
        this.xinerama.major.should.be.aboveOrEqual(1);
        this.xinerama.minor.should.be.aboveOrEqual(1);
    });

    it('GetState should return a 0/1 flag for the root window', function(done) {
        this.xinerama.GetState(this.root, (err, state) => {
            should.not.exist(err);
            state.should.be.within(0, 1);
            done();
        });
    });

    it('GetScreenCount should return a number for the root window', function(done) {
        this.xinerama.GetScreenCount(this.root, (err, count) => {
            should.not.exist(err);
            count.should.be.a.Number();
            count.should.be.aboveOrEqual(0);
            done();
        });
    });

    it('IsActive and QueryScreens should agree with each other', function(done) {
        const self = this;
        this.xinerama.IsActive((err, state) => {
            should.not.exist(err);
            self.xinerama.QueryScreens((err, screens) => {
                should.not.exist(err);
                screens.should.be.an.Array();
                if (state === 0) {
                    screens.length.should.equal(0);
                } else {
                    screens.length.should.be.above(0);
                    screens[0].width.should.be.above(0);
                    screens[0].height.should.be.above(0);
                }
                done();
            });
        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
