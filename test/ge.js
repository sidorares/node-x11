const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');

describe('Generic Event extension', () => {
    let X, ge;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            X.require('ge', (err, ext) => {
                should.not.exist(err);
                ge = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('QueryVersion should report at least 1.0', function() {
        ge.major.should.be.aboveOrEqual(1);
        ge.minor.should.be.aboveOrEqual(0);
    });

    it('explicit QueryVersion round-trip should agree with negotiated version', function(t, done) {
        ge.QueryVersion(1, 0, (err, vers) => {
            should.not.exist(err);
            vers[0].should.equal(ge.major);
            vers[1].should.equal(ge.minor);
            done();
        });
    });

    after(function(t, done) {
        X.terminate();
        X.on('end', done);
    });
});
