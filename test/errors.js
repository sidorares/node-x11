const x11 = require('../lib');
const should = require('should');
const assert = require('assert');
const { execFile } = require('child_process');
const path = require('path');

describe('Client', () => {

  let display;
  before(done => {
      const client = x11.createClient({ debug: false }, (err, dpy) => {
          should.not.exist(err);
          display = dpy;
          done();
      });
  });

  it('should emit error which is instance of Error with sequence number corresponding to source request', done => {
    let times = 0;
    //id, parentId, x, y, width, height, borderWidth, depth, _class, visual, values
    display.client.CreateWindow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, {});
    let seq = display.client.seq_num;
    display.client.on('error', err => {
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

  // #226: an unclaimed X error with no 'error' listener makes the emit throw
  // from inside the packet parser; the parser must re-arm regardless, or the
  // connection silently drops every later packet. Needs a child process:
  // the throw surfaces as an uncaughtException, which mocha would otherwise
  // attribute to this test — swallowing it in-process is exactly the
  // test-runner behavior that turns the dead parser into a silent hang.
  it('re-arms the packet parser when the error emit throws (no listener)', done => {
    const script = `
      const x11 = require(${JSON.stringify(path.join(__dirname, '..', 'lib'))});
      process.on('uncaughtException', () => {});
      x11.createClient((err, display) => {
        if (err) process.exit(3);
        const X = display.client;
        X.CreateWindow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, {}); // invalid -> unclaimed X error
        setTimeout(() => {
          X.GetInputFocus(() => process.exit(0)); // round-trip proves the parser is alive
          setTimeout(() => process.exit(2), 4000);
        }, 200);
      });
    `;
    execFile(process.execPath, ['-e', script], { env: process.env, timeout: 15000 }, (err) => {
      assert.ifError(err && err.code === 2 ? new Error('parser wedged: reply after unclaimed error never arrived') : err);
      done();
    });
  });
});
