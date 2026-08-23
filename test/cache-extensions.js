const x11 = require('../lib');
const should = require('should');
const sinon = require('sinon');

// No server has this, so QueryExtension always answers present = 0.
const ABSENT = 'NoSuchExtension-node-x11';

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

    it('should not re-ask the server for an extension it already queried', function(done) {
        const self = this;
        this.X.QueryExtension('XTEST', (err, first) => {
            should.not.exist(err);
            const spy = sinon.spy(self.X.pack_stream, 'put');
            self.X.QueryExtension('XTEST', (err, second) => {
                should.not.exist(err);
                second.majorOpcode.should.equal(first.majorOpcode);
                sinon.assert.notCalled(spy);
                spy.restore();
                done();
            });
        });
    });

    // The reason this cache exists: require() remembers only the extensions it
    // resolved, so a client that keeps probing for a missing one used to put a
    // QueryExtension on the wire every single time.
    it('should not re-ask for an extension the server does not have', function(done) {
        const self = this;
        this.X.QueryExtension(ABSENT, (err, first) => {
            should.not.exist(err);
            first.present.should.equal(0);
            const spy = sinon.spy(self.X.pack_stream, 'put');
            self.X.QueryExtension(ABSENT, (err, second) => {
                should.not.exist(err);
                second.present.should.equal(0);
                sinon.assert.notCalled(spy);
                spy.restore();
                done();
            });
        });
    });

    it('should keep a failing require() off the wire after the first try', function(done) {
        const self = this;
        this.X.require('dri3', () => {
            // Whether this server has DRI3 or not, asking again is free.
            const spy = sinon.spy(self.X.pack_stream, 'put');
            self.X.require('dri3', () => {
                sinon.assert.notCalled(spy);
                spy.restore();
                done();
            });
        });
    });

    // requireExt() hangs the extension's own methods off the reply object it
    // is handed, so handing out the cached one would let it be decorated once
    // and then reused in that state.
    it('should hand out a fresh reply object each time', function(done) {
        const self = this;
        this.X.QueryExtension('XTEST', (err, first) => {
            should.not.exist(err);
            first.scribble = 'mutated';
            self.X.QueryExtension('XTEST', (err, second) => {
                should.not.exist(err);
                second.should.not.equal(first);
                should.not.exist(second.scribble);
                done();
            });
        });
    });

    after(function(done) {
        this.X.terminate();
        this.X.on('end', done);
    });
});
