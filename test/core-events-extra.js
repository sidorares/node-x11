const x11 = require('../lib');
const should = require('should');

describe('Core events (newly generated parsers)', () => {

  let display;
  let X;
  let root;
  let white;
  let black;
  let depth;

  beforeEach(done => {
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

  afterEach(done => {
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

  it('VisibilityNotify should fire when window becomes visible', done => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 50, 50, 0, 0, 0, 0,
          { eventMask: x11.eventMask.VisibilityChange });
      onEvent('VisibilityNotify', ev => {
          ev.wid.should.equal(wid);
          ev.state.should.equal(0); // Unobscured
          X.DestroyWindow(wid);
          done();
      });
      X.MapWindow(wid);
  });

  it('ReparentNotify should fire on ReparentWindow', done => {
      const parent = X.AllocID();
      const child = X.AllocID();
      X.CreateWindow(parent, root, 0, 0, 100, 100);
      X.CreateWindow(child, root, 0, 0, 20, 20, 0, 0, 0, 0,
          { eventMask: x11.eventMask.StructureNotify });
      onEvent('ReparentNotify', ev => {
          ev.event.should.equal(child);
          ev.wid.should.equal(child);
          ev.parent.should.equal(parent);
          ev.x.should.equal(5);
          ev.y.should.equal(6);
          X.DestroyWindow(parent);
          done();
      });
      X.ReparentWindow(child, parent, 5, 6);
  });

  it('GravityNotify should fire when parent resize moves child', done => {
      const parent = X.AllocID();
      const child = X.AllocID();
      X.CreateWindow(parent, root, 0, 0, 100, 100);
      // SouthEast gravity: child follows bottom-right corner
      X.CreateWindow(child, parent, 50, 50, 20, 20, 0, 0, 0, 0,
          { winGravity: 9, eventMask: x11.eventMask.StructureNotify });
      X.MapWindow(parent);
      onEvent('GravityNotify', ev => {
          ev.event.should.equal(child);
          ev.wid.should.equal(child);
          ev.x.should.equal(30);
          ev.y.should.equal(30);
          X.DestroyWindow(parent);
          done();
      });
      X.ResizeWindow(parent, 80, 80);
  });

  it('NoExposure should fire for fully valid CopyArea', done => {
      const pixmap = X.AllocID();
      const dst = X.AllocID();
      const gc = X.AllocID();
      X.CreatePixmap(pixmap, root, depth, 20, 20);
      X.CreatePixmap(dst, root, depth, 20, 20);
      X.CreateGC(gc, dst, { graphicsExposures: 1, foreground: black });
      X.PolyFillRectangle(pixmap, gc, [0, 0, 20, 20]);
      onEvent('NoExposure', ev => {
          ev.drawable.should.equal(dst);
          ev.majorOpcode.should.equal(62); // CopyArea
          X.FreeGC(gc);
          X.FreePixmap(pixmap);
          X.FreePixmap(dst);
          done();
      });
      X.CopyArea(pixmap, dst, gc, 0, 0, 0, 0, 20, 20);
  });

  it('GraphicsExposure should fire for out-of-bounds CopyArea source', done => {
      const pixmap = X.AllocID();
      const dst = X.AllocID();
      const gc = X.AllocID();
      X.CreatePixmap(pixmap, root, depth, 20, 20);
      X.CreatePixmap(dst, root, depth, 20, 20);
      X.CreateGC(gc, dst, { graphicsExposures: 1, foreground: black });
      X.PolyFillRectangle(pixmap, gc, [0, 0, 20, 20]);
      onEvent('GraphicsExposure', ev => {
          ev.drawable.should.equal(dst);
          ev.majorOpcode.should.equal(62); // CopyArea
          X.FreeGC(gc);
          X.FreePixmap(pixmap);
          X.FreePixmap(dst);
          done();
      });
      // source region sticks out of the 20x20 pixmap - missing part is exposed
      X.CopyArea(pixmap, dst, gc, 10, 10, 0, 0, 20, 20);
  });

  it('CirculateNotify should fire on CirculateWindow', done => {
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
          ev.event.should.equal(parent);
          ev.wid.should.equal(child1);
          ev.place.should.equal(0); // Top
          X.DestroyWindow(parent);
          done();
      });
      X.CirculateWindow(parent, 0); // RaiseLowest
  });

  it('ColormapNotify should fire when window colormap attribute changes', done => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0,
          { eventMask: x11.eventMask.ColormapChange });
      const cmap = X.AllocID();
      X.CreateColormap(cmap, root, display.screen[0].root_visual, 0);
      onEvent('ColormapNotify', ev => {
          ev.wid.should.equal(wid);
          ev.colormap.should.equal(cmap);
          ev.new.should.equal(1);
          X.DestroyWindow(wid);
          X.FreeColormap(cmap);
          done();
      });
      X.ChangeWindowAttributes(wid, { colormap: cmap });
  });

  it('KeymapNotify should follow FocusIn when KeymapState selected', done => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0,
          { eventMask: x11.eventMask.FocusChange | x11.eventMask.KeymapState });
      X.MapWindow(wid);
      onEvent('KeymapNotify', ev => {
          ev.keys.length.should.equal(31);
          X.DestroyWindow(wid);
          done();
      });
      X.SetInputFocus(wid, 0);
  });

  it('ResizeRequest should redirect resize from another client', done => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 50, 50, 0, 0, 0, 0,
          { eventMask: x11.eventMask.ResizeRedirect });
      X.MapWindow(wid);
      onEvent('ResizeRequest', ev => {
          ev.wid.should.equal(wid);
          ev.width.should.equal(70);
          ev.height.should.equal(80);
          X.DestroyWindow(wid);
          X2.terminate();
          done();
      });
      let X2;
      x11.createClient((err, dpy2) => {
          should.not.exist(err);
          X2 = dpy2.client;
          X2.ResizeWindow(wid, 70, 80);
      });
  });
});
