var x11 = require('../lib');
var should = require('should');

describe('requiring an X11 extension on same connection', function() {
    before(function(done) {
        var self = this;
        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X = dpy.client;
            done();
        });

        client.on('error', function (err) {
            console.error('Error : ', err);
        });
    });

    it('should be cached', function(done) {
        var self = this;
        this.X.require('xtest', function(err, randr) {
            should.not.exist(err);
            self.X.require('xtest', function(err, randr1) {
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
