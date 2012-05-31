var x11 = require('../lib/x11');
//var sinon = require('sinon');
var should = require('should');
var assert = require('assert');

describe("Client", function() {

  beforeEach(function() {
  });

  afterEach(function() {
  });

  it("calls first createClient parameter with display object", function(done) {
    var client = x11.createClient(function(display) {
      should.exist(display);
      should.exist(display.screen);
      should.exist(display.screen[0]);
      should.exist(display.screen[0].root);
      should.exist(display.major);
      done();
    });
    client.on('error', function(err) { done(err); });
  });

  it("throws error if $DISPLAY is bogus", function(done) {
     try {
        var client = x11.createClient(function(display) {
          done("Should not reach here");
        }, "BOGUS DISPLAY");
        client.on('error', function(err) { done(); });
     } catch(err) {
        assert(err && err.message == "Cannot parse display");
        done();
     }
  });

  it("uses display variable from parameter if present ignoring anvironment $DISPLAY", function(done) {
     var disp = process.env.DISPLAY;
     process.env.DISPLAY = "BOGUS DISPLAY";
     var client = x11.createClient(function(display) {
        done();
     }, disp);
  });
});
