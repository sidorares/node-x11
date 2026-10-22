const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Core events (newly generated parsers)', () => {

  let display;
  let X;
  let root;
  let white;
  let black;
  let depth;

  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
          if (err)
              return done(err);
          display = dpy;
          X = display.client;
          root = display.screen[0].root;
          white = display.screen[0].white_pixel;
          black = display.screen[0].black_pixel;
          depth = display.screen[0].root_depth;
          done();
      });
      client.on('error', done);
  });

  afterEach((t, done) => {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  function onEvent(name, cb) {
      const listener = ev => {
          if (ev.name === name) {
              X.removeListener('event', listener);
              cb(ev);
          }
      };
      X.on('event', listener);
  }

  it('VisibilityNotify should fire when window becomes visible', (t, done) => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 50, 50, 0, 0, 0, 0,
          { eventMask: x11.eventMask.VisibilityChange });
      onEvent('VisibilityNotify', ev => {
          assert.strictEqual(ev.wid, wid);
          assert.strictEqual(ev.state, 0); // Unobscured
          X.DestroyWindow(wid);
          done();
      });
      X.MapWindow(wid);
  });

  it('ReparentNotify should fire on ReparentWindow', (t, done) => {
      const parent = X.AllocID();
      const child = X.AllocID();
      X.CreateWindow(parent, root, 0, 0, 100, 100);
      X.CreateWindow(child, root, 0, 0, 20, 20, 0, 0, 0, 0,
          { eventMask: x11.eventMask.StructureNotify });
      onEvent('ReparentNotify', ev => {
          assert.strictEqual(ev.event, child);
          assert.strictEqual(ev.wid, child);
          assert.strictEqual(ev.parent, parent);
          assert.strictEqual(ev.x, 5);
          assert.strictEqual(ev.y, 6);
          X.DestroyWindow(parent);
          done();
      });
      X.ReparentWindow(child, parent, 5, 6);
  });

  it('GravityNotify should fire when parent resize moves child', (t, done) => {
      const parent = X.AllocID();
      const child = X.AllocID();
      X.CreateWindow(parent, root, 0, 0, 100, 100);
      // SouthEast gravity: child follows bottom-right corner
      X.CreateWindow(child, parent, 50, 50, 20, 20, 0, 0, 0, 0,
          { winGravity: 9, eventMask: x11.eventMask.StructureNotify });
      X.MapWindow(parent);
      onEvent('GravityNotify', ev => {
          assert.strictEqual(ev.event, child);
          assert.strictEqual(ev.wid, child);
          assert.strictEqual(ev.x, 30);
          assert.strictEqual(ev.y, 30);
          X.DestroyWindow(parent);
          done();
      });
      X.ResizeWindow(parent, 80, 80);
  });

  it('NoExposure should fire for fully valid CopyArea', (t, done) => {
      const pixmap = X.AllocID();
      const dst = X.AllocID();
      const gc = X.AllocID();
      X.CreatePixmap(pixmap, root, depth, 20, 20);
      X.CreatePixmap(dst, root, depth, 20, 20);
      X.CreateGC(gc, dst, { graphicsExposures: 1, foreground: black });
      X.PolyFillRectangle(pixmap, gc, [0, 0, 20, 20]);
      onEvent('NoExposure', ev => {
          assert.strictEqual(ev.drawable, dst);
          assert.strictEqual(ev.majorOpcode, 62); // CopyArea
          X.FreeGC(gc);
          X.FreePixmap(pixmap);
          X.FreePixmap(dst);
          done();
      });
      X.CopyArea(pixmap, dst, gc, 0, 0, 0, 0, 20, 20);
  });

  it('GraphicsExposure should fire for out-of-bounds CopyArea source', (t, done) => {
      const pixmap = X.AllocID();
      const dst = X.AllocID();
      const gc = X.AllocID();
      X.CreatePixmap(pixmap, root, depth, 20, 20);
      X.CreatePixmap(dst, root, depth, 20, 20);
      X.CreateGC(gc, dst, { graphicsExposures: 1, foreground: black });
      X.PolyFillRectangle(pixmap, gc, [0, 0, 20, 20]);
      onEvent('GraphicsExposure', ev => {
          assert.strictEqual(ev.drawable, dst);
          assert.strictEqual(ev.majorOpcode, 62); // CopyArea
          X.FreeGC(gc);
          X.FreePixmap(pixmap);
          X.FreePixmap(dst);
          done();
      });
      // source region sticks out of the 20x20 pixmap - missing part is exposed
      X.CopyArea(pixmap, dst, gc, 10, 10, 0, 0, 20, 20);
  });

  it('CirculateNotify should fire on CirculateWindow', (t, done) => {
      const parent = X.AllocID();
      X.CreateWindow(parent, root, 0, 0, 100, 100, 0, 0, 0, 0,
          { eventMask: x11.eventMask.SubstructureNotify });
      const child1 = X.AllocID();
      const child2 = X.AllocID();
      X.CreateWindow(child1, parent, 0, 0, 50, 50);
      X.CreateWindow(child2, parent, 0, 0, 50, 50);
      X.MapWindow(parent);
      X.MapSubwindows(parent);
      onEvent('CirculateNotify', ev => {
          assert.strictEqual(ev.event, parent);
          assert.strictEqual(ev.wid, child1);
          assert.strictEqual(ev.place, 0); // Top
          X.DestroyWindow(parent);
          done();
      });
      X.CirculateWindow(parent, 0); // RaiseLowest
  });

  it('ColormapNotify should fire when window colormap attribute changes', (t, done) => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0,
          { eventMask: x11.eventMask.ColormapChange });
      const cmap = X.AllocID();
      X.CreateColormap(cmap, root, display.screen[0].root_visual, 0);
      onEvent('ColormapNotify', ev => {
          assert.strictEqual(ev.wid, wid);
          assert.strictEqual(ev.colormap, cmap);
          assert.strictEqual(ev.new, 1);
          X.DestroyWindow(wid);
          X.FreeColormap(cmap);
          done();
      });
      X.ChangeWindowAttributes(wid, { colormap: cmap });
  });

  it('KeymapNotify should follow FocusIn when KeymapState selected', (t, done) => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0,
          { eventMask: x11.eventMask.FocusChange | x11.eventMask.KeymapState });
      X.MapWindow(wid);
      onEvent('KeymapNotify', ev => {
          assert.strictEqual(ev.keys.length, 31);
          X.DestroyWindow(wid);
          done();
      });
      X.SetInputFocus(wid, 0);
  });

  it('ResizeRequest should redirect resize from another client', (t, done) => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 50, 50, 0, 0, 0, 0,
          { eventMask: x11.eventMask.ResizeRedirect });
      X.MapWindow(wid);
      onEvent('ResizeRequest', ev => {
          assert.strictEqual(ev.wid, wid);
          assert.strictEqual(ev.width, 70);
          assert.strictEqual(ev.height, 80);
          X.DestroyWindow(wid);
          X2.terminate();
          done();
      });
      let X2;
      x11.createClient((err, dpy2) => {
          assert.ifError(err);
          X2 = dpy2.client;
          X2.ResizeWindow(wid, 70, 80);
      });
  });
});
