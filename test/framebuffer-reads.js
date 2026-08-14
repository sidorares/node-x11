const assert = require('assert');
const FrameBuffer = require('../lib/framebuffer');

// The inbound half of lib/framebuffer.js: exact-length get(n, cb) reads served
// from the accumulated chunks. Everything on top of it reads as a chain of
// continuations - the callback that consumes one packet arms the read for the
// next - so what matters is that one chunk carrying a lot of them is drained
// by the loop that is already running instead of one nested call per read.

describe('FrameBuffer inbound reads', () => {

    // deep enough that the old recursive path ran out of stack: it gave up
    // around 1900 chained reads on a default V8 stack (#276)
    const BURST = 5000;

    function counted(n) {
        const chunk = Buffer.alloc(n * 4);
        for (let i = 0; i < n; i++)
            chunk.writeUInt32LE(i, i * 4);
        return chunk;
    }

    it('drains thousands of chained reads from one chunk without nesting', () => {
        const fb = new FrameBuffer();
        const seen = [];
        let depth = 0;
        let maxDepth = 0;

        // the shape of both readers in the library: lib/xserver/server.js
        // (request header -> body -> next header) and lib/xcore.js
        // (packet header -> body -> next header)
        const arm = () => fb.get(4, buf => {
            if (++depth > maxDepth)
                maxDepth = depth;
            seen.push(buf.readUInt32LE(0));
            arm();
            depth--;
        });
        arm();

        fb.write(counted(BURST));

        assert.deepStrictEqual(seen, Array.from({ length: BURST }, (_, i) => i));
        assert.strictEqual(maxDepth, 1,
            'every read was served by the drain loop, not from inside the previous callback');
    });

    it('serves reads queued up front in queue order', () => {
        // the handshake queues a read per pixmap format / depth / visual
        // before any of them can be served
        const fb = new FrameBuffer();
        const seen = [];
        for (let i = 0; i < BURST; i++)
            fb.get(4, buf => seen.push(buf.readUInt32LE(0)));

        fb.write(counted(BURST));

        assert.deepStrictEqual(seen, Array.from({ length: BURST }, (_, i) => i));
    });

    it('runs a read queued from a callback after that callback returns', () => {
        const fb = new FrameBuffer();
        const order = [];
        fb.get(2, () => {
            order.push('header');
            fb.get(2, () => order.push('body'));
            order.push('rest of header callback');
        });

        fb.write(Buffer.from([1, 2, 3, 4]));

        assert.deepStrictEqual(order, ['header', 'rest of header callback', 'body']);
    });

    it('picks up data written from inside a callback', () => {
        const fb = new FrameBuffer();
        const seen = [];
        fb.get(1, first => {
            seen.push(first[0]);
            fb.get(1, second => seen.push(second[0]));
            fb.write(Buffer.from([2])); // arrives while the drain is running
        });

        fb.write(Buffer.from([1]));

        assert.deepStrictEqual(seen, [1, 2]);
    });

    it('completes a read split across chunks', () => {
        const fb = new FrameBuffer();
        let got = null;
        fb.get(6, buf => got = buf);

        fb.write(Buffer.from([1, 2]));
        assert.strictEqual(got, null, 'not enough bytes yet');
        fb.write(Buffer.from([3, 4, 5]));
        assert.strictEqual(got, null, 'still short by one byte');
        fb.write(Buffer.from([6, 7]));

        assert.deepStrictEqual(got, Buffer.from([1, 2, 3, 4, 5, 6]));

        let tail = null;
        fb.get(1, buf => tail = buf);
        assert.deepStrictEqual(tail, Buffer.from([7]), 'the leftover byte stayed buffered');
    });
});
