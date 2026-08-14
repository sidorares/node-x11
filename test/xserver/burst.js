const assert = require('assert');
const x11 = require('../../lib');
const { createServer, createStreamPair } = require('../../lib/xserver');
const { boot, sync } = require('./boot');

// A frame's worth of requests leaves the client in one flush and arrives at
// the server as one chunk; a burst of events makes the same trip the other
// way. Both readers used to recurse once per packet in the chunk and ran out
// of stack a couple of thousand packets in (#276).

describe('xserver: packet bursts arriving in one chunk', () => {

    // 4-byte requests, 32-byte events: well past where the recursion died,
    // and small enough that a burst is a few chunks, not a few thousand
    const BURST = 5000;

    it('handles thousands of requests written as one chunk', done => {
        // buffering is what puts them all in one write: unbuffered, each
        // request is its own chunk and nothing queues up behind it
        boot({ clientOptions: { bufferRequests: true } }, (err, ctx) => {
            if (err) return done(err);
            const { server, X } = ctx;
            const handlerErrors = [];
            server.on('handlerError', e => handlerErrors.push(e));

            // no-ops in this server, and the two smallest requests there are
            for (let i = 0; i < BURST; i++) {
                X.GrabServer();
                X.UngrabServer();
            }
            X.flush();

            // the reply can only reach this callback if the server got through
            // every request before it - its sequence number says how many
            sync(X, err2 => {
                X.terminate();
                if (err2) return done(err2);
                assert.deepStrictEqual(handlerErrors, []);
                done();
            });
        });
    });

    it('dispatches thousands of events written as one chunk', done => {
        const server = createServer();
        const [clientSide, serverSide] = createStreamPair();
        server.addClientStream(serverSide);
        x11.createClient({ display: ':9', stream: clientSide }, (err, display) => {
            if (err) return done(err);
            const X = display.client;
            let seen = 0;
            X.on('event', ev => {
                assert.strictEqual(ev.name, 'Expose');
                assert.strictEqual(ev.x, seen % 0x10000);
                if (++seen === BURST) {
                    X.terminate();
                    done();
                }
            });

            const events = [];
            for (let i = 0; i < BURST; i++)
                events.push(x11.packEvent({
                    name: 'Expose', wid: 1, x: i % 0x10000, y: 0,
                    width: 1, height: 1, count: 0
                }));
            // the stream pair hands over exactly what is written, so this is
            // one chunk - the same thing a socket does when it coalesces
            serverSide.write(Buffer.concat(events));
        });
    });
});
