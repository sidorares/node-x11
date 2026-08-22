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

  it('prints the Xauthority no-match diagnosis only when the server refuses', done => {
    // the warning used to fire on every connection, before the server had
    // answered, and was usually wrong about the outcome (react-x11#371). Here
    // the server does refuse, so the diagnosis must still arrive.
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const net = require('net');

    // an Xauthority whose single entry cannot match this connection:
    // family Local (256), an address no machine has, display "0"
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'x11-noauth-'));
    const authFile = path.join(home, 'authfile');
    const fields = [Buffer.from('no-such-host-entry'), Buffer.from('0'),
        Buffer.from('MIT-MAGIC-COOKIE-1'), Buffer.alloc(16, 0xcd)];
    fs.writeFileSync(authFile, Buffer.concat([Buffer.from([1, 0])].concat(
        fields.flatMap(f => [Buffer.from([f.length >> 8, f.length & 0xff]), f]))));
    const savedXauthority = process.env.XAUTHORITY;
    process.env.XAUTHORITY = authFile;

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    let finished = false;
    const finish = err => {
        if (finished) return;
        finished = true;
        console.warn = originalWarn;
        if (savedXauthority === undefined) delete process.env.XAUTHORITY;
        else process.env.XAUTHORITY = savedXauthority;
        fs.rmSync(home, { recursive: true, force: true });
        server.close(() => done(err));
    };

    const reason = 'Authorization required, but no authorization protocol specified';
    const server = net.createServer(sock => {
        sock.once('data', () => {
            // X11 setup Failed reply; the client reads the status byte and
            // the reason length, skips the rest of the header, then the text
            sock.end(Buffer.concat([
                Buffer.from([0, reason.length]), Buffer.alloc(6), Buffer.from(reason)
            ]));
        });
    });
    server.listen(0, '127.0.0.1', () => {
        // createClient dials TCP port 6000 + displayNum
        const displayNum = server.address().port - 6000;
        const client = x11.createClient({ display: `127.0.0.1:${displayNum}` }, () => {});
        client.on('error', err => {
            try {
                assert.match(err.message, /Authorization required/);
                assert.strictEqual(warnings.length, 1,
                    `expected exactly the diagnosis, got: ${JSON.stringify(warnings)}`);
                assert.ok(warnings[0].includes('the server refused the connection'),
                    'describes what happened, not a prediction');
                assert.ok(warnings[0].includes(authFile), 'names the file it read');
                finish();
            } catch (e) {
                finish(e);
            }
        });
    });
  });
});
