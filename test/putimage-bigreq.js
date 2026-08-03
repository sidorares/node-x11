const x11 = require('../lib');
const should = require('should');

// PutImage (and RENDER AddGlyphs) used to always emit the BIG-REQUESTS length
// encoding — length field 0 followed by a CARD32 — which a server only accepts
// once BIG-REQUESTS has been enabled. A connection created with
// `disableBigRequests: true` therefore sent a request the server read as
// zero-length and rejected with "Bad length". These tests exercise both a
// normal connection and one with BIG-REQUESTS disabled, at sizes that do and
// do not fit the 16-bit length field.

function withClient(options, fn, done) {
    x11.createClient(options, (err, dpy) => {
        should.not.exist(err);
        const X = dpy.client;
        fn(X, dpy, () => {
            X.terminate();
            X.on('end', done);
        });
    });
}

// PutImage a gradient into a fresh pixmap and read it back; the pixels must
// survive the round trip, which they only do if the request encoding is valid.
function putGetRoundTrip(X, dpy, w, h, finish) {
    const scr = dpy.screen[0];
    const depth = scr.root_depth;
    const pid = X.AllocID();
    const gc = X.AllocID();
    X.CreatePixmap(pid, scr.root, depth, w, h);
    X.CreateGC(gc, pid);
    const bytes = w * h * 4;
    const src = Buffer.alloc(bytes);
    for (let i = 0; i < bytes; i++) src[i] = (i * 37 + 11) & 0xff;
    X.PutImage(2, pid, gc, w, h, 0, 0, 0, depth, src);
    X.GetImage(2, pid, 0, 0, w, h, 0xffffffff, (err, img) => {
        should.not.exist(err);
        let bad = 0;
        for (let i = 0; i < bytes; i += 4) {
            if (img.data[i] !== src[i] ||
                img.data[i + 1] !== src[i + 1] ||
                img.data[i + 2] !== src[i + 2]) bad++;
        }
        bad.should.equal(0);
        X.FreeGC(gc);
        X.FreePixmap(pid);
        finish();
    });
}

describe('PutImage request encoding', () => {
    it('round-trips a small image on a normal connection', function(done) {
        withClient({}, (X, dpy, close) => {
            putGetRoundTrip(X, dpy, 64, 64, close);
        }, done);
    });

    it('round-trips a small image with BIG-REQUESTS disabled', function(done) {
        // the regression: this used to fail with "Bad length"
        withClient({ disableBigRequests: true }, (X, dpy, close) => {
            putGetRoundTrip(X, dpy, 64, 64, close);
        }, done);
    });

    it('round-trips a ~196 KB image (still under the 16-bit length) without BIG-REQUESTS', function(done) {
        // 224*224*4 = ~196 KB, request length ~49155 words < 65535
        withClient({ disableBigRequests: true }, (X, dpy, close) => {
            putGetRoundTrip(X, dpy, 224, 224, close);
        }, done);
    });

    it('round-trips a >256 KB image (needs the BIG-REQUESTS encoding) on a normal connection', function(done) {
        // 512*512*4 = 1 MB, request length > 65535 words -> BigReq encoding
        withClient({}, (X, dpy, close) => {
            putGetRoundTrip(X, dpy, 512, 512, close);
        }, done);
    });
});

// The same unconditional-BigReq encoding lived in RENDER AddGlyphs; a small
// glyph upload must be accepted with BIG-REQUESTS disabled too. Upload a glyph
// and round-trip: a malformed request would come back as a "Bad length" error
// against the AddGlyphs sequence number.
describe('RENDER AddGlyphs request encoding', () => {
    it('uploads a small glyph with BIG-REQUESTS disabled', function(done) {
        withClient({ disableBigRequests: true }, (X, dpy, close) => {
            let xerr = null;
            X.on('error', err => { xerr = err; });
            X.require('render', (err, render) => {
                should.not.exist(err);
                const gsid = X.AllocID();
                render.CreateGlyphSet(gsid, render.a8);
                // a 4x4 fully-opaque glyph, origin at its lower-left
                render.AddGlyphs(gsid, [{
                    id: 65, width: 4, height: 4, x: 0, y: 4,
                    offX: 4 * 64, offY: 0, image: Buffer.alloc(16, 255)
                }]);
                // force a round trip so any error against the AddGlyphs request
                // has been delivered before we assert
                X.GetInputFocus(() => {
                    should.not.exist(xerr);
                    render.FreeGlyphSet(gsid);
                    close();
                });
            });
        }, done);
    });
});
