const x11 = require('../lib');
const should = require('should');

describe('requiring an X11 extension on same connection', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            done();
        });

        client.on('error', err => {
            console.error('Error : ', err);
        });
    });

    it('should be cached', function(done) {
        const self = this;
        this.X.require('xtest', (err, randr) => {
            should.not.exist(err);
            self.X.require('xtest', (err, randr1) => {
                should.not.exist(err);
                randr.should.equal(randr1);
                done();
            });
        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
