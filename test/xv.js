const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

// Xvfb exposes the XVideo extension but (typically) zero adaptors, so there
// is no real port to drive. Port-based requests are then validated with a
// bogus port: a controlled XvBadPort error proves the request reached the
// server with correct framing. When a real adaptor exists (real hardware),
// the same tests exercise the success path instead.

const BOGUS_PORT = 0;

describe('XVideo extension', () => {

    let X;
    let display;
    let root;
    let gc;
    let xv;
    let adaptors;
    let port = null;
    let imageFormat = null;
    let errorHandler = null;

    before((t, done) => {
        const client = x11.createClient((err, dpy) => {
            assert.ifError(err);
            display = dpy;
            X = dpy.client;
            root = dpy.screen[0].root;
            X.require('xv', (err, ext) => {
                assert.ifError(err);
                xv = ext;
                gc = X.AllocID();
                X.CreateGC(gc, root);
                xv.QueryAdaptors(root, (err, list) => {
                    assert.ifError(err);
                    adaptors = list;
                    if (adaptors.length === 0)
                        return done();
                    port = adaptors[0].baseId;
                    // with a real adaptor, pick a format for the image path
                    xv.ListImageFormats(port, (err, formats) => {
                        assert.ifError(err);
                        if (formats.length > 0)
                            imageFormat = formats[0];
                        done();
                    });
                });
            });
        });
        client.on('error', err => {
            if (errorHandler)
                errorHandler(err);
            else
                done(err);
        });
    });

    after((t, done) => {
        X.FreeGC(gc);
        X.terminate();
        X.on('end', done);
    });

    it('QueryExtension should report version 2.2 or later', () => {
        assert.ok(xv.major >= 2);
        if (xv.major === 2)
            assert.ok(xv.minor >= 2);
    });

    it('QueryAdaptors should return a well-formed (possibly empty) list', () => {
        assert.ok(Array.isArray(adaptors));
        adaptors.forEach(a => {
            assert.ok(a.baseId > 0);
            assert.strictEqual(typeof a.name, 'string');
            assert.ok(a.numPorts >= 1);
            assert.ok(a.type >= 0 && a.type <= 31);
            assert.ok(Array.isArray(a.formats));
            a.formats.forEach(f => {
                assert.ok(f.visual > 0);
                assert.ok(f.depth > 0);
            });
        });
    });

    it('QueryEncodings should list encodings or raise XvBadPort', (t, done) => {
        if (port !== null) {
            xv.QueryEncodings(port, (err, encodings) => {
                assert.ifError(err);
                assert.ok(Array.isArray(encodings));
                assert.ok(encodings.length >= 1);
                assert.strictEqual(typeof encodings[0].name, 'string');
                assert.ok(encodings[0].width > 0);
                assert.ok(encodings[0].height > 0);
                done();
            });
        } else {
            xv.QueryEncodings(BOGUS_PORT, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true; // error handled, don't emit on the client
            });
        }
    });

    it('GrabPort/UngrabPort should succeed or raise XvBadPort', (t, done) => {
        if (port !== null) {
            xv.GrabPort(port, 0, (err, status) => {
                assert.ifError(err);
                assert.strictEqual(status, xv.GrabPortStatus.Success);
                xv.UngrabPort(port, 0);
                done();
            });
        } else {
            xv.GrabPort(BOGUS_PORT, 0, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('QueryBestSize should return a size or raise XvBadPort', (t, done) => {
        if (port !== null) {
            xv.QueryBestSize(port, 320, 240, 640, 480, false, (err, size) => {
                assert.ifError(err);
                assert.ok(size.width > 0);
                assert.ok(size.height > 0);
                done();
            });
        } else {
            xv.QueryBestSize(BOGUS_PORT, 320, 240, 640, 480, false, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('QueryPortAttributes should list attributes or raise XvBadPort', (t, done) => {
        if (port !== null) {
            xv.QueryPortAttributes(port, (err, attributes) => {
                assert.ifError(err);
                assert.ok(Array.isArray(attributes));
                attributes.forEach(a => {
                    assert.strictEqual(typeof a.name, 'string');
                    assert.strictEqual(typeof a.flags, 'number');
                });
                done();
            });
        } else {
            xv.QueryPortAttributes(BOGUS_PORT, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('GetPortAttribute should raise XvBadPort for a bogus port', (t, done) => {
        // even with a real port an attribute atom would be needed, so always
        // exercise the error path here
        xv.GetPortAttribute(BOGUS_PORT, 1 /* any atom */, err => {
            assert.strictEqual(err.error, xv.errors.BadPort);
            done();
            return true;
        });
    });

    it('SetPortAttribute (no reply) should raise XvBadPort via the error event', (t, done) => {
        xv.SetPortAttribute(BOGUS_PORT, 1 /* any atom */, 0);
        const seq = X.seq_num;
        errorHandler = err => {
            errorHandler = null;
            assert.strictEqual(err.error, xv.errors.BadPort);
            assert.strictEqual(err.seq, seq);
            done();
        };
    });

    it('ListImageFormats should list formats or raise XvBadPort', (t, done) => {
        if (port !== null) {
            xv.ListImageFormats(port, (err, formats) => {
                assert.ifError(err);
                assert.ok(Array.isArray(formats));
                formats.forEach(f => {
                    assert.ok(f.id > 0);
                    assert.ok(f.bpp > 0);
                    assert.strictEqual(f.guid.length, 16);
                });
                done();
            });
        } else {
            xv.ListImageFormats(BOGUS_PORT, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    // Nothing here can put a frame without an adaptor, so the image-path
    // requests are checked the other way round: the request must reach the
    // server well-formed (a controlled XvBadPort rather than BadLength) and
    // must leave the connection in sync - a wrong length would make the
    // server read the payload as further requests, so the round trip after
    // it would come back with the wrong sequence number or not at all.
    // test/xserver/xv.js drives the same requests to completion against the
    // JS server's test adaptor.
    const stillInSync = done => {
        const seq = X.seq_num;
        X.GetInputFocus((err, focus) => {
            assert.ifError(err);
            assert.ok(focus !== null && typeof focus === 'object');
            assert.strictEqual(X.seq_num, seq + 1);
            done();
        });
    };

    it('StopVideo should raise XvBadPort for a bogus port', (t, done) => {
        // always the error path: with a real port this would stop whatever
        // another client is putting into the root window
        xv.StopVideo(BOGUS_PORT, root, err => {
            assert.strictEqual(err.error, xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });

    it('SelectVideoNotify should be accepted for any drawable', (t, done) => {
        // takes a drawable, not a port: it works on an adaptorless server
        xv.SelectVideoNotify(root, true, err => {
            assert.ifError(err);
            xv.SelectVideoNotify(root, false, err => {
                assert.ifError(err);
                done();
                return true;
            });
            return true;
        });
    });

    it('SelectPortNotify should subscribe or raise XvBadPort', (t, done) => {
        if (port !== null) {
            xv.SelectPortNotify(port, true, err => {
                assert.ifError(err);
                xv.SelectPortNotify(port, false);
                done();
                return true;
            });
        } else {
            xv.SelectPortNotify(BOGUS_PORT, true, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('QueryImageAttributes should report a plane layout or raise XvBadPort', (t, done) => {
        if (port !== null && imageFormat !== null) {
            xv.QueryImageAttributes(port, imageFormat.id, 320, 240, (err, attrs) => {
                assert.ifError(err);
                assert.strictEqual(attrs.numPlanes, imageFormat.numPlanes);
                assert.ok(attrs.dataSize > 0);
                assert.ok(attrs.width >= 320);
                assert.ok(attrs.height >= 240);
                assert.strictEqual(attrs.pitches.length, attrs.numPlanes);
                assert.strictEqual(attrs.offsets.length, attrs.numPlanes);
                assert.strictEqual(attrs.offsets[0], 0);
                done();
            });
        } else {
            xv.QueryImageAttributes(BOGUS_PORT, 0x32595559, 16, 16, err => {
                assert.strictEqual(err.error, xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('PutImage should reach the server and keep the connection in sync', (t, done) => {
        const img = {
            srcX: 0, srcY: 0, srcWidth: 16, srcHeight: 16,
            drwX: 0, drwY: 0, drwWidth: 16, drwHeight: 16,
            width: 16, height: 16,
            data: Buffer.alloc(16 * 16 * 2)
        };
        xv.PutImage(BOGUS_PORT, root, gc, 0x32595559, img, err => {
            assert.strictEqual(err.error, xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });

    it('PutImage should use the BIG-REQUESTS encoding past 256 KiB', (t, done) => {
        // 512x512 at 3 bytes/pixel is 786432 bytes: 196618 words, well past
        // the 65535 a plain request length field can hold
        const img = {
            srcX: 0, srcY: 0, srcWidth: 512, srcHeight: 512,
            drwX: 0, drwY: 0, drwWidth: 512, drwHeight: 512,
            width: 512, height: 512,
            data: Buffer.alloc(512 * 512 * 3)
        };
        xv.PutImage(BOGUS_PORT, root, gc, 0x32595559, img, err => {
            assert.strictEqual(err.error, xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });

    it('PutImage should refuse a frame the connection cannot carry', (t, done) => {
        const words = (display.max_request_length || 0xffff) + 1;
        const img = {
            srcX: 0, srcY: 0, srcWidth: 16, srcHeight: 16,
            drwX: 0, drwY: 0, drwWidth: 16, drwHeight: 16,
            width: 16, height: 16,
            data: Buffer.alloc(words * 4)
        };
        const seq = X.seq_num;
        xv.PutImage(BOGUS_PORT, root, gc, 0x32595559, img, err => {
            assert.match(err.message, /maximum request length/);
            // nothing went out: the sequence number did not move
            assert.strictEqual(X.seq_num, seq);
            stillInSync(done);
            return true;
        });
    });

    it('ShmPutImage should reach the server and keep the connection in sync', (t, done) => {
        xv.ShmPutImage(BOGUS_PORT, root, gc, 0 /* any seg */, 0x32595559, {
            srcX: 0, srcY: 0, srcWidth: 16, srcHeight: 16,
            drwX: 0, drwY: 0, drwWidth: 16, drwHeight: 16,
            width: 16, height: 16, offset: 0, sendEvent: false
        }, err => {
            assert.strictEqual(err.error, xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });
});
