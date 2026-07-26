const assert = require('assert');
const { createServer, createStreamPair } = require('../../lib/xserver');
const { boot } = require('./boot');

describe('xserver: connection setup', () => {

    it('serves a parseable setup block with the advertised screen', done => {
        boot({ serverOptions: { width: 640, height: 480 } }, (err, ctx) => {
            if (err) return done(err);
            const d = ctx.display;
            assert.strictEqual(d.major, 11);
            assert.strictEqual(d.vendor, 'node-x11 js server');
            assert.strictEqual(d.image_byte_order, 0);          // LSBFirst
            assert.strictEqual(d.bitmap_scanline_pad, 32);
            assert.strictEqual(d.min_keycode, 8);
            assert.strictEqual(d.max_keycode, 255);
            assert.strictEqual(d.screen.length, 1);
            const scr = d.screen[0];
            assert.strictEqual(scr.root, ctx.server.root.id);
            assert.strictEqual(scr.root_depth, 24);
            assert.strictEqual(scr.pixel_width, 640);
            assert.strictEqual(scr.pixel_height, 480);
            assert.strictEqual(scr.white_pixel, 0xffffff);
            assert.strictEqual(scr.black_pixel, 0);
            assert.strictEqual(d.format[24].bits_per_pixel, 32);
            assert.strictEqual(d.format[24].scanline_pad, 32);
            const visual = scr.depths[24][scr.root_visual];
            assert.strictEqual(visual.class, 4);                // TrueColor
            assert.strictEqual(visual.red_mask, 0xff0000);
            assert.strictEqual(visual.green_mask, 0x00ff00);
            assert.strictEqual(visual.blue_mask, 0x0000ff);
            ctx.X.terminate();
            done();
        });
    });

    it('enables BIG-REQUESTS during createClient and reports 4MB max length', done => {
        boot((err, ctx) => {
            if (err) return done(err);
            assert.strictEqual(ctx.display.max_request_length, 0x100000);
            ctx.X.terminate();
            done();
        });
    });

    it('gives every client a distinct resource base', done => {
        const server = createServer();
        boot({ server }, (err, a) => {
            if (err) return done(err);
            boot({ server }, (err2, b) => {
                if (err2) return done(err2);
                assert.strictEqual(a.display.resource_mask, 0x1fffff);
                assert.strictEqual(b.display.resource_mask, 0x1fffff);
                assert.notStrictEqual(a.display.resource_base, b.display.resource_base);
                assert.strictEqual((a.display.resource_base & 0x1fffff), 0);
                assert.strictEqual((b.display.resource_base & 0x1fffff), 0);
                a.X.terminate();
                b.X.terminate();
                done();
            });
        });
    });

    it('listen() accepts real TCP connections on 6000+displayNum', done => {
        const x11 = require('../../lib');
        const server = createServer();
        const displayNum = 199;
        const netServer = server.listen(displayNum, () => {
            x11.createClient({
                display: `tcp/localhost:${displayNum}`,
                auth: { name: '', data: '' }
            }, (err, display) => {
                try {
                    assert.ifError(err);
                    assert.strictEqual(display.vendor, 'node-x11 js server');
                    display.client.terminate();
                } catch (e) {
                    netServer.close();
                    return done(e);
                }
                netServer.close(() => done());
            });
        });
    });

    it('rejects big-endian handshakes with a setup-failed block', done => {
        const server = createServer();
        const [clientSide, serverSide] = createStreamPair();
        server.addClientStream(serverSide);
        const chunks = [];
        clientSide.on('data', data => {
            chunks.push(data);
            const buf = Buffer.concat(chunks);
            if (buf.length < 8)
                return;
            assert.strictEqual(buf.readUInt8(0), 0);            // Failed
            const reasonLen = buf.readUInt8(1);
            assert.strictEqual(buf.readUInt16LE(2), 11);        // protocol major
            const extraWords = buf.readUInt16LE(6);
            if (buf.length < 8 + extraWords * 4)
                return;
            const reason = buf.toString('latin1', 8, 8 + reasonLen);
            assert.ok(/little-endian/.test(reason), reason);
            done();
        });
        const hello = Buffer.alloc(12);
        hello.writeUInt8('B'.charCodeAt(0), 0);
        hello.writeUInt16BE(11, 2);
        clientSide.write(hello);
    });
});
