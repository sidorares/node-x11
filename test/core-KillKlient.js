const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('KillKlient request', () => {

  let display;
  let X;
  beforeEach(done => {
      const client = x11.createClient((err, dpy) => {
          should.not.exist(err);
          display = dpy;
          X = display.client;
          const root = display.screen[0].root;
          const eventMask = x11.eventMask.SubstructureNotify;
          X.ChangeWindowAttributes(root, { eventMask });
          done();
      });

      client.on('error', done);
  });

  afterEach(done => {
      X.on('end', done);
      X.terminate();
  });

  it('should exist as client member', () => {
      should.exist(X.KillKlient);
      assert.equal(typeof X.KillKlient, 'function');
  });

  it('should terminate other client connection', done => {
      x11.createClient((err, dpy) => {
          should.not.exist(err);
          const otherclient = dpy.client;
          const wnd = otherclient.AllocID();
          X.once('event', ev => {
              ev.name.should.equal('CreateNotify');
              ev.wid.should.equal(wnd);
              X.KillKlient(wnd);
          });

          otherclient.CreateWindow(wnd, dpy.screen[0].root, 0, 0, 1, 1);
          otherclient.on('end', done);
      });
  });
});
