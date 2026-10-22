const { describe, it, beforeEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Client', () => {

  let display;
  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
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

  it('should handle more than 65535 requests in one connection', (t, done) => {
      assert.ok(display != null);
      assert.ok(display.screen != null);
      const total = 70000;
      let left = total;
      const start = Date.now();
      function test(err, str) {
         if (err)
            return done(err);

         if (left == 0) {
            const end = Date.now();
            const dur = end - start;
            console.log(`${total} requests finished in ${dur} ms, ${1000*total/dur} req/sec`);
            return done();
         }
         left--;
         // GetInputFocus really round-trips (GetAtomName of a standard atom
         // is answered from the local cache and never hits the wire)
         display.client.GetInputFocus(test);
      }

      left++;
      test(); // first call starts sequens and not a callback from GetAtomName, thus left++
  });

});
