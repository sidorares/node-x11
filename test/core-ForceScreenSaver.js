const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('ForceScreenSaver request', () => {

  let display;
  let X;
  beforeEach((t, done) => {
      const client = x11.createClient((err, dpy) => {
          if (!err) {
            display = dpy;
            X = display.client;
          }

          done(err);
      });
      client.on('error', done);
  });

  afterEach((t, done) => {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('should exist as client member', (t, done) => {
      should.exist(X.ForceScreenSaver);
      assert.equal(typeof X.ForceScreenSaver, 'function');
      done();
  });

  it('should be callable with true parameter', (t, done) => {
      X.ForceScreenSaver(true);
      // any way to check if it is running?
      done();
  });
  
  it('should be callable with false parameter', (t, done) => {
      X.ForceScreenSaver(false);
      // any way to check if it is NOT running?
      done();
  });

});
