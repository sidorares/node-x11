'use strict';

const { EventEmitter } = require('events');

// In-process duplex stream pair: what one side writes, the other receives as
// 'data'. Mirrors the subset of net.Socket the client and server rely on
// (write/end/destroy + 'data'/'end'/'error' events, always-drained writes).
// Delivery is async (setImmediate) so protocol code never re-enters itself.

class PairedStream extends EventEmitter {
    constructor() {
        super();
        this.peer = null;
        this.destroyed = false;
    }

    write(buf) {
        const peer = this.peer;
        if (this.destroyed || !peer || peer.destroyed)
            return true;
        setImmediate(() => {
            if (!peer.destroyed)
                peer.emit('data', buf);
        });
        return true;
    }

    end() {
        const peer = this.peer;
        this.destroyed = true;
        if (peer && !peer.destroyed)
            setImmediate(() => {
                if (!peer.destroyed)
                    peer.emit('end');
            });
    }

    destroy() {
        this.end();
    }
}

module.exports.createStreamPair = () => {
    const a = new PairedStream();
    const b = new PairedStream();
    a.peer = b;
    b.peer = a;
    return [a, b];
};
