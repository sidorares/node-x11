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

  it('calls first createClient parameter with display object', (t, done) => {
      assert.ok(display != null);
      assert.ok(display.screen != null);
      assert.ok(display.screen[0] != null);
      assert.ok(display.screen[0].root != null);
      assert.ok(display.major != null);
      done();
  });

  it('reports the byte order the connection speaks', (t, done) => {
      // what the client declared in its hello, and therefore how every
      // request, reply, event and property value on it is encoded
      assert.ok([0, 1].includes(display.byte_order));
      const hostIsLittleEndian =
          new Uint32Array(new Uint8Array([1, 2, 3, 4]).buffer)[0] === 0x04030201;
      assert.strictEqual(display.byte_order, hostIsLittleEndian ? 0 : 1);
      done();
  });

  it('uses display variable from parameter if present ignoring anvironment $DISPLAY', (t, done) => {
     const disp = process.env.DISPLAY;
     process.env.DISPLAY = 'BOGUS DISPLAY';
     const client = x11.createClient({ display : disp }, done);
     client.on('error', done);
     process.env.DISPLAY=disp;
  });

  it('throws error if $DISPLAY is bogus', (t, done) => {
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

  it('reports a connection dropped during setup instead of hanging', (t, done) => {
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

  it('closes before it reports the connection closed', (t, done) => {
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

  // Xwayland's listen queue is one connection deep, so a second client
  // connecting while the first waits to be accepted finds it full. Here a
  // proxy in front of the test server listens one deep and does not accept
  // for a while; two plain connections fill its queue, and the client has to
  // wait its turn the way a blocking connect (Xlib, XCB) does. Linux only: a
  // display names no unix socket but /tmp/.X11-unix/X<n> there, and the
  // proxy needs the server's own socket to forward to.
  const realDisplay = process.env.DISPLAY && x11.parseDisplay?.(process.env.DISPLAY);
  const onLinuxUnix = process.platform === 'linux' && realDisplay && !realDisplay.host;
  (onLinuxUnix ? it : it.skip)('waits out a listen queue that is full, as a blocking connect would', { timeout: 10000 }, function (t, done) {
    const fs = require('fs');
    const os = require('os');
    const net = require('net');
    const { spawn } = require('child_process');
    let num = 4000 + (process.pid % 1000);
    while (fs.existsSync(`/tmp/.X11-unix/X${num}`)) num++;
    const sock = `/tmp/.X11-unix/X${num}`;
    const target = `/tmp/.X11-unix/X${realDisplay.displayNum}`;
    const proxy = spawn(process.execPath, ['-e', `
        const net = require('net');
        const [sock, target] = process.argv.slice(1);
        net.createServer(c => {
            const up = net.createConnection(target);
            c.on('error', () => {});
            up.on('error', () => {});
            c.pipe(up).pipe(c);
        }).listen({ path: sock, backlog: 1 }, () => {
            process.stdout.write('listening\\n');
            // not accepting yet: what connects now waits in the queue
            const until = Date.now() + 500;
            while (Date.now() < until);
        });
    `, sock, target], { stdio: ['ignore', 'pipe', 'inherit'] });
    const fillers = [];
    const finish = err => {
        for (const f of fillers) f.destroy();
        proxy.kill();
        fs.rmSync(sock, { force: true });
        done(err);
    };
    proxy.stdout.once('data', () => {
        // Linux holds backlog + 1 connections before it turns the next away
        for (let i = 0; i < 2; i++) {
            const f = net.createConnection(sock);
            f.on('error', () => {});
            fillers.push(f);
        }
        // the server's own cookie: the proxy's display number has none
        require('../lib/auth')(String(realDisplay.displayNum), os.hostname(), 'local', (err, cookie) => {
            if (err) return finish(err);
            const client = x11.createClient({
                display: `:${num}`,
                auth: { name: cookie.authName, data: cookie.authData },
            }, (err, dpy) => {
                if (err) return finish(err);
                dpy.client.terminate();
                finish();
            });
            client.on('error', () => {}); // reported through the callback
        });
    });
  });

  it('returns error when connecting to non existent display', (t, done) => {
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

  it('prints the Xauthority no-match diagnosis only when the server refuses', (t, done) => {
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
