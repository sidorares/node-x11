var x11 = require('../lib');
var should = require('should');
var assert = require('assert');

describe('KillKlient request', function() {

  var display;
  var X;
  beforeEach(function(done) {
      var client = x11.createClient(function(err, dpy) {
          should.not.exist(err);
          display = dpy;
          X = display.client;
          root = display.screen[0].root;
          var eventMask = x11.eventMask.SubstructureNotify;
          X.ChangeWindowAttributes(root, { eventMask: eventMask });
          done();
      });

      client.on('error', done);
  });

  afterEach(function(done) {
      X.on('end', done);
      X.terminate();
  });

  it('should exist as client member', function() {
      should.exist(X.KillKlient);
      assert.equal(typeof X.KillKlient, 'function');
  });

  it('should terminate other client connection', function(done) {
      x11.createClient(function(err, dpy) {
          should.not.exist(err);
          var otherclient = dpy.client;
          var wnd = otherclient.AllocID();
          X.once('event', function(ev) {
              ev.name.should.equal('CreateNotify');
              ev.wid.should.equal(wnd);
              X.KillKlient(wnd);
          });

          otherclient.CreateWindow(wnd, dpy.screen[0].root, 0, 0, 1, 1);
          otherclient.on('end', done);
      });
  });
});
