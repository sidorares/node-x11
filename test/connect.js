var x11 = require('../lib');
var should = require('should');
var assert = require('assert');
var util = require('util');

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

  it('calls first createClient parameter with display object', function(done) {
      should.exist(display);
      should.exist(display.screen);
      should.exist(display.screen[0]);
      should.exist(display.screen[0].root);
      should.exist(display.major);
      done();
  });

  it('uses display variable from parameter if present ignoring anvironment $DISPLAY', function(done) {
     var disp = process.env.DISPLAY;
     process.env.DISPLAY = 'BOGUS DISPLAY';
     var client = x11.createClient({ display : disp }, done);
     client.on('error', done);
     process.env.DISPLAY=disp;
  });

  it('throws error if $DISPLAY is bogus', function(done) {
     try {
     assert.throws(function() {
        var client = x11.createClient({ display : 'BOGUS DISPLAY' }, function(err, display) {
          done('Should not reach here');
        });
        client.on('error', function(err) { done(); });
     }, /Cannot parse display/);
     done();
     } catch(e) {
        done();
    }
  });

  it('returns error when connecting to non existent display', function(done) {
    var errorCbCalled = false;
    var client = x11.createClient({ display : ':44' }, function(err, display) {
        assert(util.isError(err));
	errorCbCalled = true;
        done();
    });
    // TODO: stop writing to socket after first error
    client.on('error', function() {
      if (!errorCbCalled)
        done('should not reach here before first done()');
    });
  });
});
