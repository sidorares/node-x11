const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');
const assert = require('assert');
const sinon = require('sinon');
const async = require('async');

describe('Atoms and atom names cache', () => {
    let X, flushSpy;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            flushSpy = sinon.spy(X.pack_stream, 'flush');
            done();
        });

        client.on('error', done);
    });

    it('should be used directly when requesting std atoms with InternAtom', function(t, done) {
        X.InternAtom(true, 'WM_NAME', (err, atom) => {
            should.not.exist(err);
            atom.should.equal(X.atoms.WM_NAME);
            sinon.assert.notCalled(flushSpy);
            done();
        });
    });

    it('should be used directly when requesting atom names with GetAtomName', function(t, done) {
        const spy = sinon.spy(X.GetAtomName[1]);
        X.GetAtomName(52, (err, atom_name) => {
            should.not.exist(err);
            atom_name.should.equal('UNDERLINE_THICKNESS');
            sinon.assert.notCalled(flushSpy);
            done();
        });
    });

    it('should be used after the first request for non-std atoms', function(t, done) {
        X.InternAtom(false, 'My testing atom', (err, atom) => {
            should.not.exist(err);
            sinon.assert.calledOnce(flushSpy);
            async.parallel(
                [
                    cb => {
                        X.InternAtom(true, 'My testing atom', cb);
                    },
                    cb => {
                        X.GetAtomName(atom, cb);
                    }
                ],
                (err, results) => {
                    should.not.exist(err);
                    results[0].should.equal(atom);
                    results[1].should.equal('My testing atom');
                    sinon.assert.calledOnce(flushSpy);
                    done();
                }
            );
        });
    });

    it.skip('should be used after the first request for non-std atom_names', function(t, done) {
        let my_name;
        /*
         * First get an atom defined in the server greater than 68 (WM_TRANSIENT_FOR) and less than 100
         * and not already cached
         */
        let my_atom = 69;
        async.until(
            () => my_name || my_atom > 99,
            cb => {
                if (X.atom_names[my_atom]) {
                    return cb();
                }

                X.GetAtomName(my_atom, (err, name) => {
                    should.not.exist(err);
                    if (name && name !== '') {
                        my_name = name;
                    } else {
                        ++ my_atom;
                    }

                    cb();
                });
            },
            err => {
                should.not.exist(err);
                should.exist(my_name);
                flushSpy.resetHistory();
                X.InternAtom(true, my_name, (err, atom) => {
                    should.not.exist(err);
                    my_atom.should.equal(atom);
                    sinon.assert.notCalled(flushSpy);
                    Object.keys(X.pending_atoms).should.be.empty;
                    done();
                });
            }
        );
    });

    after(function(t, done) {
        X.pack_stream.flush.restore();
        X.terminate();
        X.on('end', done);
    });
});
