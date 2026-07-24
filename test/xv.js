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
    let root;
    let xv;
    let adaptors;
    let port = null;
    let errorHandler = null;

    before(done => {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            root = dpy.screen[0].root;
            X.require('xv', (err, ext) => {
                should.not.exist(err);
                xv = ext;
                xv.QueryAdaptors(root, (err, list) => {
                    should.not.exist(err);
                    adaptors = list;
                    if (adaptors.length > 0)
                        port = adaptors[0].baseId;
                    done();
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
});
