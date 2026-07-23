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

  it('calls first createClient parameter with display object', done => {
      should.exist(display);
      should.exist(display.screen);
      should.exist(display.screen[0]);
      should.exist(display.screen[0].root);
      should.exist(display.major);
      done();
  });

  it('uses display variable from parameter if present ignoring anvironment $DISPLAY', done => {
     const disp = process.env.DISPLAY;
     process.env.DISPLAY = 'BOGUS DISPLAY';
     const client = x11.createClient({ display : disp }, done);
     client.on('error', done);
     process.env.DISPLAY=disp;
  });

  it('throws error if $DISPLAY is bogus', done => {
     try {
     assert.throws(() => {
        const client = x11.createClient({ display : 'BOGUS DISPLAY' }, (err, display) => {
          done('Should not reach here');
        });
        client.on('error', err => { done(); });
     }, /Cannot parse display/);
     done();
     } catch(e) {
        done();
    }
  });

  it('returns error when connecting to non existent display', done => {
    let errorCbCalled = false;
    const client = x11.createClient({ display : ':44' }, (err, display) => {
        assert(err instanceof Error);
	errorCbCalled = true;
        done();
    });
    // TODO: stop writing to socket after first error
    client.on('error', () => {
      if (!errorCbCalled)
        done('should not reach here before first done()');
    });
  });
});
