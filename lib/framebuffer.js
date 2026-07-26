'use strict';

const { EventEmitter } = require('events');

const EMPTY = Buffer.alloc(0);

/**
 * Bidirectional X11 framing buffer.
 * - Inbound: accumulate socket chunks; satisfy exact-length get(n, cb) reads.
 * - Outbound: put(Buffer) queues packets; flush() writes with drain/backpressure.
 *   flush(cb) additionally invokes cb once everything queued before the call
 *   has been handed to the OS. 'drain' is emitted when a backpressured socket
 *   catches up and the queue is empty again.
 */
function FrameBuffer() {
    EventEmitter.call(this);
    this._chunks = [];
    this._length = 0;
    this._offset = 0;
    this._readQueue = [];
    this.write_queue = []; // Buffers, and flush-callback sentinels between them
    this._socket = null;
    this._draining = false;
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

/** Queue an outbound packet Buffer (built with Buffer.write*). */
FrameBuffer.prototype.put = function(buf) {
    if (!Buffer.isBuffer(buf))
        throw new TypeError('FrameBuffer.put expects a Buffer');
    this.write_queue.push(buf);
    return this;
};

/**
 * Write the queue out. Returns false when the socket applied backpressure
 * (remaining data is sent on 'drain'). An optional callback fires once all
 * data queued up to this call has been handed to the OS.
 */
FrameBuffer.prototype.flush = function(doneCb) {
    if (doneCb) {
        if (typeof doneCb !== 'function')
            throw new TypeError('FrameBuffer.flush expects a callback function');
        this.write_queue.push(doneCb);
    }

    if (this._draining)
        return false;

    if (this._socket) {
        while (this.write_queue.length > 0) {
            const item = this.write_queue.shift();
            if (typeof item === 'function') {
                // everything before this sentinel is inside the socket;
                // fire once it reaches the OS
                if (this._socket.writableLength === 0)
                    queueMicrotask(item);
                else
                    this._socket.write(EMPTY, item);
                continue;
            }
            const ok = this._socket.write(item);
            if (!ok) {
                this._draining = true;
                return false;
            }
        }
        return true;
    }

    while (this.write_queue.length > 0) {
        const item = this.write_queue.shift();
        if (typeof item === 'function')
            queueMicrotask(item);
        else
            this.emit('data', item);
    }
    return true;
};

module.exports = FrameBuffer;
