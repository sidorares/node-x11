const x11 = require('../lib');
const should = require('should');

describe('Cursor requests', () => {

  let display;
  let X;
  let root;

  beforeEach(done => {
      const client = x11.createClient((err, dpy) => {
          if (err)
              return done(err);
          display = dpy;
          X = display.client;
          root = display.screen[0].root;
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

  const red = { R: 0xffff, G: 0, B: 0 };
  const white = { R: 0xffff, G: 0xffff, B: 0xffff };

  function createLeftPtrCursor() {
      const fid = X.AllocID();
      X.OpenFont(fid, 'cursor');
      const cid = X.AllocID();
      // 68/69 - XC_left_ptr glyph and its mask in the standard cursor font
      X.CreateGlyphCursor(cid, fid, fid, 68, 69, { R: 0, G: 0, B: 0 }, white);
      X.CloseFont(fid);
      return cid;
  }

  it('CreateGlyphCursor should create usable cursor', done => {
      const cid = createLeftPtrCursor();
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 10, 10, 0, 0, 0, 0, { cursor: cid });
      // any of the above failing would error before this reply arrives
      X.GetWindowAttributes(wid, (err, attrs) => {
          should.not.exist(err);
          X.DestroyWindow(wid);
          X.FreeCursor(cid);
          done();
      });
  });

  it('RecolorCursor should be accepted by server', done => {
      const cid = createLeftPtrCursor();
      X.RecolorCursor(cid, red, white);
      X.GetInputFocus(err => {
          should.not.exist(err);
          X.FreeCursor(cid);
          done();
      });
  });

  it('FreeCursor should make cursor id invalid', done => {
      const cid = createLeftPtrCursor();
      X.FreeCursor(cid);
      X.removeAllListeners('error'); // drop the beforeEach done-listener
      X.on('error', err => {
          err.message.should.equal('Bad cursor');
          done();
      });
      X.RecolorCursor(cid, red, white);
  });

  it('QueryBestSize should return non-zero cursor size', done => {
      X.QueryBestSize(0, root, 16, 16, (err, size) => {
          should.not.exist(err);
          size.width.should.be.above(0);
          size.height.should.be.above(0);
          done();
      });
  });
});
