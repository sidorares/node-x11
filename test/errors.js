var x11 = require('../lib/x11');
var should = require('should');
var assert = require('assert');

describe('Client', function() {

  var display;
  beforeEach(function(done) {
      var client = x11.createClient(function(dpy) {
      display=dpy;
      done();
    });
  });

  it('should emit error which is instance of Error with seqence number corresponding to source request', function(done) {
    display.client.options.debug = true;
    display.client.CreateWindow(); // should emit error
    var seq = display.client.seq_num;
    display.client.once('error', function(err) {
        assert.equal(err.constructor, Error);
        assert.equal(seq, err.seq);
        display.client.CreateWindow(); // should emit error
        seq = display.client.seq_num;
        display.client.once('error', function(err) {
            assert.equal(seq, err.seq);
            done();
        });
     });
  });
});
