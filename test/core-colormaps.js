const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('Colormap requests', () => {

  let display;
  let X;
  let root;
  let defaultCmap;
  let writableVid; // visual with writable colormap (GrayScale/PseudoColor/DirectColor)

  beforeEach(done => {
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

  afterEach(done => {
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

  it('LookupColor should resolve named color "red"', done => {
      X.LookupColor(defaultCmap, 'red', (err, color) => {
          should.not.exist(err);
          color.exactRed.should.equal(0xffff);
          color.exactGreen.should.equal(0);
          color.exactBlue.should.equal(0);
          done();
      });
  });

  it('AllocNamedColor should allocate named color "blue"', done => {
      X.AllocNamedColor(defaultCmap, 'blue', (err, color) => {
          should.not.exist(err);
          color.exactBlue.should.equal(0xffff);
          color.visualBlue.should.be.above(0);
          X.QueryColors(defaultCmap, [color.pixel], (err2, colors) => {
              should.not.exist(err2);
              colors.length.should.equal(1);
              colors[0].blue.should.equal(color.visualBlue);
              colors[0].red.should.equal(color.visualRed);
              done();
          });
      });
  });

  it('QueryColors should report white and black pixels', done => {
      const white = display.screen[0].white_pixel;
      const black = display.screen[0].black_pixel;
      X.QueryColors(defaultCmap, [white, black], (err, colors) => {
          should.not.exist(err);
          colors.length.should.equal(2);
          colors[0].red.should.equal(0xffff);
          colors[0].green.should.equal(0xffff);
          colors[0].blue.should.equal(0xffff);
          colors[1].red.should.equal(0);
          colors[1].green.should.equal(0);
          colors[1].blue.should.equal(0);
          done();
      });
  });

  it('ListInstalledColormaps should include the default colormap', done => {
      X.ListInstalledColormaps(root, (err, cmaps) => {
          should.not.exist(err);
          cmaps.should.containEql(defaultCmap);
          done();
      });
  });

  it('InstallColormap/UninstallColormap should toggle installed list', function(done) {
      if (!writableVid)
          return this.skip();
      const cmap = createWritableCmap();
      X.InstallColormap(cmap);
      X.ListInstalledColormaps(root, (err, cmaps) => {
          should.not.exist(err);
          cmaps.should.containEql(cmap);
          X.UninstallColormap(cmap);
          X.ListInstalledColormaps(root, (err2, cmaps2) => {
              should.not.exist(err2);
              cmaps2.should.not.containEql(cmap);
              X.FreeColormap(cmap);
              done();
          });
      });
  });

  it('AllocColorCells + StoreColors should store readable values', function(done) {
      if (!writableVid)
          return this.skip();
      const cmap = createWritableCmap();
      X.AllocColorCells(0, cmap, 1, 0, (err, cells) => {
          should.not.exist(err);
          cells.pixels.length.should.equal(1);
          const pixel = cells.pixels[0];
          X.StoreColors(cmap, [{ pixel, red: 0xabab, green: 0x1212, blue: 0x7878 }]);
          X.QueryColors(cmap, [pixel], (err2, colors) => {
              should.not.exist(err2);
              colors[0].red.should.equal(0xabab);
              colors[0].green.should.equal(0x1212);
              colors[0].blue.should.equal(0x7878);
              X.FreeColors(cmap, 0, [pixel]);
              X.FreeColormap(cmap);
              done();
          });
      });
  });

  it('StoreNamedColor should store rgb of named color', function(done) {
      if (!writableVid)
          return this.skip();
      const cmap = createWritableCmap();
      X.AllocColorCells(0, cmap, 1, 0, (err, cells) => {
          should.not.exist(err);
          const pixel = cells.pixels[0];
          X.StoreNamedColor(cmap, pixel, 'red');
          X.QueryColors(cmap, [pixel], (err2, colors) => {
              should.not.exist(err2);
              colors[0].red.should.equal(0xffff);
              colors[0].green.should.equal(0);
              colors[0].blue.should.equal(0);
              X.FreeColormap(cmap);
              done();
          });
      });
  });

  it('AllocColorPlanes should return pixels and masks', function(done) {
      if (!writableVid)
          return this.skip();
      const cmap = createWritableCmap();
      X.AllocColorPlanes(0, cmap, 1, 1, 1, 1, (err, res) => {
          should.not.exist(err);
          res.pixels.length.should.equal(1);
          res.redMask.should.be.above(0);
          res.greenMask.should.be.above(0);
          res.blueMask.should.be.above(0);
          X.FreeColormap(cmap);
          done();
      });
  });

  it('CopyColormapAndFree should move allocations to new colormap', function(done) {
      if (!writableVid)
          return this.skip();
      const cmap = createWritableCmap();
      X.AllocColorCells(0, cmap, 1, 0, (err, cells) => {
          should.not.exist(err);
          const pixel = cells.pixels[0];
          X.StoreColors(cmap, [{ pixel, red: 0x4242, green: 0x4242, blue: 0x4242 }]);
          const cmap2 = X.AllocID();
          X.CopyColormapAndFree(cmap2, cmap);
          X.QueryColors(cmap2, [pixel], (err2, colors) => {
              should.not.exist(err2);
              colors[0].red.should.equal(0x4242);
              X.FreeColormap(cmap2);
              done();
          });
      });
  });
});
