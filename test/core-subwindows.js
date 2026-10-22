const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Window subtree requests', () => {

  let display;
  let X;
  let parent;

  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
          if (err)
              return done(err);
          display = dpy;
          X = display.client;
          parent = X.AllocID();
          X.CreateWindow(parent, display.screen[0].root, 0, 0, 100, 100);
          X.MapWindow(parent);
          done();
      });
      client.on('error', done);
  });

  afterEach((t, done) => {
      X.DestroyWindow(parent);
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  function createChildren(n) {
      const wids = [];
      for (let i = 0; i < n; ++i) {
          const wid = X.AllocID();
          X.CreateWindow(wid, parent, 0, 0, 50, 50);
          wids.push(wid);
      }
      return wids;
  }

  it('MapSubwindows should make children viewable', (t, done) => {
      const children = createChildren(2);
      X.MapSubwindows(parent);
      X.GetWindowAttributes(children[1], (err, attrs) => {
          assert.ifError(err);
          assert.strictEqual(attrs.mapState, 2); // Viewable
          done();
      });
  });

  it('UnmapSubwindows should unmap children', (t, done) => {
      const children = createChildren(2);
      X.MapSubwindows(parent);
      X.UnmapSubwindows(parent);
      X.GetWindowAttributes(children[0], (err, attrs) => {
          assert.ifError(err);
          assert.strictEqual(attrs.mapState, 0); // Unmapped
          done();
      });
  });

  it('DestroySubwindows should remove all children', (t, done) => {
      createChildren(3);
      X.DestroySubwindows(parent);
      X.QueryTree(parent, (err, tree) => {
          assert.ifError(err);
          assert.strictEqual(tree.children.length, 0);
          done();
      });
  });

  it('CirculateWindow RaiseLowest should raise lowest occluded child', (t, done) => {
      // overlapping children: QueryTree returns bottom-to-top stacking order
      const children = createChildren(2);
      X.MapSubwindows(parent);
      X.CirculateWindow(parent, 0); // RaiseLowest
      X.QueryTree(parent, (err, tree) => {
          assert.ifError(err);
          assert.deepStrictEqual(tree.children, [children[1], children[0]]);
          done();
      });
  });
});
