const x11 = require('../lib');
const should = require('should');

describe('XC-MISC extension', () => {
    let display;
    let X;
    let xcmisc;

    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            X.require('xc-misc', (err, ext) => {
                should.not.exist(err);
                xcmisc = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after(done => {
        X.terminate();
        X.on('end', done);
    });

    it('GetVersion should return major 1, minor >= 1', done => {
        xcmisc.GetVersion(1, 1, (err, version) => {
            should.not.exist(err);
            version[0].should.equal(1);
            version[1].should.be.aboveOrEqual(1);
            done();
        });
    });

    it('auto GetVersion should have set ext.major/ext.minor', () => {
        xcmisc.major.should.equal(1);
        xcmisc.minor.should.be.aboveOrEqual(1);
    });

    it('GetXIDRange should return a non-empty id range', done => {
        xcmisc.GetXIDRange((err, range) => {
            should.not.exist(err);
            range.startId.should.be.above(0);
            range.count.should.be.above(0);
            done();
        });
    });

    it('GetXIDList should return the requested number of ids', done => {
        xcmisc.GetXIDList(5, (err, ids) => {
            should.not.exist(err);
            ids.should.be.an.Array();
            ids.should.have.length(5);
            ids.forEach(id => {
                id.should.be.a.Number();
                id.should.be.above(0);
            });
            done();
        });
    });
});
