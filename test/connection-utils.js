const { describe, it, beforeEach } = require('node:test');
const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

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

  it('should respond to ping()', (t, done) => {
    display.client.ping(done);
  });

  it('should allow to enqueue requests and gracefully execute them before close()', (t, done) => {
    let count = 0;
    const pong = err => { if (err) return done(err); count++; };
    display.client.ping(pong);
      display.client.ping(pong);
      display.client.ping(pong);
      display.client.ping(pong);
      display.client.close(err => {
        if (err) return done(err);
        assert.equal(count,4);
        done();
      });
   })
});
