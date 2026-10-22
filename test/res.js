const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('X-Resource extension', () => {
    let display, X, root, depth, bytesPP, res, pixmap;

    const W = 50;
    const H = 40;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            display = dpy;
            X = dpy.client;
            root = dpy.screen[0].root;
            depth = dpy.screen[0].root_depth;
            bytesPP = depth <= 8 ? 1 : (depth <= 16 ? 2 : 4);
            X.require('res', (err, ext) => {
                assert.ifError(err);
                res = ext;
                done();
            });
        });

        client.on('error', done);
    });

    it('QueryVersion should report at least 1.0', function() {
        assert.ok(res.major >= 1);
        assert.ok(res.minor >= 0);
    });

    it('QueryClients should include our own client XID range', function(t, done) {
        res.QueryClients((err, clients) => {
            assert.ifError(err);
            assert.ok(clients.length > 0);
            const mine = clients.filter(c => c.resourceBase === display.resource_base);
            assert.strictEqual(mine.length, 1);
            assert.strictEqual(mine[0].resourceMask, display.resource_mask);
            done();
        });
    });

    it('QueryClientResources should report a PIXMAP count increase after CreatePixmap', function(t, done) {
        const PIXMAP = 20; // predefined PIXMAP atom
        const countPixmaps = types => {
            const entry = types.filter(t => t.resourceType === PIXMAP)[0];
            return entry ? entry.count : 0;
        };
        res.QueryClientResources(display.resource_base, (err, typesBefore) => {
            assert.ifError(err);
            const before = countPixmaps(typesBefore);
            pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, depth, W, H);
            res.QueryClientResources(display.resource_base, (err, typesAfter) => {
                assert.ifError(err);
                assert.strictEqual(countPixmaps(typesAfter), before + 1);
                done();
            });
        });
    });

    it('QueryClientPixmapBytes should grow by at least the size of a new pixmap', function(t, done) {
        res.QueryClientPixmapBytes(display.resource_base, (err, bytesBefore) => {
            assert.ifError(err);
            const pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, depth, W, H);
            res.QueryClientPixmapBytes(display.resource_base, (err, bytesAfter) => {
                assert.ifError(err);
                // scanlines may be padded, so at least the unpadded size
                assert.ok((bytesAfter - bytesBefore) >= (W * H * bytesPP));
                X.FreePixmap(pixmap);
                done();
            });
        });
    });

    it('QueryClientIds should return our own process id (1.2)', function(t, done) {
        if (res.major === 1 && res.minor < 2) {
            t.skip(); // server doesn't speak X-Resource 1.2
            return done();
        }
        res.QueryClientIds([{
            client: display.resource_base,
            mask: res.ClientIdMask.LocalClientPID
        }], (err, ids) => {
            assert.ifError(err);
            assert.strictEqual(ids.length, 1);
            assert.strictEqual(ids[0].mask, 2);
            assert.deepStrictEqual(ids[0].value, [process.pid]);
            done();
        });
    });

    it('QueryResourceBytes should report the size of a known pixmap (1.2)', function(t, done) {
        if (res.major === 1 && res.minor < 2) {
            t.skip(); // server doesn't speak X-Resource 1.2
            return done();
        }
        res.QueryResourceBytes(0, [{ resource: pixmap, type: 0 }], (err, sizes) => {
            assert.ifError(err);
            assert.ok(sizes.length >= 1);
            const mine = sizes.filter(s => s.resource === pixmap)[0];
            assert.ok(mine != null);
            assert.strictEqual(mine.type, 20); // PIXMAP atom
            assert.ok(mine.bytes >= (W * H * bytesPP));
            assert.ok(mine.refCount >= 1);
            assert.ok(Array.isArray(mine.crossReferences));
            done();
        });
    });

    after(function(t, done) {
        if (pixmap)
            X.FreePixmap(pixmap);
        X.terminate();
        X.on('end', done);
    });
});
