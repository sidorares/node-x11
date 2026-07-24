const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('Font requests', () => {

  let display;
  let X;

  beforeEach(done => {
      const client = x11.createClient((err, dpy) => {
          if (err)
              return done(err);
          display = dpy;
          X = display.client;
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

  it('OpenFont + QueryFont should return metrics for "fixed"', done => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.QueryFont(fid, (err, font) => {
          should.not.exist(err);
          font.fontAscent.should.be.above(0);
          font.maxBounds.characterWidth.should.be.above(0);
          font.charInfos.length.should.be.above(0);
          font.properties.length.should.be.above(0);
          X.CloseFont(fid);
          done();
      });
  });

  it('QueryTextExtents should measure a string', done => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.QueryTextExtents(fid, 'hello', (err, extents) => {
          should.not.exist(err);
          // "fixed" is monospaced: overall width = 5 * char width
          extents.overallWidth.should.be.above(0);
          X.QueryFont(fid, (err2, font) => {
              should.not.exist(err2);
              extents.overallWidth.should.equal(5 * font.maxBounds.characterWidth);
              extents.fontAscent.should.equal(font.fontAscent);
              X.CloseFont(fid);
              done();
          });
      });
  });

  it('CloseFont should make font id invalid', done => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.CloseFont(fid);
      X.QueryFont(fid, err => {
          should.exist(err);
          err.message.should.equal('Bad font');
          done();
          return true; // error handled - don't re-emit on client
      });
  });

  it('ListFontsWithInfo should return same number of fonts as ListFonts', done => {
      X.ListFonts('*', 10, (err, names) => {
          should.not.exist(err);
          names.length.should.be.above(0);
          // note: names may differ from ListFonts (server resolves aliases), so
          // only compare the count and check per-font info is sane
          X.ListFontsWithInfo('*', 10, (err2, fonts) => {
              should.not.exist(err2);
              fonts.length.should.equal(names.length);
              fonts.forEach(font => {
                  font.name.length.should.be.above(0);
                  font.maxBounds.characterWidth.should.be.above(0);
                  font.fontAscent.should.be.above(0);
              });
              done();
          });
      });
  });

  it('GetFontPath/SetFontPath roundtrip', done => {
      X.GetFontPath((err, paths) => {
          should.not.exist(err);
          paths.should.be.an.Array();
          X.SetFontPath(paths);
          X.GetFontPath((err2, paths2) => {
              should.not.exist(err2);
              assert.deepEqual(paths2, paths);
              done();
          });
      });
  });
});
