const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('Window subtree requests', () => {

  let display;
  let X;
  let parent;

  beforeEach(done => {
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

  afterEach(done => {
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

  it('MapSubwindows should make children viewable', done => {
      const children = createChildren(2);
      X.MapSubwindows(parent);
      X.GetWindowAttributes(children[1], (err, attrs) => {
          should.not.exist(err);
          attrs.mapState.should.equal(2); // Viewable
          done();
      });
  });

  it('UnmapSubwindows should unmap children', done => {
      const children = createChildren(2);
      X.MapSubwindows(parent);
      X.UnmapSubwindows(parent);
      X.GetWindowAttributes(children[0], (err, attrs) => {
          should.not.exist(err);
          attrs.mapState.should.equal(0); // Unmapped
          done();
      });
  });

  it('DestroySubwindows should remove all children', done => {
      createChildren(3);
      X.DestroySubwindows(parent);
      X.QueryTree(parent, (err, tree) => {
          should.not.exist(err);
          tree.children.length.should.equal(0);
          done();
      });
  });

  it('CirculateWindow RaiseLowest should raise lowest occluded child', done => {
      // overlapping children: QueryTree returns bottom-to-top stacking order
      const children = createChildren(2);
      X.MapSubwindows(parent);
      X.CirculateWindow(parent, 0); // RaiseLowest
      X.QueryTree(parent, (err, tree) => {
          should.not.exist(err);
          assert.deepEqual(tree.children, [children[1], children[0]]);
          done();
      });
  });
});
