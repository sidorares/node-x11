var x11 = require('../lib');
var should = require('should');
var assert = require('assert');

describe('Client', function() {

  var display;
  before(function(done) {
      var client = x11.createClient({ debug: false }, function(err, dpy) {
          should.not.exist(err);
          display = dpy;
          done();
      });
  });

  it('should emit error which is instance of Error with sequence number corresponding to source request', function(done) {
    var times = 0;
    //id, parentId, x, y, width, height, borderWidth, depth, _class, visual, values
    display.client.CreateWindow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, {});
    var seq = display.client.seq_num;
    display.client.on('error', function(err) {
      switch (++ times) {
        case 11:
          display.client.removeAllListeners('error');
          done();
        break;
        default:
          assert.equal(err.constructor, Error);
          assert.equal(seq, err.seq);
          display.client.CreateWindow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, {}); // should emit error
          seq = display.client.seq_num;
       }
    });
  });
});
