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

  it('reports the byte order the connection speaks', done => {
      // what the client declared in its hello, and therefore how every
      // request, reply, event and property value on it is encoded
      display.byte_order.should.be.oneOf([0, 1]);
      const hostIsLittleEndian =
          new Uint32Array(new Uint8Array([1, 2, 3, 4]).buffer)[0] === 0x04030201;
      display.byte_order.should.equal(hostIsLittleEndian ? 0 : 1);
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

  it('reports a connection dropped during setup instead of hanging', done => {
    // a server that hangs up mid-setup — resetting after its last client
    // left, or refusing authorisation without a word — used to leave the
    // connect callback waiting forever
    const { EventEmitter } = require('events');
    const stream = new EventEmitter();
    stream.write = () => true;
    stream.end = () => {};
    x11.createClient({ display: ':0', stream }, err => {
        assert(err instanceof Error);
        assert.match(err.message, /closed before setup/);
        done();
    });
    setImmediate(() => stream.emit('close'));
  });

  it('closes before it reports the connection closed', done => {
    // the callback used to fire when end() was called, not when the socket
    // was gone: an X server resets when its last client disconnects, so a
    // program that reconnects in that window loses the new connection
    const client = x11.createClient((err, dpy) => {
        assert.ifError(err);
        dpy.client.close(() => {
            const stream = dpy.client.stream;
            assert.ok(stream.readableEnded || stream.destroyed,
                'close() should report only once the server has let go');
            // and the connection that follows survives the server's reset
            const next = x11.createClient(err2 => {
                assert.ifError(err2);
                next.terminate();
                done();
            });
            next.on('error', done);
        });
    });
    client.on('error', done);
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
