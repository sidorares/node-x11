const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('CreateWindow request', () => {

  // keep for a while: this snippet helps to track global leak
  //global.__defineSetter__('a', function(v) {
  //    console.trace();
  //});

  let display;
  let X;
  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
          if (!err) {
              display = dpy;
              X = display.client;
          }

          done(err);
      });
      client.on('error', done);
  });

  afterEach((t, done) => {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('should exist as client member', (t, done) => {
      assert.ok(X.CreateWindow != null);
      assert.strictEqual(typeof X.CreateWindow, 'function');
      done();
  });

  it('result should present in windows tree', (t, done) => {
      const wid = X.AllocID();
      X.CreateWindow(wid, display.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
      X.QueryTree(display.screen[0].root, (err, list) => {
          if (err)
              done(err);
          const pos = list.children.indexOf(wid);
          assert.notStrictEqual(pos, -1, 'can\'t find created window');
          done();
      });
  });

  it('should work with any kind of attributes too', (t, done) => {
      const wid = X.AllocID();
      X.CreateWindow(wid, display.screen[0].root, 0, 0, 1, 1, 0, 0, 0, 0, { overrideRedirect : true }); // 1x1 pixel window
      X.QueryTree(display.screen[0].root, (err, list) => {
          assert.ifError(err);
          assert.ok(list.children.includes(wid));
          done();
      });
  });

  it('should emit CreateNotify event when', (t, done) => {
      const wid = X.AllocID();
      const root = display.screen[0].root;
      X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.SubstructureNotify });
      X.on('event', ev => {
        switch (ev.name) {
          case 'CreateNotify':
            assert.strictEqual(ev.parent, root);
            assert.strictEqual(ev.wid, wid);
            assert.strictEqual(ev.x, 0);
            assert.strictEqual(ev.y, 0);
            assert.strictEqual(ev.width, 1);
            assert.strictEqual(ev.height, 1);
            assert.strictEqual(ev.borderWidth, 0);
            assert.strictEqual(ev.overrideRedirect, false);
          break;

          case 'MapNotify':
            assert.strictEqual(ev.event, root);
            assert.strictEqual(ev.wid, wid);
            assert.strictEqual(ev.overrideRedirect, false);
            X.UnmapWindow(wid);
          break;

          case 'UnmapNotify':
            assert.strictEqual(ev.event, root);
            assert.strictEqual(ev.wid, wid);
            assert.strictEqual(ev.fromConfigure, false);
            X.DestroyWindow(wid);
          break;

          case 'DestroyNotify':
            assert.strictEqual(ev.event, root);
            assert.strictEqual(ev.wid, wid);
            done();
          break;
        }
      });

      X.CreateWindow(wid, root, 0, 0, 1, 1); // 1x1 pixel window
      X.MapWindow(wid);
  })
});
