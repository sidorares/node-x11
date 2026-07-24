const x11 = require('../lib');
const should = require('should');

describe('Drawing requests', () => {

  const W = 20;
  const H = 20;

  let display;
  let X;
  let root;
  let white;
  let black;
  let depth;
  let pixmap;
  let gc;
  let bytesPP;

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
          bytesPP = depth <= 8 ? 1 : (depth <= 16 ? 2 : 4);
          pixmap = X.AllocID();
          X.CreatePixmap(pixmap, root, depth, W, H);
          gc = X.AllocID();
          X.CreateGC(gc, pixmap, { foreground: black, background: black });
          X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]); // black canvas
          X.ChangeGC(gc, { foreground: white });
          done();
      });
      client.on('error', done);
  });

  afterEach(done => {
      X.FreeGC(gc);
      X.FreePixmap(pixmap);
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  function getPixel(imageData, x, y) {
      const off = (y * W + x) * bytesPP;
      let value = 0;
      for (let i = 0; i < bytesPP; ++i)
          value += imageData[off + i] << (8 * i);
      return value >>> 0;
  }

  function countPixels(imageData, pixel) {
      let count = 0;
      for (let y = 0; y < H; ++y)
          for (let x = 0; x < W; ++x)
              if (getPixel(imageData, x, y) === (pixel >>> 0))
                  ++count;
      return count;
  }

  function readBack(cb) {
      X.GetImage(2, pixmap, 0, 0, W, H, 0xffffffff, (err, img) => {
          should.not.exist(err);
          cb(img.data);
      });
  }

  it('PolySegment should draw line segments', done => {
      X.PolySegment(pixmap, gc, [0, 10, 19, 10, 5, 0, 5, 4]);
      readBack(data => {
          getPixel(data, 10, 10).should.equal(white >>> 0); // on segment 1
          getPixel(data, 5, 2).should.equal(white >>> 0);   // on segment 2
          getPixel(data, 10, 5).should.equal(black >>> 0);  // off both
          done();
      });
  });

  it('PolyRectangle should draw outlines only', done => {
      X.PolyRectangle(pixmap, gc, [2, 2, 15, 15]);
      readBack(data => {
          getPixel(data, 2, 2).should.equal(white >>> 0);   // corner
          getPixel(data, 17, 17).should.equal(white >>> 0); // opposite corner
          getPixel(data, 10, 10).should.equal(black >>> 0); // inside not filled
          done();
      });
  });

  it('PolyArc should draw an ellipse outline', done => {
      X.PolyArc(pixmap, gc, [2, 2, 16, 16, 0, 360 * 64]);
      readBack(data => {
          getPixel(data, 2, 10).should.equal(white >>> 0);  // leftmost point
          getPixel(data, 18, 10).should.equal(white >>> 0); // rightmost point
          getPixel(data, 10, 10).should.equal(black >>> 0); // center untouched
          done();
      });
  });

  it('FillPoly should fill a triangle', done => {
      X.FillPoly(pixmap, gc, 2, 0, [0, 0, 19, 0, 10, 19]);
      readBack(data => {
          getPixel(data, 10, 5).should.equal(white >>> 0);  // inside
          getPixel(data, 0, 19).should.equal(black >>> 0);  // outside
          done();
      });
  });

  it('CopyPlane should reproduce src through one bit-plane', done => {
      X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]); // all white
      const dst = X.AllocID();
      X.CreatePixmap(dst, root, depth, W, H);
      const dstGC = X.AllocID();
      // white has at least one bit set - pick lowest set bit as the plane
      const plane = white & -white;
      X.CreateGC(dstGC, dst, { foreground: white, background: black });
      X.CopyPlane(pixmap, dst, dstGC, 0, 0, 0, 0, W, H, plane);
      X.GetImage(2, dst, 0, 0, W, H, 0xffffffff, (err, img) => {
          should.not.exist(err);
          getPixel(img.data, 10, 10).should.equal(white >>> 0);
          X.FreeGC(dstGC);
          X.FreePixmap(dst);
          done();
      });
  });

  it('ImageText8 should draw text pixels', done => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.ChangeGC(gc, { font: fid });
      X.ImageText8(pixmap, gc, 2, 15, 'X');
      X.CloseFont(fid);
      readBack(data => {
          countPixels(data, white).should.be.above(0);
          done();
      });
  });

  it('ImageText16 should draw same pixels as ImageText8', done => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.ChangeGC(gc, { font: fid });
      X.ImageText8(pixmap, gc, 2, 15, 'X');
      readBack(data8 => {
          const count8 = countPixels(data8, white);
          count8.should.be.above(0);
          X.ChangeGC(gc, { foreground: black });
          X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]); // reset to black
          X.ChangeGC(gc, { foreground: white });
          X.ImageText16(pixmap, gc, 2, 15, 'X');
          X.CloseFont(fid);
          readBack(data16 => {
              countPixels(data16, white).should.equal(count8);
              done();
          });
      });
  });

  it('PolyText16 should draw same pixels as PolyText8', done => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.ChangeGC(gc, { font: fid });
      X.PolyText8(pixmap, gc, 2, 15, ['X1']);
      readBack(data8 => {
          const count8 = countPixels(data8, white);
          count8.should.be.above(0);
          X.ChangeGC(gc, { foreground: black });
          X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]); // reset to black
          X.ChangeGC(gc, { foreground: white });
          X.PolyText16(pixmap, gc, 2, 15, ['X1']);
          X.CloseFont(fid);
          readBack(data16 => {
              countPixels(data16, white).should.equal(count8);
              done();
          });
      });
  });
});
