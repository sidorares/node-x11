var x11 = require('../lib');
var should = require('should');
var assert = require('assert');

describe('Client', function() {

  var display;
  beforeEach(function(done) {
      var client = x11.createClient(function(err, dpy) {
          if (!err) {
              display = dpy;
              done();
              client.removeListener('error', done);
          } else {
              done(err);
          }
      });
      client.on('error', done);
  });

  it('should respond to ping()', function(done) {
    display.client.ping(done);
  });

  it('should allow to enqueue requests and gracefully execute them before close()', function(done) {
    var count = 0;
    var pong = function(err) { if (err) return done(err); count++; }
    display.client.ping(pong);
      display.client.ping(pong);
      display.client.ping(pong);
      display.client.ping(pong);
      display.client.close(function(err) {
        if (err) return done(err);
        assert.equal(count,4);
        done();
      });
   })
});
