var x11 = require('../lib/x11');
var should = require('should');
var assert = require('assert');

describe('CreateWindow request', function() {

  // keep for a while: this snippet helps to track global leak
  //global.__defineSetter__('a', function(v) {
  //    console.trace();
  //});

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
      should.exist(X.CreateWindow);
      assert.equal(typeof X.CreateWindow, 'function');
      done();
  });

  it('result should present in windows tree', function(done) {
      var wid = X.AllocID();
      X.CreateWindow(wid, display.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
      X.QueryTree(display.screen[0].root, function(err, list) {
          if (err)
              done(err);
          assert(list.children.indexOf(wid) != -1, 'can\'t find created window');
          done();
      });
  });

});
