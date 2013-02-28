var x11 = require('../lib');
var should = require('should');
var assert = require('assert');
var sinon = require('sinon');
var async = require('async');

describe('Atoms and atom names cache', function() {
    before(function(done) {
        var self = this;
        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X = dpy.client;
            self.spy = sinon.spy(self.X.pack_stream, 'flush');
            done();
        });

        client.on('error', done);
    });

    it('should be used directly when requesting std atoms with InternAtom', function(done) {
        var self = this;
        this.X.InternAtom(true, 'WM_NAME', function(err, atom) {
            should.not.exist(err);
            atom.should.equal(self.X.atoms.WM_NAME);
            sinon.assert.notCalled(self.spy);
            done();
        });
    });

    it('should be used directly when requesting atom names with GetAtomName', function(done) {
        var self = this;
        var spy = sinon.spy(this.X.GetAtomName[1]);
        this.X.GetAtomName(52, function(err, atom_name) {
            should.not.exist(err);
            atom_name.should.equal('UNDERLINE_THICKNESS');
            sinon.assert.notCalled(self.spy);
            done();
        });
    });

    it('should be used after the first request for non-std atoms', function(done) {
        var self = this;
        this.X.InternAtom(false, 'My testing atom', function(err, atom) {
            should.not.exist(err);
            sinon.assert.calledOnce(self.spy);
            async.parallel(
                [
                    function(cb) {
                        self.X.InternAtom(true, 'My testing atom', cb);
                    },
                    function(cb) {
                        self.X.GetAtomName(atom, cb);
                    }
                ],
                function(err, results) {
                    should.not.exist(err);
                    results[0].should.equal(atom);
                    results[1].should.equal('My testing atom');
                    sinon.assert.calledOnce(self.spy);
                    done();
                }
            );
        });
    });

    it('should be used after the first request for non-std atom_names', function(done) {
        var self = this;
        this.X.InternAtom(false, 'My testing atom', function(err, atom) {
            should.not.exist(err);
            sinon.assert.calledOnce(self.spy);
            async.parallel(
                [
                    function(cb) {
                        self.X.InternAtom(true, 'My testing atom', cb);
                    },
                    function(cb) {
                        self.X.GetAtomName(atom, cb);
                    }
                ],
                function(err, results) {
                    should.not.exist(err);
                    results[0].should.equal(atom);
                    results[1].should.equal('My testing atom');
                    sinon.assert.calledOnce(self.spy);
                    done();
                }
            );
        });
    });

    after(function(done) {
        this.X.pack_stream.flush.restore();
        this.X.terminate();
        this.X.on('end', done);
    });
});
