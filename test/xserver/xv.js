// XVideo image path against the JS X server with a test adaptor
// (xv-adaptor.js). Xvfb and XQuartz advertise Xv with zero adaptors, so this
// is the only place the client's PutImage/ShmPutImage/QueryImageAttributes
// and the VideoNotify/PortNotify parsers are driven end to end; test/xv.js
// covers what a real (adaptorless) server can answer.
const assert = require('assert');
const xserver = require('../../lib/xserver');
const { boot, sync } = require('./boot');
const createXvAdaptor = require('./xv-adaptor');

const YUY2 = 0x32595559;
const I420 = 0x30323449;

// BT.601 limited range, the same colours a hardware adaptor would produce
const COLORS = {
    black: { yuv: [16, 128, 128], rgb: [0, 0, 0] },
    white: { yuv: [235, 128, 128], rgb: [255, 255, 255] },
    red: { yuv: [81, 90, 240], rgb: [255, 0, 0] },
    green: { yuv: [145, 54, 34], rgb: [0, 255, 0] },
    blue: { yuv: [41, 240, 110], rgb: [0, 0, 255] }
};

// pack width x height of per-pixel [y, u, v] into the format's plane layout
function packFrame(format, plane, pixels, width, height) {
    const data = Buffer.alloc(plane.dataSize);
    const at = (x, y) => pixels[Math.min(y, height - 1) * width + Math.min(x, width - 1)];
    if (format === YUY2) {
        for (let y = 0; y < plane.height; y++)
            for (let x = 0; x < plane.width; x += 2) {
                const a = at(x, y), b = at(x + 1, y);
                const o = plane.offsets[0] + y * plane.pitches[0] + (x >> 1) * 4;
                data[o] = a[0];
                data[o + 1] = (a[1] + b[1]) >> 1;
                data[o + 2] = b[0];
                data[o + 3] = (a[2] + b[2]) >> 1;
            }
        return data;
    }
    for (let y = 0; y < plane.height; y++)
        for (let x = 0; x < plane.width; x++)
            data[plane.offsets[0] + y * plane.pitches[0] + x] = at(x, y)[0];
    for (let y = 0; y < plane.height >> 1; y++)
        for (let x = 0; x < plane.width >> 1; x++) {
            data[plane.offsets[1] + y * plane.pitches[1] + x] = at(x * 2, y * 2)[1];
            data[plane.offsets[2] + y * plane.pitches[2] + x] = at(x * 2, y * 2)[2];
        }
    return data;
}

// a frame of one flat colour
function solidFrame(format, plane, color, width, height) {
    const pixels = new Array(width * height).fill(COLORS[color].yuv);
    return packFrame(format, plane, pixels, width, height);
}

function assertColor(actual, name, where) {
    const [r, g, b] = COLORS[name].rgb;
    const got = [(actual >> 16) & 0xff, (actual >> 8) & 0xff, actual & 0xff];
    // the adaptor converts in 8-bit fixed point, so allow a channel of slack
    for (let i = 0; i < 3; i++)
        assert.ok(Math.abs(got[i] - [r, g, b][i]) <= 3,
            `${where}: expected ${name} (${r},${g},${b}), got (${got})`);
}

describe('xserver: XVideo image path', function() {
    this.timeout(20000);

    let server, display, X, root, adaptor, xv, port, pixmap, gc;
    const W = 16, H = 16;

    beforeEach(done => {
        adaptor = createXvAdaptor();
        server = xserver.createServer({ width: 256, height: 256 });
        server.registerExtension('XVideo', adaptor);
        boot({ server }, (err, ctx) => {
            if (err) return done(err);
            ({ display, X } = ctx);
            root = display.screen[0].root;
            pixmap = X.AllocID();
            X.CreatePixmap(pixmap, root, 24, W, H);
            gc = X.AllocID();
            X.CreateGC(gc, pixmap, { foreground: 0, background: 0 });
            X.PolyFillRectangle(pixmap, gc, [0, 0, W, H]);
            X.require('xv', (err, ext) => {
                if (err) return done(err);
                xv = ext;
                xv.QueryAdaptors(root, (err, adaptors) => {
                    if (err) return done(err);
                    port = adaptors[0].baseId;
                    done();
                });
            });
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = xv = null;
    });

    function readBack(drawable, w, h, cb) {
        X.GetImage(2, drawable, 0, 0, w, h, 0xffffffff, (err, img) => {
            assert.ifError(err);
            cb((x, y) => img.data.readUInt32LE((y * w + x) * 4));
        });
    }

    it('advertises an image adaptor with two formats', done => {
        assert.strictEqual(xv.major, 2);
        assert.strictEqual(xv.minor, 2);
        xv.QueryAdaptors(root, (err, adaptors) => {
            assert.ifError(err);
            assert.strictEqual(adaptors.length, 1);
            assert.strictEqual(adaptors[0].name, 'JS Test Video');
            assert.strictEqual(adaptors[0].numPorts, 2);
            assert.ok(adaptors[0].type & xv.Type.ImageMask);
            xv.ListImageFormats(port, (err, formats) => {
                assert.ifError(err);
                assert.deepStrictEqual(formats.map(f => f.id), [YUY2, I420]);
                assert.strictEqual(formats[0].bpp, 16);
                assert.strictEqual(formats[0].numPlanes, 1);
                assert.strictEqual(formats[0].format, xv.ImageFormatInfoFormat.Packed);
                assert.strictEqual(formats[0].compOrder, 'YUYV');
                assert.strictEqual(formats[0].guid.length, 16);
                assert.strictEqual(formats[1].bpp, 12);
                assert.strictEqual(formats[1].numPlanes, 3);
                assert.strictEqual(formats[1].format, xv.ImageFormatInfoFormat.Planar);
                assert.strictEqual(formats[1].type, xv.ImageFormatInfoType.YUV);
                done();
            });
        });
    });

    describe('QueryImageAttributes', () => {
        it('reports the packed plane layout, rounding the size up', done => {
            xv.QueryImageAttributes(port, YUY2, 7, 5, (err, attrs) => {
                assert.ifError(err);
                assert.deepStrictEqual(attrs, {
                    numPlanes: 1,
                    dataSize: 96,
                    width: 8,      // rounded up to even
                    height: 6,
                    pitches: [16], // 8 pixels x 2 bytes
                    offsets: [0]
                });
                done();
            });
        });

        it('reports one pitch and one offset per plane for planar formats', done => {
            xv.QueryImageAttributes(port, I420, 7, 5, (err, attrs) => {
                assert.ifError(err);
                assert.deepStrictEqual(attrs, {
                    numPlanes: 3,
                    dataSize: 72,
                    width: 8,
                    height: 6,
                    pitches: [8, 4, 4],
                    offsets: [0, 48, 60]
                });
                done();
            });
        });

        it('raises XvBadPort for a port the adaptor does not own', done => {
            xv.QueryImageAttributes(0, YUY2, 8, 8, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        });
    });

    describe('PutImage', () => {
        it('draws a packed YUY2 frame', done => {
            xv.QueryImageAttributes(port, YUY2, W, H, (err, plane) => {
                assert.ifError(err);
                const data = solidFrame(YUY2, plane, 'red', W, H);
                xv.PutImage(port, pixmap, gc, YUY2, {
                    srcX: 0, srcY: 0, srcWidth: W, srcHeight: H,
                    drwX: 0, drwY: 0, drwWidth: W, drwHeight: H,
                    width: W, height: H, data
                });
                readBack(pixmap, W, H, px => {
                    assertColor(px(0, 0), 'red', 'top left');
                    assertColor(px(W - 1, H - 1), 'red', 'bottom right');
                    done();
                });
            });
        });

        it('puts every header field at its own offset', done => {
            // all-distinct values: any two fields swapped or shifted shows up
            const geometry = {
                srcX: 1, srcY: 2, srcWidth: 3, srcHeight: 4,
                drwX: 5, drwY: 6, drwWidth: 7, drwHeight: 8,
                width: 9, height: 10
            };
            xv.QueryImageAttributes(port, YUY2, geometry.width, geometry.height, (err, plane) => {
                assert.ifError(err);
                const data = solidFrame(YUY2, plane, 'white', geometry.width, geometry.height);
                xv.PutImage(port, pixmap, gc, YUY2, Object.assign({ data }, geometry));
                sync(X, () => {
                    assert.deepStrictEqual(adaptor.state.putImages, [Object.assign({
                        port, drawable: pixmap, gc, id: YUY2, dataLength: plane.dataSize
                    }, geometry)]);
                    done();
                });
            });
        });

        it('honours the pitches and offsets of a planar I420 frame', done => {
            // width 6 pads to a pitch of 8, so a decoder that ignores pitches
            // reads the wrong bytes from row 1 on
            const w = 6, h = 6;
            xv.QueryImageAttributes(port, I420, w, h, (err, plane) => {
                assert.ifError(err);
                assert.deepStrictEqual(plane.pitches, [8, 4, 4]);
                const pixels = [];
                for (let y = 0; y < h; y++)
                    for (let x = 0; x < w; x++)
                        pixels.push(COLORS[y < 2 ? 'red' : (y < 4 ? 'green' : 'blue')].yuv);
                const data = packFrame(I420, plane, pixels, w, h);
                xv.PutImage(port, pixmap, gc, I420, {
                    srcX: 0, srcY: 0, srcWidth: w, srcHeight: h,
                    drwX: 0, drwY: 0, drwWidth: w, drwHeight: h,
                    width: w, height: h, data
                });
                readBack(pixmap, W, H, px => {
                    assertColor(px(0, 0), 'red', 'row 0');
                    assertColor(px(5, 1), 'red', 'row 1');
                    assertColor(px(0, 2), 'green', 'row 2');
                    assertColor(px(5, 3), 'green', 'row 3');
                    assertColor(px(0, 5), 'blue', 'row 5');
                    done();
                });
            });
        });

        it('scales the source rectangle into the destination rectangle', done => {
            xv.QueryImageAttributes(port, YUY2, 4, 4, (err, plane) => {
                assert.ifError(err);
                // left half white, right half red; U/V are shared per pair, so
                // the boundary at x = 2 falls between pairs and stays exact
                const pixels = [];
                for (let y = 0; y < 4; y++)
                    for (let x = 0; x < 4; x++)
                        pixels.push(COLORS[x < 2 ? 'white' : 'red'].yuv);
                const data = packFrame(YUY2, plane, pixels, 4, 4);
                // take the right half only and scale it up 2x
                xv.PutImage(port, pixmap, gc, YUY2, {
                    srcX: 2, srcY: 0, srcWidth: 2, srcHeight: 4,
                    drwX: 0, drwY: 0, drwWidth: 8, drwHeight: 8,
                    width: 4, height: 4, data
                });
                readBack(pixmap, W, H, px => {
                    for (let y = 0; y < 8; y++)
                        for (let x = 0; x < 8; x++)
                            assertColor(px(x, y), 'red', `${x},${y}`);
                    // nothing outside the destination rectangle
                    assertColor(px(8, 0), 'black', 'right of the destination');
                    assertColor(px(0, 8), 'black', 'below the destination');
                    done();
                });
            });
        });

        it('pads a payload that is not a whole number of words', done => {
            xv.QueryImageAttributes(port, YUY2, 4, 4, (err, plane) => {
                assert.ifError(err);
                // one byte past the plane data: the request must still be
                // framed to a word boundary or the server loses the stream
                const data = Buffer.concat([solidFrame(YUY2, plane, 'blue', 4, 4), Buffer.from([0])]);
                assert.strictEqual(data.length % 4, 1);
                xv.PutImage(port, pixmap, gc, YUY2, {
                    srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
                    drwX: 0, drwY: 0, drwWidth: 4, drwHeight: 4,
                    width: 4, height: 4, data
                });
                readBack(pixmap, W, H, px => {
                    assertColor(px(0, 0), 'blue', 'padded frame');
                    assert.strictEqual(adaptor.state.putImages.length, 1);
                    assert.strictEqual(adaptor.state.putImages[0].dataLength, 36);
                    done();
                });
            });
        });

        it('sends a frame too large for the 16-bit length field', done => {
            // 512x256 YUY2 is 256 KiB: 65546 words, past the 65535 a plain
            // request length can hold, so this takes the BIG-REQUESTS encoding
            const w = 512, h = 256;
            const big = X.AllocID();
            X.CreatePixmap(big, root, 24, w, h);
            xv.QueryImageAttributes(port, YUY2, w, h, (err, plane) => {
                assert.ifError(err);
                assert.ok(10 + plane.dataSize / 4 > 0xffff, 'frame should exceed the plain length field');
                const data = solidFrame(YUY2, plane, 'green', w, h);
                xv.PutImage(port, big, gc, YUY2, {
                    srcX: 0, srcY: 0, srcWidth: w, srcHeight: h,
                    drwX: 0, drwY: 0, drwWidth: w, drwHeight: h,
                    width: w, height: h, data
                });
                sync(X, () => {
                    assert.deepStrictEqual(adaptor.state.putImages, [{
                        port, drawable: big, gc, id: YUY2, dataLength: plane.dataSize,
                        srcX: 0, srcY: 0, srcWidth: w, srcHeight: h,
                        drwX: 0, drwY: 0, drwWidth: w, drwHeight: h,
                        width: w, height: h
                    }]);
                    X.GetImage(2, big, w - 2, h - 2, 2, 2, 0xffffffff, (err, img) => {
                        assert.ifError(err);
                        assertColor(img.data.readUInt32LE(0), 'green', 'last pixels');
                        X.FreePixmap(big);
                        done();
                    });
                });
            });
        });

        it('reports XvBadPort through the callback', done => {
            xv.PutImage(0, pixmap, gc, YUY2, {
                srcX: 0, srcY: 0, srcWidth: 2, srcHeight: 2,
                drwX: 0, drwY: 0, drwWidth: 2, drwHeight: 2,
                width: 2, height: 2, data: Buffer.alloc(16)
            }, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        });
    });

    describe('ShmPutImage', () => {
        it('draws from a segment at an offset and carries send_event', done => {
            const shmseg = 0xbeef;
            xv.QueryImageAttributes(port, YUY2, 4, 4, (err, plane) => {
                assert.ifError(err);
                const offset = 64;
                const segment = Buffer.alloc(offset + plane.dataSize);
                solidFrame(YUY2, plane, 'white', 4, 4).copy(segment, offset);
                adaptor.state.segments.set(shmseg, segment);
                xv.ShmPutImage(port, pixmap, gc, shmseg, YUY2, {
                    srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
                    drwX: 2, drwY: 2, drwWidth: 4, drwHeight: 4,
                    width: 4, height: 4, offset, sendEvent: true
                });
                readBack(pixmap, W, H, px => {
                    assertColor(px(2, 2), 'white', 'destination origin');
                    assertColor(px(5, 5), 'white', 'destination corner');
                    assertColor(px(1, 1), 'black', 'outside the destination');
                    assert.deepStrictEqual(adaptor.state.shmPutImages, [{
                        port, drawable: pixmap, gc, shmseg, id: YUY2, offset,
                        srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
                        drwX: 2, drwY: 2, drwWidth: 4, drwHeight: 4,
                        width: 4, height: 4, sendEvent: true
                    }]);
                    done();
                });
            });
        });

        it('reports XvBadPort through the callback', done => {
            xv.ShmPutImage(0, pixmap, gc, 0xbeef, YUY2, {
                srcX: 0, srcY: 0, srcWidth: 2, srcHeight: 2,
                drwX: 0, drwY: 0, drwWidth: 2, drwHeight: 2,
                width: 2, height: 2, offset: 0, sendEvent: false
            }, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        });
    });

    describe('event selection', () => {
        it('SelectVideoNotify delivers XvVideoNotify for a drawable', done => {
            X.on('event', ev => {
                if (ev.name !== 'XvVideoNotify')
                    return;
                assert.strictEqual(ev.drawable, pixmap);
                assert.strictEqual(ev.port, port);
                assert.strictEqual(ev.reason, xv.VideoNotifyReason.Started);
                assert.ok(ev.time > 0);
                done();
            });
            xv.SelectVideoNotify(pixmap, true, err => {
                assert.ifError(err);
                xv.QueryImageAttributes(port, YUY2, 4, 4, (err, plane) => {
                    assert.ifError(err);
                    xv.PutImage(port, pixmap, gc, YUY2, {
                        srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
                        drwX: 0, drwY: 0, drwWidth: 4, drwHeight: 4,
                        width: 4, height: 4,
                        data: solidFrame(YUY2, plane, 'red', 4, 4)
                    });
                });
                return true;
            });
        });

        it('StopVideo ends the stream and reports it as XvVideoNotify Stopped', done => {
            const seen = [];
            X.on('event', ev => {
                if (ev.name !== 'XvVideoNotify')
                    return;
                seen.push(ev.reason);
                if (seen.length < 2)
                    return;
                assert.deepStrictEqual(seen, [
                    xv.VideoNotifyReason.Started,
                    xv.VideoNotifyReason.Stopped
                ]);
                assert.strictEqual(ev.drawable, pixmap);
                assert.strictEqual(ev.port, port);
                done();
            });
            xv.SelectVideoNotify(pixmap, true, err => {
                assert.ifError(err);
                xv.QueryImageAttributes(port, YUY2, 4, 4, (err, plane) => {
                    assert.ifError(err);
                    xv.PutImage(port, pixmap, gc, YUY2, {
                        srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
                        drwX: 0, drwY: 0, drwWidth: 4, drwHeight: 4,
                        width: 4, height: 4,
                        data: solidFrame(YUY2, plane, 'blue', 4, 4)
                    });
                    // a second frame is the same stream: no further Started
                    xv.PutImage(port, pixmap, gc, YUY2, {
                        srcX: 0, srcY: 0, srcWidth: 4, srcHeight: 4,
                        drwX: 0, drwY: 0, drwWidth: 4, drwHeight: 4,
                        width: 4, height: 4,
                        data: solidFrame(YUY2, plane, 'blue', 4, 4)
                    });
                    xv.StopVideo(port, pixmap, err => {
                        assert.ifError(err);
                        return true;
                    });
                });
                return true;
            });
        });

        it('raises XvBadPort for StopVideo on a bogus port', done => {
            xv.StopVideo(0, pixmap, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        });

        it('SelectPortNotify delivers XvPortNotify when an attribute changes', done => {
            X.InternAtom(false, 'XV_BRIGHTNESS', (err, atom) => {
                assert.ifError(err);
                X.on('event', ev => {
                    if (ev.name !== 'XvPortNotify')
                        return;
                    assert.strictEqual(ev.port, port);
                    assert.strictEqual(ev.attribute, atom);
                    assert.strictEqual(ev.value, -250);
                    done();
                });
                xv.SelectPortNotify(port, true, err => {
                    assert.ifError(err);
                    xv.SetPortAttribute(port, atom, -250);
                    return true;
                });
            });
        });

        it('stops delivering once deselected', done => {
            X.InternAtom(false, 'XV_CONTRAST', (err, atom) => {
                assert.ifError(err);
                let events = 0;
                X.on('event', ev => {
                    if (ev.name === 'XvPortNotify')
                        events++;
                });
                xv.SelectPortNotify(port, true, () => {
                    xv.SetPortAttribute(port, atom, 100);
                    xv.SelectPortNotify(port, false, () => {
                        xv.SetPortAttribute(port, atom, 200);
                        sync(X, () => {
                            assert.strictEqual(events, 1);
                            xv.GetPortAttribute(port, atom, (err, value) => {
                                assert.ifError(err);
                                assert.strictEqual(value, 200);
                                done();
                            });
                        });
                        return true;
                    });
                    return true;
                });
            });
        });

        it('raises XvBadPort for SelectPortNotify on a bogus port', done => {
            xv.SelectPortNotify(0, true, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        });
    });

    it('grabs and ungrabs a port, and answers QueryBestSize', done => {
        xv.GrabPort(port, 0, (err, status) => {
            assert.ifError(err);
            assert.strictEqual(status, xv.GrabPortStatus.Success);
            xv.QueryBestSize(port, 320, 240, 640, 480, false, (err, size) => {
                assert.ifError(err);
                assert.deepStrictEqual(size, { width: 640, height: 480 });
                xv.UngrabPort(port, 0);
                sync(X, () => done());
            });
        });
    });
});
