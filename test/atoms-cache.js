const { describe, it, before, after, mock } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Atoms and atom names cache', () => {
    let X, flush;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            X = dpy.client;
            flush = mock.method(X.pack_stream, 'flush');
            done();
        });

        client.on('error', done);
    });

    it('should be used directly when requesting std atoms with InternAtom', function(t, done) {
        X.InternAtom(true, 'WM_NAME', (err, atom) => {
            assert.ifError(err);
            assert.strictEqual(atom, X.atoms.WM_NAME);
            assert.strictEqual(flush.mock.callCount(), 0);
            done();
        });
    });

    it('should be used directly when requesting atom names with GetAtomName', function(t, done) {
        X.GetAtomName(52, (err, atom_name) => {
            assert.ifError(err);
            assert.strictEqual(atom_name, 'UNDERLINE_THICKNESS');
            assert.strictEqual(flush.mock.callCount(), 0);
            done();
        });
    });

    it('should be used after the first request for non-std atoms', function(t, done) {
        X.InternAtom(false, 'My testing atom', (err, atom) => {
            assert.ifError(err);
            assert.strictEqual(flush.mock.callCount(), 1);
            // both answered from the cache: nothing more reaches the server
            X.InternAtom(true, 'My testing atom', (err, cached) => {
                assert.ifError(err);
                assert.strictEqual(cached, atom);
                X.GetAtomName(atom, (err, name) => {
                    assert.ifError(err);
                    assert.strictEqual(name, 'My testing atom');
                    assert.strictEqual(flush.mock.callCount(), 1);
                    done();
                });
            });
        });
    });

    it.skip('should be used after the first request for non-std atom_names', function(t, done) {
        let my_name;
        /*
         * First get an atom defined in the server greater than 68 (WM_TRANSIENT_FOR) and less than 100
         * and not already cached
         */
        let my_atom = 69;
        const findAtom = () => {
            if (my_name || my_atom > 99)
                return lookUp();
            if (X.atom_names[my_atom]) {
                ++ my_atom;
                return findAtom();
            }

            X.GetAtomName(my_atom, (err, name) => {
                assert.ifError(err);
                if (name && name !== '') {
                    my_name = name;
                } else {
                    ++ my_atom;
                }

                findAtom();
            });
        };
        const lookUp = () => {
            assert.ok(my_name != null);
            flush.mock.resetCalls();
            X.InternAtom(true, my_name, (err, atom) => {
                assert.ifError(err);
                assert.strictEqual(my_atom, atom);
                assert.strictEqual(flush.mock.callCount(), 0);
                assert.strictEqual(Object.keys(X.pending_atoms).length, 0);
                done();
            });
        };
        findAtom();
    });

    after(function(t, done) {
        flush.mock.restore();
        X.terminate();
        X.on('end', done);
    });
});
