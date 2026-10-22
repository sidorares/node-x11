const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('GC requests', () => {

  let display;
  let X;
  let root;
  let white;
  let black;
  let depth;
  let pixmap;
  let bytesPP;

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
          bytesPP = depth <= 8 ? 1 : (depth <= 16 ? 2 : 4);
          pixmap = X.AllocID();
          X.CreatePixmap(pixmap, root, depth, 20, 20);
          done();
      });
      client.on('error', done);
  });

  afterEach((t, done) => {
      X.FreePixmap(pixmap);
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  function getPixel(imageData, x, y) {
      const off = (y * 20 + x) * bytesPP;
      let value = 0;
      for (let i = 0; i < bytesPP; ++i)
          value += imageData[off + i] << (8 * i);
      return value >>> 0;
  }

  it('CopyGC should copy selected components', (t, done) => {
      const gcWhite = X.AllocID();
      const gcDst = X.AllocID();
      X.CreateGC(gcWhite, pixmap, { foreground: white });
      X.CreateGC(gcDst, pixmap, { foreground: black });
      X.CopyGC(gcWhite, gcDst, ['foreground']);
      X.PolyFillRectangle(pixmap, gcDst, [0, 0, 20, 20]);
      X.GetImage(2, pixmap, 0, 0, 20, 20, 0xffffffff, (err, img) => {
          assert.ifError(err);
          assert.strictEqual(getPixel(img.data, 10, 10), white >>> 0);
          X.FreeGC(gcWhite);
          X.FreeGC(gcDst);
          done();
      });
  });

  it('SetClipRectangles should restrict fills to clip area', (t, done) => {
      const gc = X.AllocID();
      X.CreateGC(gc, pixmap, { foreground: black });
      X.PolyFillRectangle(pixmap, gc, [0, 0, 20, 20]); // all black
      X.ChangeGC(gc, { foreground: white });
      X.SetClipRectangles(gc, 0, 0, 0, [0, 0, 10, 20]); // left half only
      X.PolyFillRectangle(pixmap, gc, [0, 0, 20, 20]); // fill all - clipped
      X.GetImage(2, pixmap, 0, 0, 20, 20, 0xffffffff, (err, img) => {
          assert.ifError(err);
          assert.strictEqual(getPixel(img.data, 5, 10), white >>> 0);
          assert.strictEqual(getPixel(img.data, 15, 10), black >>> 0);
          X.FreeGC(gc);
          done();
      });
  });

  it('SetDashes should be accepted by server', (t, done) => {
      const gc = X.AllocID();
      X.CreateGC(gc, pixmap, { lineStyle: 1 }); // OnOffDash
      X.SetDashes(gc, 0, [3, 2]);
      // any encoding error would trigger BadLength/BadValue before the reply below
      X.GetInputFocus(err => {
          assert.ifError(err);
          X.FreeGC(gc);
          done();
      });
  });

  it('FreeGC should make gc id invalid', (t, done) => {
      const gc = X.AllocID();
      X.CreateGC(gc, pixmap, {});
      X.FreeGC(gc);
      X.removeAllListeners('error'); // drop the beforeEach done-listener
      X.on('error', err => {
          assert.strictEqual(err.message, 'Bad GContext');
          done();
      });
      X.ChangeGC(gc, { foreground: white });
  });
});
