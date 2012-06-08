var x11 = require('../lib/x11');
//var sinon = require('sinon');
var should = require('should');
var assert = require('assert');

describe('Client', function() {

  var display;
  beforeEach(function(done) {
      var client = x11.createClient(function(dpy) {
          display=dpy;
          done();
      });
      client.on('error', function(err) { done(err); });
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
     var client = x11.createClient(function(display) {
        done();
     }, disp);
     process.env.DISPLAY=disp;
  });

  it('throws error if $DISPLAY is bogus', function(done) {
     try {
     assert.throws(function() {
        var client = x11.createClient(function(display) {
          done('Should not reach here');
        }, 'BOGUS DISPLAY');
        client.on('error', function(err) { done(); });
     }, /Cannot parse display/);
     done();
     } catch(e) {
        console.log(e);
        done(); 
    }
  });
});
