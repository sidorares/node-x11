'use strict';

// Duplex-stream adapter over a MessagePort (or anything postMessage-shaped:
// Worker, window with targetOrigin bound). Lets an X client in one browsing
// context talk to the JS X server in another. Wire data crosses as
// ArrayBuffer transfers; control messages are { type: 'x11-end' }.
//
// Both the client (`x11.createClient({ stream })` or a registered display
// protocol) and the server (`server.addClientStream(stream)`) accept this
// object: it implements write()/end() + 'data'/'end' events.

const { EventEmitter } = require('events');
const { Buffer } = require('buffer');

class MessagePortStream extends EventEmitter {
    constructor(port) {
        super();
        this.port = port;
        this.destroyed = false;
        port.onmessage = ev => {
            const msg = ev.data;
            if (msg && msg.type === 'x11-end') {
                this.destroyed = true;
                this.emit('end');
                return;
            }
            if (msg && msg.type === 'x11-data')
                // Buffer view over the transferred ArrayBuffer: zero-copy
                this.emit('data', Buffer.from(msg.data));
        };
        if (port.start)
            port.start();
    }

    write(buf) {
        if (this.destroyed)
            return true;
        // copy: the source Buffer may be reused/pooled by the sender
        const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
        this.port.postMessage({ type: 'x11-data', data: copy }, [copy]);
        return true;
    }

    end() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.port.postMessage({ type: 'x11-end' });
        if (this.port.close)
            this.port.close();
    }

    destroy() {
        this.end();
    }
}

module.exports = { MessagePortStream };
