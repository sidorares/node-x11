const assert = require('assert');
const { EventEmitter } = require('events');
const x11 = require('../lib');
const FrameBuffer = require('../lib/framebuffer');

// A socket that keeps what it is handed without copying and only reports it
// consumed when the test says so — the way a real socket behaves while its
// send buffer is full. Any buffer the client reuses too early shows up as
// corrupted content at ack() time.
class FakeSocket extends EventEmitter {
    constructor(highWaterMark) {
        super();
        this.highWaterMark = highWaterMark === undefined ? Infinity : highWaterMark;
        this.pending = [];   // [chunk, cb]
        this.taken = [];     // chunks in write order
        this.writableLength = 0;
    }

    write(chunk, cb) {
        this.taken.push(chunk);
        this.writableLength += chunk.length;
        this.pending.push([chunk, cb]);
        return this.writableLength < this.highWaterMark;
    }

    /** Consume everything written so far, then emit 'drain'. */
    ack() {
        const pending = this.pending;
        this.pending = [];
        this.writableLength = 0;
        for (const [, cb] of pending)
            if (cb) cb();
        this.emit('drain');
    }

    /** Bytes handed over, in order, as one Buffer. */
    written() {
        return Buffer.concat(this.taken.map(c => Buffer.from(c)));
    }

    get writes() {
        return this.taken.filter(c => c.length > 0).length;
    }
}

// packet with a recognisable body, `len` bytes long
function packet(byte, len) {
    return Buffer.alloc(len === undefined ? 8 : len, byte);
}

function spin(ms) {
    const until = Date.now() + ms;
    while (Date.now() < until)
        ; // deterministic clock advance: the age gate is checked on submit()
}

describe('output buffering (#244)', () => {

  describe('unbuffered (default)', () => {

    it('writes every packet as it is submitted', () => {
        const fb = new FrameBuffer();
        const socket = new FakeSocket();
        fb.attach(socket);
        for (let i = 0; i < 5; i++)
            fb.put(packet(i)).submit();
        assert.strictEqual(socket.writes, 5);
        assert.strictEqual(fb.stats.writes, 5);
    });
  });

  describe('batching', () => {

    it('coalesces the packets of one tick into a single write', () => {
        const fb = new FrameBuffer(true);
        const socket = new FakeSocket();
        fb.attach(socket);
        for (let i = 0; i < 100; i++)
            fb.put(packet(i % 256)).submit();
        fb.flush();
        assert.strictEqual(socket.writes, 1);
        assert.strictEqual(socket.written().length, 800);
        assert.strictEqual(fb.stats.packets, 100);
    });

    it('preserves packet order and content', () => {
        const fb = new FrameBuffer({ maxSize: 64 });
        const socket = new FakeSocket();
        fb.attach(socket);
        const expected = [];
        for (let i = 1; i <= 40; i++) {
            const buf = packet(i, 4 * (i % 5 + 1));
            expected.push(buf);
            fb.put(buf).submit();
        }
        fb.flush();
        assert.ok(socket.writes < 20, `${socket.writes} writes for 40 packets`);
        assert.deepStrictEqual(socket.written(), Buffer.concat(expected));
    });

    it('writes without an explicit flush before the event loop polls', done => {
        const fb = new FrameBuffer(true);
        const socket = new FakeSocket();
        fb.attach(socket);
        fb.put(packet(1)).submit();
        assert.strictEqual(socket.writes, 0, 'held back within the tick');
        setImmediate(() => {
            assert.strictEqual(socket.writes, 1);
            assert.strictEqual(socket.written().length, 8);
            done();
        });
    });

    it('flushes when the batch is full', () => {
        const fb = new FrameBuffer({ maxSize: 1024, maxDelay: Infinity });
        const socket = new FakeSocket();
        fb.attach(socket);
        for (let i = 0; i < 128; i++)  // 128 * 8 = exactly maxSize
            fb.put(packet(i % 256)).submit();
        assert.strictEqual(socket.writes, 0);
        fb.put(packet(0xff)).submit();
        assert.strictEqual(socket.writes, 1);
        assert.strictEqual(socket.written().length, 1024);
    });

    it('hands an oversized packet straight to the socket, in order', () => {
        const fb = new FrameBuffer({ maxSize: 1024, maxDelay: Infinity });
        const socket = new FakeSocket();
        fb.attach(socket);
        const small = packet(1);
        const huge = packet(2, 4096);
        fb.put(small).submit();
        fb.put(huge).submit();
        assert.deepStrictEqual(socket.written(), Buffer.concat([small, huge]));
        // the big one is written as it is rather than copied through the batch
        assert.strictEqual(socket.taken[socket.taken.length - 1], huge);
    });

    it('flushes when the oldest packet reaches maxDelay', () => {
        const fb = new FrameBuffer({ maxDelay: 5 });
        const socket = new FakeSocket();
        fb.attach(socket);
        for (let i = 0; i < 8; i++)
            fb.put(packet(i)).submit();
        assert.strictEqual(socket.writes, 0);
        spin(8);
        // the age is sampled every few packets, not on every single one
        for (let i = 0; i < 8; i++)
            fb.put(packet(i)).submit();
        assert.strictEqual(socket.writes, 1, 'the age gate should have fired');
        fb.flush();
        assert.strictEqual(socket.written().length, 16 * 8);
    });

    it('sends a request that expects a reply without waiting', () => {
        const fb = new FrameBuffer(true);
        const socket = new FakeSocket();
        fb.attach(socket);
        fb.put(packet(1)).submit();
        assert.strictEqual(socket.writes, 0);
        fb.put(packet(2)).submit(true);
        assert.strictEqual(socket.writes, 1);
    });

    it('keeps batching replies too when flushOnReply is off', () => {
        const fb = new FrameBuffer({ flushOnReply: false, maxDelay: Infinity });
        const socket = new FakeSocket();
        fb.attach(socket);
        fb.put(packet(1)).submit(true);
        assert.strictEqual(socket.writes, 0);
    });

    it('flush(cb) writes now and reports when the data reached the socket', done => {
        const fb = new FrameBuffer(true);
        const socket = new FakeSocket();
        fb.attach(socket);
        fb.put(packet(1)).submit();
        let fired = false;
        fb.flush(() => { fired = true; });
        assert.strictEqual(socket.writes, 1, 'flush() is not subject to the policy');
        assert.strictEqual(fired, false);
        socket.ack();
        setTimeout(() => {
            assert.strictEqual(fired, true);
            done();
        }, 5);
    });
  });

  describe('shouldFlush', () => {

    it('receives the state of the batch', () => {
        const seen = [];
        const fb = new FrameBuffer({ shouldFlush: info => { seen.push(info); return false; } });
        fb.attach(new FakeSocket());
        fb.put(packet(1, 12)).submit();
        fb.put(packet(2, 4)).submit(true);
        assert.strictEqual(seen.length, 2);
        assert.deepStrictEqual(
            seen.map(i => [i.bytes, i.packets, i.expectsReply]),
            [[12, 1, false], [16, 2, true]]);
        assert.ok(seen[1].age >= 0 && seen[1].age < 1000);
    });

    it('holds the batch back when it returns false', () => {
        const fb = new FrameBuffer({ maxDelay: 0, shouldFlush: () => false });
        const socket = new FakeSocket();
        fb.attach(socket);
        for (let i = 0; i < 10; i++)
            fb.put(packet(i)).submit(true);  // both built-in gates would fire
        assert.strictEqual(socket.writes, 0);
    });

    it('falls back to the built-in gates when it returns undefined', () => {
        const fb = new FrameBuffer({ shouldFlush: info => (info.bytes > 100 ? true : undefined) });
        const socket = new FakeSocket();
        fb.attach(socket);
        fb.put(packet(1)).submit();
        assert.strictEqual(socket.writes, 0);
        fb.put(packet(2)).submit(true);      // expectsReply gate still applies
        assert.strictEqual(socket.writes, 1);
        fb.put(packet(3, 200)).submit();     // its own rule
        assert.strictEqual(socket.writes, 2);
    });

    it('cannot hold data past the point where the loop would poll', done => {
        const fb = new FrameBuffer({ shouldFlush: () => false });
        const socket = new FakeSocket();
        fb.attach(socket);
        fb.put(packet(1)).submit();
        setImmediate(() => {
            assert.strictEqual(socket.writes, 1);
            done();
        });
    });

    it('cannot hold more than maxSize', () => {
        const fb = new FrameBuffer({ maxSize: 256, shouldFlush: () => false });
        const socket = new FakeSocket();
        fb.attach(socket);
        for (let i = 0; i < 64; i++)   // 512 bytes: one full batch and a half
            fb.put(packet(i)).submit();
        assert.strictEqual(socket.writes, 1, 'the full batch went out');
        assert.strictEqual(socket.written().length, 256);
        fb.flush();
        assert.strictEqual(socket.written().length, 512);
    });
  });

  describe('buffer reuse', () => {

    it('does not allocate per request', () => {
        const fb = new FrameBuffer(true);
        const socket = new FakeSocket();
        fb.attach(socket);
        for (let round = 0; round < 50; round++) {
            for (let i = 0; i < 100; i++)
                fb.put(packet(i % 256)).submit();
            fb.flush();
            socket.ack(); // the socket is done with the buffer: back to the pool
        }
        assert.strictEqual(fb.stats.packets, 5000);
        assert.strictEqual(fb.stats.allocs, 1, 'one output buffer for 5000 requests');
    });

    it('never refills a buffer the socket still holds', () => {
        const fb = new FrameBuffer({ maxSize: 64 });
        const socket = new FakeSocket();
        fb.attach(socket);
        const expected = [];
        // several batches in flight at once: nothing is acked in between
        for (let i = 1; i <= 32; i++) {
            const buf = packet(i, 16);
            expected.push(buf);
            fb.put(buf).submit();
            fb.flush();
        }
        assert.deepStrictEqual(socket.written(), Buffer.concat(expected));
        socket.ack();
        assert.deepStrictEqual(socket.written(), Buffer.concat(expected),
            'chunks handed to the socket must not change afterwards');
        assert.ok(fb.stats.allocs > 1, 'in-flight buffers cannot be reused');
    });
  });

  describe('backpressure', () => {

    it('reports the socket backing up and loses nothing', () => {
        const fb = new FrameBuffer({ maxSize: 64 });
        const socket = new FakeSocket(128); // room for two batches
        fb.attach(socket);
        const expected = [];
        let ok = true;
        for (let i = 1; ok && i <= 100; i++) {
            const buf = packet(i % 256, 32);
            expected.push(buf);
            ok = fb.put(buf).submit();
        }
        assert.strictEqual(ok, false, 'backpressure should have been reported');
        const queued = expected.length;
        socket.ack();
        fb.flush();
        assert.deepStrictEqual(socket.written(), Buffer.concat(expected.slice(0, queued)));
    });

    it('emits drain once the queue is empty again', done => {
        const fb = new FrameBuffer(true);
        const socket = new FakeSocket(16);
        fb.attach(socket);
        fb.put(packet(1, 64)).submit();
        fb.flush();
        fb.on('drain', () => done());
        socket.ack();
    });
  });

  describe('option validation', () => {

    it('rejects nonsense', () => {
        assert.throws(() => new FrameBuffer({ maxSize: 0 }), /maxSize/);
        assert.throws(() => new FrameBuffer({ maxSize: '16k' }), /maxSize/);
        assert.throws(() => new FrameBuffer({ maxDelay: -1 }), /maxDelay/);
        assert.throws(() => new FrameBuffer({ shouldFlush: 5 }), /shouldFlush/);
    });
  });

  describe('over a real connection', () => {

    let display;
    let X;
    let root;

    function connect(options, cb) {
        const client = x11.createClient(options, (err, dpy) => {
            if (err) return cb(err);
            client.removeListener('error', cb);
            cb(null, dpy);
        });
        client.on('error', cb);
    }

    beforeEach(done => {
        connect({ bufferRequests: true }, (err, dpy) => {
            if (err) return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            done();
        });
    });

    afterEach(done => {
        if (X.stream.writableEnded)  // the test closed the connection itself
            return done();
        X.on('end', done);
        X.terminate();
    });

    it('draws the same picture as an unbuffered client', done => {
        const W = 16, H = 16;
        const depth = display.screen[0].root_depth;
        const white = display.screen[0].white_pixel;
        const pixmap = X.AllocID();
        const gc = X.AllocID();
        X.CreatePixmap(pixmap, root, depth, W, H);
        X.CreateGC(gc, pixmap, { foreground: display.screen[0].black_pixel });
        X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]);
        X.ChangeGC(gc, { foreground: white });
        for (let i = 0; i < W; i++)         // a diagonal, one request per pixel
            X.PolyFillRectangle(pixmap, gc, [i, i, 1, 1]);
        const writes = X.pack_stream.stats.writes;
        X.GetImage(2, pixmap, 0, 0, W, H, 0xffffffff, (err, image) => {
            assert.ifError(err);
            const bytesPP = depth <= 8 ? 1 : (depth <= 16 ? 2 : 4);
            let lit = 0;
            for (let y = 0; y < H; y++) {
                let pixel = 0;
                for (let i = 0; i < bytesPP; ++i)
                    pixel += image.data[(y * W + y) * bytesPP + i] << (8 * i);
                if ((pixel >>> 0) === white) lit++;
            }
            assert.strictEqual(lit, H, 'every pixel of the diagonal was drawn');
            // 20 requests, and the reply forced at most one write
            assert.ok(X.pack_stream.stats.writes - writes <= 1,
                `${X.pack_stream.stats.writes - writes} writes for the GetImage`);
            X.FreeGC(gc);
            X.FreePixmap(pixmap);
            done();
        });
    });

    it('batches a run of requests into one write', done => {
        X.sync(err => {
            assert.ifError(err);
            const before = X.pack_stream.stats.writes;
            for (let i = 0; i < 200; i++)
                X.ChangeWindowAttributes(root, { eventMask: 0 });
            assert.strictEqual(X.pack_stream.stats.writes, before,
                'nothing should have been written yet');
            X.sync(err2 => {
                assert.ifError(err2);
                const writes = X.pack_stream.stats.writes - before;
                assert.ok(writes <= 2, `${writes} writes for 200 requests + sync`);
                done();
            });
        });
    });

    it('a request expecting a reply is not held back', done => {
        X.GetInputFocus(err => {
            assert.ifError(err);
            done();
        });
        assert.ok(X.pack_stream.stats.writes > 0, 'written within the tick');
    });

    it('still confirms a checked void request', done => {
        // the sync the client issues on its behalf expects a reply, so it
        // takes the buffered request out with it
        X.ChangeWindowAttributes(root, { eventMask: 0 }, err => {
            assert.strictEqual(err, null);
            done();
        });
    });

    it('flushes what is buffered before the connection is closed', done => {
        // terminate() is the last thing a program does; a buffered request
        // issued just before it must still reach the server
        const name = `x11-buffering-test-${process.pid}`;
        X.InternAtom(false, name, (err, atom) => {
            assert.ifError(err);
            X.ChangeProperty(0, root, atom, X.atoms.STRING, 8, Buffer.from('kept'));
            X.terminate();
            connect({}, (err2, dpy) => {
                assert.ifError(err2);
                const X2 = dpy.client;
                X2.GetProperty(0, root, atom, X2.atoms.STRING, 0, 10, (err3, prop) => {
                    assert.ifError(err3);
                    assert.strictEqual(prop.data.toString(), 'kept');
                    X2.DeleteProperty(root, atom);
                    X2.terminate();
                    done();
                });
            });
        });
    });

    it('flushes what is buffered when the process exits', function(done) {
        // process.exit() runs no timers and no immediates: without an exit
        // hook a buffered request would be lost with no trace
        this.timeout(20000);
        const name = `x11-buffering-exit-${process.pid}`;
        const child = `
            const x11 = require(${JSON.stringify(require.resolve('../lib'))});
            x11.createClient({ bufferRequests: true }, (err, display) => {
                if (err) throw err;
                const X = display.client;
                X.InternAtom(false, ${JSON.stringify(name)}, (err, atom) => {
                    if (err) throw err;
                    X.ChangeProperty(0, display.screen[0].root, atom,
                                     X.atoms.STRING, 8, Buffer.from('kept'));
                    process.exit(0);
                });
            });`;
        require('child_process').execFile(process.execPath, ['-e', child], err => {
            assert.ifError(err);
            X.InternAtom(false, name, (err2, atom) => {
                assert.ifError(err2);
                X.GetProperty(0, root, atom, X.atoms.STRING, 0, 10, (err3, prop) => {
                    assert.ifError(err3);
                    assert.strictEqual(prop.data.toString(), 'kept');
                    X.DeleteProperty(root, atom);
                    done();
                });
            });
        });
    });

    it('still reports backpressure to the caller', function(done) {
        this.timeout(30000);
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 1, 1);
        const chunk = Buffer.alloc(0xfff0, 0xab);
        let ok = true;
        let writes = 0;
        while (ok && writes < 4096) {
            ok = X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, chunk);
            writes++;
        }
        assert.strictEqual(ok, false, `no backpressure after ${writes} writes`);
        X.once('drain', () => {
            X.sync(err => {
                X.DestroyWindow(wid);
                X.ReleaseID(wid);
                done(err);
            });
        });
    });
  });
});
