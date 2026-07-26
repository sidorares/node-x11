const assert = require('assert');
const { boot } = require('./boot');

describe('xserver: BIG-REQUESTS', () => {

    let server, display, X, root;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            done();
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = null;
    });

    it('QueryExtension resolves and Enable reports the 4MB limit', done => {
        X.QueryExtension('BIG-REQUESTS', (err, ext) => {
            if (err) return done(err);
            assert.strictEqual(ext.present, 1);
            assert.ok(ext.majorOpcode >= 128);
            // already enabled during createClient
            assert.strictEqual(display.max_request_length, 0x100000);
            done();
        });
    });

    it('a PutImage larger than the core 256KB limit round-trips', done => {
        const W = 300, H = 300;
        const data = Buffer.alloc(W * H * 4);
        for (let i = 0; i < W * H; i++)
            data.writeUInt32LE((i * 31) & 0xffffff, i * 4);
        assert.ok(28 + data.length > 262140, 'request must exceed the 16-bit length form');

        const pixmap = X.AllocID();
        X.CreatePixmap(pixmap, root, 24, W, H);
        const gc = X.AllocID();
        X.CreateGC(gc, pixmap, {});
        // the client always uses the extended-length form for PutImage
        X.PutImage(2, pixmap, gc, W, H, 0, 0, 0, 24, data);
        X.GetImage(2, pixmap, 0, 0, W, H, 0xffffffff, (err, img) => {
            if (err) return done(err);
            assert.strictEqual(img.data.length, W * H * 4);
            assert.ok(img.data.equals(data), 'all pixels intact after big-request framing');
            // framing still aligned: a small request works after the big one
            X.GetGeometry(pixmap, (err2, g) => {
                if (err2) return done(err2);
                assert.strictEqual(g.width, W);
                done();
            });
        });
    });

    it('XC-MISC works via the client extension module', done => {
        X.require('xc-misc', (err, xcmisc) => {
            if (err) return done(err);
            assert.strictEqual(xcmisc.major, 1);
            assert.strictEqual(xcmisc.minor, 1);
            xcmisc.GetXIDRange((err2, range) => {
                if (err2) return done(err2);
                assert.strictEqual(range.startId, display.resource_base + 1);
                assert.ok(range.count > 0);
                xcmisc.GetXIDList(4, (err3, ids) => {
                    if (err3) return done(err3);
                    assert.strictEqual(ids.length, 4);
                    assert.strictEqual(ids[0], display.resource_base + 1);
                    done();
                });
            });
        });
    });
});
