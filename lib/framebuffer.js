'use strict';

const { EventEmitter } = require('events');

/**
 * Bidirectional X11 framing buffer.
 * - Inbound: accumulate socket chunks; satisfy exact-length get(n, cb) reads.
 * - Outbound: put(Buffer) queues packets; flush() writes with drain/backpressure.
 */
function FrameBuffer() {
    EventEmitter.call(this);
    this._chunks = [];
    this._length = 0;
    this._offset = 0;
    this._readQueue = [];
    this.write_queue = [];
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

FrameBuffer.prototype.flush = function() {
    if (this._draining)
        return;

    if (this._socket) {
        while (this.write_queue.length > 0) {
            const buf = this.write_queue.shift();
            const ok = this._socket.write(buf);
            if (!ok) {
                this._draining = true;
                return;
            }
        }
        return;
    }

    while (this.write_queue.length > 0)
        this.emit('data', this.write_queue.shift());
};

module.exports = FrameBuffer;
