const x11 = require('../lib');
const assert = require('assert');

// The request dispatcher decides whether the trailing argument is a callback.
// It used to test `callback.constructor.name != 'Function'`, which rejected
// every callable that is not a plain function — an `async` callback was
// silently dropped, the request was still sent, and nothing ever fired.

describe('request callbacks', () => {

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

  describe('any callable is accepted', () => {

    it('an async callback receives a reply', done => {
        X.GetGeometry(root, async (err, geom) => {
            assert.ifError(err);
            assert.ok(geom.width > 0);
            done();
        });
    });

    it('an async callback receives a void request\'s confirmation (#85)', done => {
        X.ChangeWindowAttributes(root, { eventMask: 0 }, async err => {
            assert.strictEqual(err, null);
            done();
        });
    });

    it('an async callback receives an X error', done => {
        X.GetGeometry(0, async err => {
            assert.ok(err instanceof Error);
            assert.strictEqual(err.error, 9); // BadDrawable
            done();
        });
    });

    it('a bound function receives a reply', done => {
        function handler(err, geom) {
            assert.ifError(err);
            assert.strictEqual(this.tag, 'bound');
            assert.ok(geom.width > 0);
            done();
        }
        X.GetGeometry(root, handler.bind({ tag: 'bound' }));
    });

    it('a proxied function receives a reply', done => {
        const calls = [];
        const spy = new Proxy((err, geom) => {
            calls.push(geom.width);
        }, {});
        X.GetGeometry(root, spy);
        X.sync(() => {
            assert.strictEqual(calls.length, 1);
            done();
        });
    });
  });

  describe('non-callables are still just arguments', () => {

    it('does not treat a trailing string as a callback', done => {
        // ChangeProperty's last argument is the property value
        X.ChangeProperty(0, root, X.atoms.WM_NAME, X.atoms.STRING, 8, 'callback-test');
        X.GetProperty(0, root, X.atoms.WM_NAME, X.atoms.STRING, 0, 100, (err, prop) => {
            assert.ifError(err);
            assert.strictEqual(prop.data.toString(), 'callback-test');
            done();
        });
    });

    it('does not treat a trailing object as a callback', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0, { eventMask: 0 });
        X.GetGeometry(wid, (err, geom) => {
            assert.ifError(err);
            assert.strictEqual(geom.width, 10);
            X.DestroyWindow(wid);
            done();
        });
    });

    it('does not throw on a trailing object with no prototype', done => {
        // `Object.create(null)` has no `.constructor`; reading its name threw
        assert.doesNotThrow(() => X.GetGeometry(root, Object.create(null)));
        X.sync(err => {
            assert.ifError(err);
            done();
        });
    });
  });

  describe('sequence numbers stay in step', () => {

    it('a request whose callback slot holds a non-callable still gets its reply', done => {
        // the dropped-callback path must not disturb the request stream
        X.GetGeometry(root, 42);
        X.GetGeometry(root, (err, geom) => {
            assert.ifError(err);
            assert.ok(geom.width > 0);
            done();
        });
    });
  });
});
