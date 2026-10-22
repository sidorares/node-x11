const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Font requests', () => {

  let display;
  let X;

  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
          if (err)
              return done(err);
          display = dpy;
          X = display.client;
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

  it('OpenFont + QueryFont should return metrics for "fixed"', (t, done) => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.QueryFont(fid, (err, font) => {
          assert.ifError(err);
          assert.ok(font.fontAscent > 0);
          assert.ok(font.maxBounds.characterWidth > 0);
          assert.ok(font.charInfos.length > 0);
          assert.ok(font.properties.length > 0);
          X.CloseFont(fid);
          done();
      });
  });

  it('QueryTextExtents should measure a string', (t, done) => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.QueryTextExtents(fid, 'hello', (err, extents) => {
          assert.ifError(err);
          // "fixed" is monospaced: overall width = 5 * char width
          assert.ok(extents.overallWidth > 0);
          X.QueryFont(fid, (err2, font) => {
              assert.ifError(err2);
              assert.strictEqual(extents.overallWidth, 5 * font.maxBounds.characterWidth);
              assert.strictEqual(extents.fontAscent, font.fontAscent);
              X.CloseFont(fid);
              done();
          });
      });
  });

  it('CloseFont should make font id invalid', (t, done) => {
      const fid = X.AllocID();
      X.OpenFont(fid, 'fixed');
      X.CloseFont(fid);
      X.QueryFont(fid, err => {
          assert.ok(err != null);
          assert.strictEqual(err.message, 'Bad font');
          done();
          return true; // error handled - don't re-emit on client
      });
  });

  it('ListFontsWithInfo should return same number of fonts as ListFonts', (t, done) => {
      X.ListFonts('*', 10, (err, names) => {
          assert.ifError(err);
          assert.ok(names.length > 0);
          // note: names may differ from ListFonts (server resolves aliases), so
          // only compare the count and check per-font info is sane
          X.ListFontsWithInfo('*', 10, (err2, fonts) => {
              assert.ifError(err2);
              assert.strictEqual(fonts.length, names.length);
              fonts.forEach(font => {
                  assert.ok(font.name.length > 0);
                  assert.ok(font.maxBounds.characterWidth > 0);
                  assert.ok(font.fontAscent > 0);
              });
              done();
          });
      });
  });

  it('GetFontPath/SetFontPath roundtrip', (t, done) => {
      X.GetFontPath((err, paths) => {
          assert.ifError(err);
          assert.ok(Array.isArray(paths));
          X.SetFontPath(paths);
          X.GetFontPath((err2, paths2) => {
              assert.ifError(err2);
              assert.deepStrictEqual(paths2, paths);
              done();
          });
      });
  });
});
