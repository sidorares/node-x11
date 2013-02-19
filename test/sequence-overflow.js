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

  it('should handle more than 65535 requests in one connection', function(done) {
      should.exist(display);
      should.exist(display.screen);
      var total = 70000;
      var left = total;
      var start = Date.now();
      function test(err, str) {
         if (err)
            return done(err);

         if (left == 0) {
            var end = Date.now();
            var dur = end - start;
            console.log(total + ' requests finished in ' + dur + ' ms, ' + 1000*total/dur + ' req/sec');
            return done();
         }
         left--;
         display.client.GetAtomName(1, test);
      }

      left++;
      test(); // first call starts sequens and not a callback from GetAtomName, thus left++
  });

});
