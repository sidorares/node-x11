const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Colormap requests', () => {

  let display;
  let X;
  let root;
  let defaultCmap;
  let writableVid; // visual with writable colormap (GrayScale/PseudoColor/DirectColor)

  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
          if (err)
              return done(err);
          display = dpy;
          X = display.client;
          root = display.screen[0].root;
          defaultCmap = display.screen[0].default_colormap;
          writableVid = null;
          const depths = display.screen[0].depths;
          for (const depth in depths) {
              for (const vid in depths[depth]) {
                  const klass = depths[depth][vid].class;
                  if (klass === 1 || klass === 3 || klass === 5)
                      writableVid = depths[depth][vid].vid;
              }
          }
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

  function createWritableCmap() {
      // window param only selects the screen, visual can be any one it supports
      const cmap = X.AllocID();
      X.CreateColormap(cmap, root, writableVid, 0);
      return cmap;
  }

  it('LookupColor should resolve named color "red"', (t, done) => {
      X.LookupColor(defaultCmap, 'red', (err, color) => {
          assert.ifError(err);
          assert.strictEqual(color.exactRed, 0xffff);
          assert.strictEqual(color.exactGreen, 0);
          assert.strictEqual(color.exactBlue, 0);
          done();
      });
  });

  it('AllocColor should return closest rgb and a queryable pixel', (t, done) => {
      X.AllocColor(defaultCmap, 0xffff, 0x8080, 0, (err, color) => {
          assert.ifError(err);
          assert.strictEqual(color.red, 0xffff);
          assert.ok(Math.abs(color.green - 0x8080) <= 0x200);
          assert.strictEqual(color.blue, 0);
          X.QueryColors(defaultCmap, [color.pixel], (err2, colors) => {
              assert.ifError(err2);
              assert.strictEqual(colors[0].red, color.red);
              assert.strictEqual(colors[0].green, color.green);
              assert.strictEqual(colors[0].blue, color.blue);
              done();
          });
      });
  });

  it('AllocNamedColor should allocate named color "blue"', (t, done) => {
      X.AllocNamedColor(defaultCmap, 'blue', (err, color) => {
          assert.ifError(err);
          assert.strictEqual(color.exactBlue, 0xffff);
          assert.ok(color.visualBlue > 0);
          X.QueryColors(defaultCmap, [color.pixel], (err2, colors) => {
              assert.ifError(err2);
              assert.strictEqual(colors.length, 1);
              assert.strictEqual(colors[0].blue, color.visualBlue);
              assert.strictEqual(colors[0].red, color.visualRed);
              done();
          });
      });
  });

  it('QueryColors should report white and black pixels', (t, done) => {
      const white = display.screen[0].white_pixel;
      const black = display.screen[0].black_pixel;
      X.QueryColors(defaultCmap, [white, black], (err, colors) => {
          assert.ifError(err);
          assert.strictEqual(colors.length, 2);
          assert.strictEqual(colors[0].red, 0xffff);
          assert.strictEqual(colors[0].green, 0xffff);
          assert.strictEqual(colors[0].blue, 0xffff);
          assert.strictEqual(colors[1].red, 0);
          assert.strictEqual(colors[1].green, 0);
          assert.strictEqual(colors[1].blue, 0);
          done();
      });
  });

  it('ListInstalledColormaps should include the default colormap', (t, done) => {
      X.ListInstalledColormaps(root, (err, cmaps) => {
          assert.ifError(err);
          assert.ok(cmaps.includes(defaultCmap));
          done();
      });
  });

  it('InstallColormap/UninstallColormap should toggle installed list', function(t, done) {
      if (!writableVid) {
          t.skip();
          return done();
      }
      const cmap = createWritableCmap();
      X.InstallColormap(cmap);
      X.ListInstalledColormaps(root, (err, cmaps) => {
          assert.ifError(err);
          assert.ok(cmaps.includes(cmap));
          X.UninstallColormap(cmap);
          X.ListInstalledColormaps(root, (err2, cmaps2) => {
              assert.ifError(err2);
              assert.ok(!cmaps2.includes(cmap));
              X.FreeColormap(cmap);
              done();
          });
      });
  });

  it('AllocColorCells + StoreColors should store readable values', function(t, done) {
      if (!writableVid) {
          t.skip();
          return done();
      }
      const cmap = createWritableCmap();
      X.AllocColorCells(0, cmap, 1, 0, (err, cells) => {
          assert.ifError(err);
          assert.strictEqual(cells.pixels.length, 1);
          const pixel = cells.pixels[0];
          X.StoreColors(cmap, [{ pixel, red: 0xabab, green: 0x1212, blue: 0x7878 }]);
          X.QueryColors(cmap, [pixel], (err2, colors) => {
              assert.ifError(err2);
              assert.strictEqual(colors[0].red, 0xabab);
              assert.strictEqual(colors[0].green, 0x1212);
              assert.strictEqual(colors[0].blue, 0x7878);
              X.FreeColors(cmap, 0, [pixel]);
              X.FreeColormap(cmap);
              done();
          });
      });
  });

  it('StoreNamedColor should store rgb of named color', function(t, done) {
      if (!writableVid) {
          t.skip();
          return done();
      }
      const cmap = createWritableCmap();
      X.AllocColorCells(0, cmap, 1, 0, (err, cells) => {
          assert.ifError(err);
          const pixel = cells.pixels[0];
          X.StoreNamedColor(cmap, pixel, 'red');
          X.QueryColors(cmap, [pixel], (err2, colors) => {
              assert.ifError(err2);
              assert.strictEqual(colors[0].red, 0xffff);
              assert.strictEqual(colors[0].green, 0);
              assert.strictEqual(colors[0].blue, 0);
              X.FreeColormap(cmap);
              done();
          });
      });
  });

  it('AllocColorPlanes should return pixels and masks', function(t, done) {
      if (!writableVid) {
          t.skip();
          return done();
      }
      const cmap = createWritableCmap();
      X.AllocColorPlanes(0, cmap, 1, 1, 1, 1, (err, res) => {
          assert.ifError(err);
          assert.strictEqual(res.pixels.length, 1);
          assert.ok(res.redMask > 0);
          assert.ok(res.greenMask > 0);
          assert.ok(res.blueMask > 0);
          X.FreeColormap(cmap);
          done();
      });
  });

  it('CopyColormapAndFree should move allocations to new colormap', function(t, done) {
      if (!writableVid) {
          t.skip();
          return done();
      }
      const cmap = createWritableCmap();
      X.AllocColorCells(0, cmap, 1, 0, (err, cells) => {
          assert.ifError(err);
          const pixel = cells.pixels[0];
          X.StoreColors(cmap, [{ pixel, red: 0x4242, green: 0x4242, blue: 0x4242 }]);
          const cmap2 = X.AllocID();
          X.CopyColormapAndFree(cmap2, cmap);
          X.QueryColors(cmap2, [pixel], (err2, colors) => {
              assert.ifError(err2);
              assert.strictEqual(colors[0].red, 0x4242);
              X.FreeColormap(cmap2);
              done();
          });
      });
  });
});
