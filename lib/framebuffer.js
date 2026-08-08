'use strict';

const { EventEmitter } = require('events');

const EMPTY = Buffer.alloc(0);

// Xlib has buffered its output in a 16 KB buffer since X11R1, and the size
// still fits: big enough for a frame's worth of small requests, small enough
// that a full batch goes out in one socket send.
const DEFAULT_MAX_SIZE = 16384;
// How long a request may sit in the buffer while more are being queued. A
// frame's requests are issued in one synchronous run, so this only bites when
// a producer holds the event loop for longer than that — and then it lets the
// server start working on the first requests instead of waiting for the last.
const DEFAULT_MAX_DELAY = 5;
// Output buffers kept for reuse. One is enough while writes complete inside
// the tick that issued them; the rest cover bursts that flush several times.
const POOL_MAX = 4;
// Reading the clock costs more per request than the age gate saves, so sample
// it every few packets. Nothing is lost: the age only decides anything while
// a producer keeps issuing requests, and a batch that stops growing is
// written when the event loop comes round anyway. Sub-millisecond maxDelay
// settings check every packet (mask 0).
const AGE_SAMPLE_MASK = 7;

// performance.now() is monotonic (Date.now() can step with the system clock)
// and is present in Node and in browsers.
const monotonic = (typeof performance === 'object' && performance !== null &&
                   typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();

// The backstop that keeps buffering off the latency path: whatever the policy
// says, nothing is left in the buffer when the event loop goes to poll for
// I/O. In Node that is setImmediate (runs after the current phase, before the
// next poll); in a browser, as soon as the current stack unwinds.
const scheduleFlush = typeof setImmediate === 'function'
    ? setImmediate
    : fn => queueMicrotask(fn);

function positive(value, name) {
    if (typeof value !== 'number' || !(value > 0))
        throw new TypeError(`${name} must be a positive number`);
    return value;
}

/**
 * Bidirectional X11 framing buffer.
 * - Inbound: accumulate socket chunks; satisfy exact-length get(n, cb) reads.
 * - Outbound: put(Buffer) queues a packet, submit() hands the queue to the
 *   socket — immediately, or batched with the packets around it when the
 *   client was created with output buffering. flush() always writes now;
 *   flush(cb) additionally invokes cb once everything queued before the call
 *   has been handed to the OS. 'drain' is emitted when a backpressured socket
 *   catches up and the queue is empty again.
 *
 * The buffering policy (see `bufferRequests` in docs/README.md) is:
 * batch until the batch reaches `maxSize`, until its oldest packet is
 * `maxDelay` ms old, until a request that expects a reply is sent, or until
 * the event loop is about to poll — whichever comes first. `shouldFlush`
 * overrides the middle two.
 */
function FrameBuffer(options) {
    EventEmitter.call(this);
    this._chunks = [];
    this._length = 0;
    this._offset = 0;
    this._readQueue = [];
    this.write_queue = []; // Buffers, and flush-callback sentinels between them
    this._socket = null;
    this._draining = false;
    // a transport with no writableLength is not a Node stream: it consumes
    // (or copies) what it is given before write() returns
    this._syncTransport = true;

    const policy = options === true ? {} : options;
    this._batching = !!policy;
    this._maxSize = DEFAULT_MAX_SIZE;
    this._maxDelay = DEFAULT_MAX_DELAY;
    this._flushOnReply = true;
    this._shouldFlush = null;
    if (policy && typeof policy === 'object') {
        if (policy.maxSize !== undefined)
            this._maxSize = positive(policy.maxSize, 'bufferRequests.maxSize');
        if (policy.maxDelay !== undefined) {
            if (typeof policy.maxDelay !== 'number' || policy.maxDelay < 0)
                throw new TypeError('bufferRequests.maxDelay must be a number of milliseconds');
            this._maxDelay = policy.maxDelay;
        }
        if (policy.flushOnReply !== undefined)
            this._flushOnReply = !!policy.flushOnReply;
        if (policy.shouldFlush !== undefined) {
            if (typeof policy.shouldFlush !== 'function')
                throw new TypeError('bufferRequests.shouldFlush must be a function');
            this._shouldFlush = policy.shouldFlush;
        }
    }
    this._ageMask = this._maxDelay >= 1 ? AGE_SAMPLE_MASK : 0;

    // the batch being filled: one reused buffer, never reallocated per packet
    this._out = null;
    this._used = 0;
    this._packets = 0;
    this._started = 0;
    this._pool = [];
    this._flushScheduled = false;

    this.stats = {
        packets: 0, // put() calls
        bytes: 0,   // bytes queued
        writes: 0,  // socket writes carrying data
        allocs: 0   // output buffers allocated
    };
}

Object.setPrototypeOf(FrameBuffer.prototype, EventEmitter.prototype);

/** Feed inbound data from the transport socket. */
FrameBuffer.prototype.write = function(buf) {
    this._chunks.push(buf);
    this._length += buf.length;
    this._pumpReads();
};

/**
 * Attach outbound writes to a duplex socket with drain/backpressure.
 * When write() returns false, further flush waits for 'drain'.
 */
FrameBuffer.prototype.attach = function(socket) {
    this._socket = socket;
    this._syncTransport = typeof socket.writableLength !== 'number';
    const self = this;
    socket.on('drain', () => {
        self._draining = false;
        self.flush();
        if (!self._draining)
            self.emit('drain');
    });
};

FrameBuffer.prototype.get = function(length, callback) {
    this._readQueue.push({
        length,
        callback,
        received: 0,
        data: length ? Buffer.alloc(length) : Buffer.alloc(0)
    });
    this._pumpReads();
};

FrameBuffer.prototype._pumpReads = function() {
    while (this._readQueue.length > 0) {
        const req = this._readQueue[0];
        if (req.length === 0) {
            this._readQueue.shift();
            req.callback(req.data);
            continue;
        }
        if (this._length < req.length - req.received)
            return;

        let need = req.length - req.received;
        while (need > 0) {
            const chunk = this._chunks[0];
            const available = chunk.length - this._offset;
            const take = Math.min(need, available);
            chunk.copy(req.data, req.received, this._offset, this._offset + take);
            req.received += take;
            this._offset += take;
            this._length -= take;
            need -= take;
            if (this._offset === chunk.length) {
                this._chunks.shift();
                this._offset = 0;
            }
        }
        this._readQueue.shift();
        req.callback(req.data);
    }
};

// A dedicated allocation, never the shared Buffer pool: this memory is handed
// to the socket and refilled afterwards, so it must not alias anything else.
FrameBuffer.prototype._takeBuffer = function() {
    const buf = this._pool.pop();
    if (buf)
        return buf;
    this.stats.allocs++;
    return Buffer.allocUnsafeSlow(this._maxSize);
};

FrameBuffer.prototype._recycle = function(buf) {
    if (this._pool.length < POOL_MAX)
        this._pool.push(buf);
};

/** Queue an outbound packet Buffer (built with Buffer.write*). */
FrameBuffer.prototype.put = function(buf) {
    if (!Buffer.isBuffer(buf))
        throw new TypeError('FrameBuffer.put expects a Buffer');
    this.stats.packets++;
    this.stats.bytes += buf.length;

    if (!this._batching) {
        this.write_queue.push(buf);
        return this;
    }

    // A packet that would fill the batch on its own (a big PutImage, a glyph
    // upload) is written as it is: copying it would cost more than the write
    // it saves.
    if (buf.length >= this._maxSize) {
        this.flush();
        this.write_queue.push(buf);
        this.flush();
        return this;
    }

    if (this._out !== null && buf.length > this._maxSize - this._used)
        this.flush(); // the batch is full: this is the size gate

    if (this._out === null)
        this._out = this._takeBuffer();
    if (this._used === 0) {
        this._packets = 0;
        this._started = this._maxDelay === Infinity && !this._shouldFlush ? 0 : monotonic();
    }
    buf.copy(this._out, this._used);
    this._used += buf.length;
    this._packets++;
    return this;
};

/**
 * Queue an outbound packet whose descriptors must travel as ancillary data
 * with its bytes (DRI3 PixmapFromBuffer, MIT-SHM AttachFd). The packet takes
 * the same ordered path through the queue as everything else — that is the
 * point: sequence numbers stay correct no matter what other requests are
 * issued around it. It is never merged into a batch buffer, because it must
 * reach the transport through sendFds() (one write per descriptor), not
 * write(). The descriptors are consumed by the transport once written.
 */
FrameBuffer.prototype.putWithFds = function(buf, fds) {
    if (!Buffer.isBuffer(buf))
        throw new TypeError('FrameBuffer.putWithFds expects a Buffer');
    this.stats.packets++;
    this.stats.bytes += buf.length;
    this._seal(); // bytes queued so far must stay ahead of this packet
    this.write_queue.push({ fdBuf: buf, fds });
    return this;
};

FrameBuffer.prototype._writeFdChunk = function(item) {
    this.stats.writes++;
    const sock = this._socket;
    const alive = () => !sock.destroyed && !sock.writableEnded;
    if (typeof sock.sendFds !== 'function') {
        // checked by the extension before queueing; can only happen when the
        // transport was swapped mid-flight. Honor the consumed-fds contract.
        const fs = require('fs');
        for (const fd of item.fds) {
            try { fs.closeSync(fd); } catch { /* ignore */ }
        }
        if (alive())
            sock.emit('error', new Error('transport cannot pass file descriptors'));
        return;
    }
    sock.sendFds(item.fdBuf, item.fds, err => {
        // a failed descriptor write poisons the connection like any failed
        // socket write; surface it there unless we are already tearing down
        if (err && alive())
            sock.emit('error', err);
    });
};

/**
 * A complete request has been put(): send it, now or with the packets around
 * it. Returns false when the socket applied backpressure — the caller should
 * stop producing until the client emits 'drain'.
 *
 * `expectsReply` marks a request whose caller is waiting for the server, so
 * the default policy sends it without waiting for more.
 */
FrameBuffer.prototype.submit = function(expectsReply) {
    if (!this._batching)
        return this.flush();
    if (this._used === 0 && this.write_queue.length === 0)
        return !this._draining;

    let flush;
    if (this._shouldFlush) {
        flush = this._shouldFlush({
            bytes: this._used,
            packets: this._packets,
            age: monotonic() - this._started,
            expectsReply: !!expectsReply
        });
        // undefined: no opinion, fall back to the built-in gates
        if (flush === undefined)
            flush = this._defaultGates(expectsReply);
    } else {
        flush = this._defaultGates(expectsReply);
    }

    if (flush)
        return this.flush();

    this._scheduleFlush();
    return !this._draining;
};

FrameBuffer.prototype._defaultGates = function(expectsReply) {
    if (expectsReply && this._flushOnReply)
        return true;
    if (this._maxDelay === Infinity || (this._packets & this._ageMask) !== 0)
        return false;
    return monotonic() - this._started >= this._maxDelay;
};

// Nothing may still be buffered when the event loop goes to poll for I/O.
FrameBuffer.prototype._scheduleFlush = function() {
    if (this._flushScheduled)
        return;
    this._flushScheduled = true;
    scheduleFlush(() => {
        this._flushScheduled = false;
        if (this._used > 0 || this.write_queue.length > 0)
            this.flush();
    });
};

// Move the batch to the write queue, giving up its buffer. Only needed when
// something must be queued behind it (a flush callback, an oversized packet,
// a socket that is backed up); the fast path writes the batch directly and
// keeps the buffer.
FrameBuffer.prototype._seal = function() {
    if (this._used === 0)
        return;
    this.write_queue.push(this._out.subarray(0, this._used));
    this._out = null;
    this._used = 0;
    this._packets = 0;
};

FrameBuffer.prototype._writeChunk = function(chunk, cb) {
    this.stats.writes++;
    const ok = this._socket.write(chunk, cb);
    if (!ok)
        this._draining = true;
    return ok;
};

// Fire a flush callback once everything written before it has reached the OS.
FrameBuffer.prototype._notify = function(cb) {
    if (!this._socket || this._syncTransport || this._socket.writableLength === 0)
        queueMicrotask(cb);
    else
        this._socket.write(EMPTY, cb);
};

// Write queued items in order; returns false if the socket backed up.
FrameBuffer.prototype._drainQueue = function() {
    while (this.write_queue.length > 0) {
        const head = this.write_queue[0];
        if (typeof head === 'function') {
            this._notify(this.write_queue.shift());
            continue;
        }
        if (!Buffer.isBuffer(head)) { // fd-carrying packet from putWithFds
            this._writeFdChunk(this.write_queue.shift());
            continue;
        }
        if (!this._writeChunk(this.write_queue.shift()))
            return false;
    }
    return true;
};

/**
 * Write everything buffered so far. Returns false when the socket applied
 * backpressure (the rest is sent on 'drain'). An optional callback fires once
 * all data queued up to this call has been handed to the OS.
 */
FrameBuffer.prototype.flush = function(doneCb) {
    if (doneCb !== undefined && typeof doneCb !== 'function')
        throw new TypeError('FrameBuffer.flush expects a callback function');

    if (!this._socket) {
        // detached: hand everything to 'data' listeners in order (an
        // fd-carrying packet passes its descriptors as a second argument)
        this._seal();
        while (this.write_queue.length > 0) {
            const item = this.write_queue.shift();
            if (typeof item === 'function')
                queueMicrotask(item);
            else if (Buffer.isBuffer(item))
                this.emit('data', item);
            else
                this.emit('data', item.fdBuf, item.fds);
        }
        if (doneCb)
            queueMicrotask(doneCb);
        return true;
    }

    if (this._draining || !this._drainQueue()) {
        // socket is backed up: everything goes to the queue, in order
        this._seal();
        if (doneCb)
            this.write_queue.push(doneCb);
        return false;
    }

    if (this._used > 0) {
        // hand the batch to the socket and refill the buffer once the socket
        // is done with it — no reallocation per flush, let alone per request
        const owner = this._out;
        const chunk = this._used === this._maxSize ? owner : owner.subarray(0, this._used);
        this._out = null;
        this._used = 0;
        this._packets = 0;
        const ok = this._writeChunk(chunk, () => this._recycle(owner));
        if (!ok) {
            if (doneCb)
                this.write_queue.push(doneCb);
            return false;
        }
    }

    if (doneCb)
        this._notify(doneCb);
    return true;
};

module.exports = FrameBuffer;
