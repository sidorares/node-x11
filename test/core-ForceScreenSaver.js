var x11 = require('../lib');
var should = require('should');
var assert = require('assert');

describe('ForceScreenSaver request', function() {

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
      client.on('error', done);
  });

  afterEach(function(done) {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('should exist as client member', function(done) {
      should.exist(X.ForceScreenSaver);
      assert.equal(typeof X.ForceScreenSaver, 'function');
      done();
  });

  it('should be callable with true parameter', function(done) {
      X.ForceScreenSaver(true);
      // any way to check if it is running?
      done();
  });
  
  it('should be callable with false parameter', function(done) {
      X.ForceScreenSaver(false);
      // any way to check if it is NOT running?
      done();
  });

});
