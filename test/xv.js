const x11 = require('../lib');
const should = require('should');

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

    before(done => {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            display = dpy;
            X = dpy.client;
            root = dpy.screen[0].root;
            X.require('xv', (err, ext) => {
                should.not.exist(err);
                xv = ext;
                gc = X.AllocID();
                X.CreateGC(gc, root);
                xv.QueryAdaptors(root, (err, list) => {
                    should.not.exist(err);
                    adaptors = list;
                    if (adaptors.length === 0)
                        return done();
                    port = adaptors[0].baseId;
                    // with a real adaptor, pick a format for the image path
                    xv.ListImageFormats(port, (err, formats) => {
                        should.not.exist(err);
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

    after(done => {
        X.FreeGC(gc);
        X.terminate();
        X.on('end', done);
    });

    it('QueryExtension should report version 2.2 or later', () => {
        xv.major.should.be.aboveOrEqual(2);
        if (xv.major === 2)
            xv.minor.should.be.aboveOrEqual(2);
    });

    it('QueryAdaptors should return a well-formed (possibly empty) list', () => {
        adaptors.should.be.an.Array();
        adaptors.forEach(a => {
            a.baseId.should.be.above(0);
            a.name.should.be.a.String();
            a.numPorts.should.be.aboveOrEqual(1);
            a.type.should.be.within(0, 31);
            a.formats.should.be.an.Array();
            a.formats.forEach(f => {
                f.visual.should.be.above(0);
                f.depth.should.be.above(0);
            });
        });
    });

    it('QueryEncodings should list encodings or raise XvBadPort', done => {
        if (port !== null) {
            xv.QueryEncodings(port, (err, encodings) => {
                should.not.exist(err);
                encodings.should.be.an.Array();
                encodings.length.should.be.aboveOrEqual(1);
                encodings[0].name.should.be.a.String();
                encodings[0].width.should.be.above(0);
                encodings[0].height.should.be.above(0);
                done();
            });
        } else {
            xv.QueryEncodings(BOGUS_PORT, err => {
                err.error.should.equal(xv.errors.BadPort);
                done();
                return true; // error handled, don't emit on the client
            });
        }
    });

    it('GrabPort/UngrabPort should succeed or raise XvBadPort', done => {
        if (port !== null) {
            xv.GrabPort(port, 0, (err, status) => {
                should.not.exist(err);
                status.should.equal(xv.GrabPortStatus.Success);
                xv.UngrabPort(port, 0);
                done();
            });
        } else {
            xv.GrabPort(BOGUS_PORT, 0, err => {
                err.error.should.equal(xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('QueryBestSize should return a size or raise XvBadPort', done => {
        if (port !== null) {
            xv.QueryBestSize(port, 320, 240, 640, 480, false, (err, size) => {
                should.not.exist(err);
                size.width.should.be.above(0);
                size.height.should.be.above(0);
                done();
            });
        } else {
            xv.QueryBestSize(BOGUS_PORT, 320, 240, 640, 480, false, err => {
                err.error.should.equal(xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('QueryPortAttributes should list attributes or raise XvBadPort', done => {
        if (port !== null) {
            xv.QueryPortAttributes(port, (err, attributes) => {
                should.not.exist(err);
                attributes.should.be.an.Array();
                attributes.forEach(a => {
                    a.name.should.be.a.String();
                    a.flags.should.be.a.Number();
                });
                done();
            });
        } else {
            xv.QueryPortAttributes(BOGUS_PORT, err => {
                err.error.should.equal(xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('GetPortAttribute should raise XvBadPort for a bogus port', done => {
        // even with a real port an attribute atom would be needed, so always
        // exercise the error path here
        xv.GetPortAttribute(BOGUS_PORT, 1 /* any atom */, err => {
            err.error.should.equal(xv.errors.BadPort);
            done();
            return true;
        });
    });

    it('SetPortAttribute (no reply) should raise XvBadPort via the error event', done => {
        xv.SetPortAttribute(BOGUS_PORT, 1 /* any atom */, 0);
        const seq = X.seq_num;
        errorHandler = err => {
            errorHandler = null;
            err.error.should.equal(xv.errors.BadPort);
            err.seq.should.equal(seq);
            done();
        };
    });

    it('ListImageFormats should list formats or raise XvBadPort', done => {
        if (port !== null) {
            xv.ListImageFormats(port, (err, formats) => {
                should.not.exist(err);
                formats.should.be.an.Array();
                formats.forEach(f => {
                    f.id.should.be.above(0);
                    f.bpp.should.be.above(0);
                    f.guid.length.should.equal(16);
                });
                done();
            });
        } else {
            xv.ListImageFormats(BOGUS_PORT, err => {
                err.error.should.equal(xv.errors.BadPort);
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
            should.not.exist(err);
            focus.should.be.an.Object();
            X.seq_num.should.equal(seq + 1);
            done();
        });
    };

    it('StopVideo should raise XvBadPort for a bogus port', done => {
        // always the error path: with a real port this would stop whatever
        // another client is putting into the root window
        xv.StopVideo(BOGUS_PORT, root, err => {
            err.error.should.equal(xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });

    it('SelectVideoNotify should be accepted for any drawable', done => {
        // takes a drawable, not a port: it works on an adaptorless server
        xv.SelectVideoNotify(root, true, err => {
            should.not.exist(err);
            xv.SelectVideoNotify(root, false, err => {
                should.not.exist(err);
                done();
                return true;
            });
            return true;
        });
    });

    it('SelectPortNotify should subscribe or raise XvBadPort', done => {
        if (port !== null) {
            xv.SelectPortNotify(port, true, err => {
                should.not.exist(err);
                xv.SelectPortNotify(port, false);
                done();
                return true;
            });
        } else {
            xv.SelectPortNotify(BOGUS_PORT, true, err => {
                err.error.should.equal(xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('QueryImageAttributes should report a plane layout or raise XvBadPort', done => {
        if (port !== null && imageFormat !== null) {
            xv.QueryImageAttributes(port, imageFormat.id, 320, 240, (err, attrs) => {
                should.not.exist(err);
                attrs.numPlanes.should.equal(imageFormat.numPlanes);
                attrs.dataSize.should.be.above(0);
                attrs.width.should.be.aboveOrEqual(320);
                attrs.height.should.be.aboveOrEqual(240);
                attrs.pitches.length.should.equal(attrs.numPlanes);
                attrs.offsets.length.should.equal(attrs.numPlanes);
                attrs.offsets[0].should.equal(0);
                done();
            });
        } else {
            xv.QueryImageAttributes(BOGUS_PORT, 0x32595559, 16, 16, err => {
                err.error.should.equal(xv.errors.BadPort);
                done();
                return true;
            });
        }
    });

    it('PutImage should reach the server and keep the connection in sync', done => {
        const img = {
            srcX: 0, srcY: 0, srcWidth: 16, srcHeight: 16,
            drwX: 0, drwY: 0, drwWidth: 16, drwHeight: 16,
            width: 16, height: 16,
            data: Buffer.alloc(16 * 16 * 2)
        };
        xv.PutImage(BOGUS_PORT, root, gc, 0x32595559, img, err => {
            err.error.should.equal(xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });

    it('PutImage should use the BIG-REQUESTS encoding past 256 KiB', done => {
        // 512x512 at 3 bytes/pixel is 786432 bytes: 196618 words, well past
        // the 65535 a plain request length field can hold
        const img = {
            srcX: 0, srcY: 0, srcWidth: 512, srcHeight: 512,
            drwX: 0, drwY: 0, drwWidth: 512, drwHeight: 512,
            width: 512, height: 512,
            data: Buffer.alloc(512 * 512 * 3)
        };
        xv.PutImage(BOGUS_PORT, root, gc, 0x32595559, img, err => {
            err.error.should.equal(xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });

    it('PutImage should refuse a frame the connection cannot carry', done => {
        const words = (display.max_request_length || 0xffff) + 1;
        const img = {
            srcX: 0, srcY: 0, srcWidth: 16, srcHeight: 16,
            drwX: 0, drwY: 0, drwWidth: 16, drwHeight: 16,
            width: 16, height: 16,
            data: Buffer.alloc(words * 4)
        };
        const seq = X.seq_num;
        xv.PutImage(BOGUS_PORT, root, gc, 0x32595559, img, err => {
            err.message.should.match(/maximum request length/);
            // nothing went out: the sequence number did not move
            X.seq_num.should.equal(seq);
            stillInSync(done);
            return true;
        });
    });

    it('ShmPutImage should reach the server and keep the connection in sync', done => {
        xv.ShmPutImage(BOGUS_PORT, root, gc, 0 /* any seg */, 0x32595559, {
            srcX: 0, srcY: 0, srcWidth: 16, srcHeight: 16,
            drwX: 0, drwY: 0, drwWidth: 16, drwHeight: 16,
            width: 16, height: 16, offset: 0, sendEvent: false
        }, err => {
            err.error.should.equal(xv.errors.BadPort);
            stillInSync(done);
            return true;
        });
    });
});
