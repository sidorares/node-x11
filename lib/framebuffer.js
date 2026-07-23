'use strict';

const { EventEmitter } = require('events');
const xutil = require('./xutil');

const argument_length = {
    C: 1,
    S: 2,
    s: 2,
    L: 4,
    l: 4,
    x: 1
};

/**
 * Bidirectional X11 framing buffer.
 * - Inbound: accumulate socket chunks; satisfy exact-length get(n, cb) reads.
 * - Outbound: pack(format, args) builds Buffers; flush() writes with drain/backpressure.
 * Format pack is kept for corereqs/extension templates; protocol field parsing uses Buffer.read*.
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

FrameBuffer.prototype.pack = function(format, args) {
    let packetlength = 0;
    let arg = 0;
    for (let i = 0; i < format.length; ++i) {
        const f = format[i];
        if (f === 'x') {
            packetlength++;
        } else if (f === 'p') {
            packetlength += xutil.padded_length(args[arg++].length);
        } else if (f === 'a') {
            packetlength += args[arg++].length;
        } else {
            packetlength += argument_length[f];
            arg++;
        }
    }

    const buf = Buffer.alloc(packetlength);
    let offset = 0;
    arg = 0;
    for (let i = 0; i < format.length; ++i) {
        switch (format[i]) {
            case 'x':
                buf[offset++] = 0;
                break;
            case 'C':
                buf.writeUInt8(args[arg++] & 0xff, offset++);
                break;
            case 's':
                buf.writeInt16LE(args[arg++], offset);
                offset += 2;
                break;
            case 'S':
                buf.writeUInt16LE(args[arg++] & 0xffff, offset);
                offset += 2;
                break;
            case 'l':
                buf.writeInt32LE(args[arg++], offset);
                offset += 4;
                break;
            case 'L':
                buf.writeUInt32LE(args[arg++] >>> 0, offset);
                offset += 4;
                break;
            case 'a': {
                const str = args[arg++];
                if (Buffer.isBuffer(str)) {
                    str.copy(buf, offset);
                    offset += str.length;
                } else if (Array.isArray(str)) {
                    for (const item of str)
                        buf[offset++] = item;
                } else {
                    buf.write(str, offset, str.length, 'latin1');
                    offset += str.length;
                }
                break;
            }
            case 'p': {
                const str = args[arg++];
                const len = xutil.padded_length(str.length);
                if (Buffer.isBuffer(str)) {
                    str.copy(buf, offset, 0, str.length);
                } else {
                    buf.write(str, offset, str.length, 'latin1');
                }
                // remainder already zero from Buffer.alloc
                offset += len;
                break;
            }
        }
    }
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

    // EventEmitter fallback (callers listening on 'data')
    while (this.write_queue.length > 0)
        this.emit('data', this.write_queue.shift());
};

module.exports = FrameBuffer;
