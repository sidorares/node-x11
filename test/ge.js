const x11 = require('../lib');
const should = require('should');

describe('Generic Event extension', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.X.require('ge', (err, ext) => {
                should.not.exist(err);
                self.ge = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('QueryVersion should report at least 1.0', function() {
        this.ge.major.should.be.aboveOrEqual(1);
        this.ge.minor.should.be.aboveOrEqual(0);
    });

    it('explicit QueryVersion round-trip should agree with negotiated version', function(done) {
        const self = this;
        this.ge.QueryVersion(1, 0, (err, vers) => {
            should.not.exist(err);
            vers[0].should.equal(self.ge.major);
            vers[1].should.equal(self.ge.minor);
            done();
        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
