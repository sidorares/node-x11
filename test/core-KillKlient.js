const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('KillKlient request', () => {

  let display;
  let X;
  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
          assert.ifError(err);
          display = dpy;
          X = display.client;
          const root = display.screen[0].root;
          const eventMask = x11.eventMask.SubstructureNotify;
          X.ChangeWindowAttributes(root, { eventMask });
          done();
      });

      client.on('error', done);
  });

  afterEach((t, done) => {
      X.on('end', done);
      X.terminate();
  });

  it('should exist as client member', () => {
      assert.ok(X.KillKlient != null);
      assert.strictEqual(typeof X.KillKlient, 'function');
  });

  it('should terminate other client connection', (t, done) => {
      x11.createClient((err, dpy) => {
          assert.ifError(err);
          const otherclient = dpy.client;
          const wnd = otherclient.AllocID();
          X.once('event', ev => {
              assert.strictEqual(ev.name, 'CreateNotify');
              assert.strictEqual(ev.wid, wnd);
              X.KillKlient(wnd);
          });

          otherclient.CreateWindow(wnd, dpy.screen[0].root, 0, 0, 1, 1);
          otherclient.on('end', done);
      });
  });
});
