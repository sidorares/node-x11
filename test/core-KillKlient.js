var x11 = require('../lib');
var should = require('should');
var assert = require('assert');

describe('KillKlient request', function() {

  var display;
  var X;
  beforeEach(function(done) {
      var client = x11.createClient(function(err, dpy) {
          if (!err) {
              display = dpy;
              X = display.client;
          }

          done(err);
      });
      client.on('error', function(err) {
         done(err);
      });
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
      x11.createClient(function(err, dpy) {
          if (!err) {
            var otherclient = dpy.client;
            var wnd = otherclient.AllocID();
            otherclient.CreateWindow(wnd, dpy.screen[0].root, 0, 0, 1, 1);
            otherclient.on('end', done);
            X.KillKlient(wnd);
          } else {
            done(err);
          }
      });
  });

});
