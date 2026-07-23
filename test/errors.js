const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

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
});
