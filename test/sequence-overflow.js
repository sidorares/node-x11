const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('Client', () => {

  let display;
  beforeEach(done => {
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

  it('should handle more than 65535 requests in one connection', done => {
      should.exist(display);
      should.exist(display.screen);
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
         display.client.GetAtomName(1, test);
      }

      left++;
      test(); // first call starts sequens and not a callback from GetAtomName, thus left++
  });

});
