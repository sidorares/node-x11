var x11 = require('../lib/x11');
var should = require('should');
var assert = require('assert');

describe('KillKlient request', function() {

  var display;
  var X;
  beforeEach(function(done) {
      var client = x11.createClient(function(dpy) {
          display=dpy;
          X = display.client;
          done();
      });
      client.on('error', done);
  });

  afterEach(function(done) {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('should exist as client member', function(done) {
      should.exist(X.KillKlient);
      assert.equal(typeof X.KillKlient, 'function');
      done();
  });

  it('should terminate other client connection', function(done) {
      x11.createClient(function(dpy) {
          var otherclient = dpy.client;
          var wnd = otherclient.AllocID();
          otherclient.CreateWindow(wnd, dpy.screen[0].root, 0, 0, 1, 1);
          otherclient.on('end', done);
          X.KillKlient(wnd);
      });
  });

});
