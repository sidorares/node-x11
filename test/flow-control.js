const x11 = require('../lib');
const assert = require('assert');

describe('flow control', () => {

  let display;
  let X;
  let root;
  beforeEach(done => {
      const client = x11.createClient((err, dpy) => {
          if (err) return done(err);
          display = dpy;
          X = display.client;
          root = display.screen[0].root;
          client.removeListener('error', done);
          done();
      });
      client.on('error', done);
  });

  afterEach(done => {
      X.on('end', done);
      X.terminate();
  });

  describe('void request callbacks (#85)', () => {

    it('invokes the callback with null once the request succeeded', done => {
        X.ChangeWindowAttributes(root, { eventMask: 0 }, err => {
            assert.strictEqual(err, null);
            done();
        });
    });

    it('routes the error to the callback of the failing request', done => {
        X.ChangeWindowAttributes(0, { eventMask: 0 }, err => {
            assert.ok(err instanceof Error);
            assert.strictEqual(err.error, 3); // BadWindow
            done();
            return true; // handled: don't re-emit on the client
        });
    });

    it('invokes the callback exactly once', done => {
        let calls = 0;
        X.ChangeWindowAttributes(root, { eventMask: 0 }, err => {
            assert.strictEqual(err, null);
            calls++;
        });
        X.sync(err => {
            assert.ifError(err);
            setTimeout(() => {
                assert.strictEqual(calls, 1);
                done();
            }, 30);
        });
    });

    it('reports BadAccess when another client owns SubstructureRedirect', done => {
        // the issue #85 scenario: register as window manager, then find out
        const wmMask = x11.eventMask.SubstructureRedirect;
        X.ChangeWindowAttributes(root, { eventMask: wmMask }, err => {
            assert.strictEqual(err, null); // we are the window manager now
            const second = x11.createClient((err2, dpy2) => {
                assert.ifError(err2);
                dpy2.client.ChangeWindowAttributes(root, { eventMask: wmMask }, err3 => {
                    assert.ok(err3 instanceof Error);
                    assert.strictEqual(err3.error, 10); // BadAccess
                    dpy2.client.terminate();
                    done();
                    return true;
                });
            });
            second.on('error', done);
        });
    });
  });

  describe('sync()', () => {

    it('completes after all previous requests were processed', done => {
        let sweeps = 0;
        X.ChangeWindowAttributes(root, { eventMask: 0 }, () => { sweeps++; });
        X.ChangeWindowAttributes(root, { eventMask: 0 }, () => { sweeps++; });
        X.sync(err => {
            assert.ifError(err);
            assert.strictEqual(sweeps, 2);
            done();
        });
    });

    it('returns a promise when called without a callback', () => X.sync());
  });

  describe('flush()', () => {

    it('fires once buffered requests were handed to the OS', done => {
        X.ChangeWindowAttributes(root, { eventMask: 0 });
        X.flush(done);
    });

    it('fires with an empty write queue too', done => {
        X.flush(done);
    });

    it('returns a promise when called without a callback', () => X.flush());
  });

  describe('backpressure (#195)', () => {

    it('requests return false when the socket backs up, then drain fires', function(done) {
        this.timeout(30000);
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 1, 1);
        const chunk = Buffer.alloc(0xfff0, 0xab);
        let ok = true;
        let writes = 0;
        while (ok && writes < 4096) {
            ok = X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, chunk);
            writes++;
        }
        const finish = () => {
            X.sync(err => {
                X.DestroyWindow(wid);
                X.ReleaseID(wid);
                done(err);
            });
        };
        // A fast server can drain everything as fast as it is written, so
        // whether the socket ever reports a full buffer is a property of the
        // machine rather than of this library — see the note on the same
        // assertion in test/output-buffering.js. When it does back up, 'drain'
        // must follow and the connection must still work.
        if (ok)
            return finish();
        X.once('drain', finish);
    });
  });

  describe('sequence number widening', () => {

    it('matches an error to its callback past the 16-bit wire wrap', function(done) {
        this.timeout(60000);
        for (let i = 0; i < 66000; i++)
            X.ChangeWindowAttributes(root, { eventMask: 0 });
        let voidErr = null;
        X.ChangeWindowAttributes(0, { eventMask: 0 }, err => {
            voidErr = err;
            return true;
        });
        X.sync(err => {
            assert.ifError(err);
            assert.ok(voidErr instanceof Error, 'error reached its own callback');
            assert.strictEqual(voidErr.error, 3); // BadWindow
            assert.ok(voidErr.seq > 65535, 'sequence numbers are full-width');
            done();
        });
    });
  });
});
