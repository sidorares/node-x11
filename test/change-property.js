const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const should = require('should');

const TEST_PROPERTY = 'My Test Property';

describe('ChangeProperty', () => {
    let X, wid, wid_helper;

    before(function(t, done) {
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            X = dpy.client;
            wid = X.AllocID();
            wid_helper = X.AllocID();
            X.CreateWindow(wid, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
            X.QueryTree(dpy.screen[0].root, (err, list) => {
                should.not.exist(err);
                list.children.indexOf(wid).should.not.equal(-1);
                X.ChangeWindowAttributes(wid, { eventMask: x11.eventMask.PropertyChange });
                done();
            });
        });

        client.on('error', done);
    });

    it('should add a new WINDOW property with length 1', function(t, done) {
        X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            should.not.exist(err);
            const raw = Buffer.alloc(4);
            raw.writeUInt32LE(wid, 0);
            X.ChangeProperty(0, wid, atom, X.atoms.WINDOW, 32, raw);
            X.once('event', ev => {
                ev.type.should.equal(28);
                ev.atom.should.equal(atom);
                ev.wid.should.equal(wid);
                X.GetProperty(0, wid, atom, X.atoms.WINDOW, 0, 1000000000, (err, prop) => {
                    should.not.exist(err);
                    prop.data.readUInt32LE(0).should.equal(wid);
                    done();
                });
            });
        });
    });

    it('should add a new WINDOW property with length 2', function(t, done) {
        X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            should.not.exist(err);
            const raw = Buffer.from(new Array(8));
            raw.writeUInt32LE(wid, 0);
            raw.writeUInt32LE(wid_helper, 4);
            X.ChangeProperty(0, wid, atom, X.atoms.ATOM, 32, raw);
            X.once('event', ev => {
                ev.type.should.equal(28);
                ev.atom.should.equal(atom);
                ev.wid.should.equal(wid);
                X.GetProperty(0, wid, atom, X.atoms.ATOM, 0, 1000000000, (err, prop) => {
                    should.not.exist(err);
                    prop.data.readUInt32LE(0).should.equal(wid);
                    prop.data.readUInt32LE(4).should.equal(wid_helper);
                    done();
                });
            });
        });
    });

    it('should replace a the WINDOW property with length 0', function(t, done) {
        X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            should.not.exist(err);
            const raw = Buffer.alloc(0);
            X.ChangeProperty(0, wid, atom, X.atoms.WINDOW, 32, raw);
            X.once('event', ev => {
                ev.type.should.equal(28);
                ev.atom.should.equal(atom);
                ev.wid.should.equal(wid);
                X.GetProperty(0, wid, atom, X.atoms.WINDOW, 0, 1000000000, (err, prop) => {
                    should.not.exist(err);
                    prop.data.length.should.equal(0);
                    done();
                });
            });
        });
    });

    it('should encode a number array at the declared format width', function(t, done) {
        // Buffer.from([1366]) keeps only the low byte, so this used to reach
        // the server as an empty property with one garbage byte behind it
        const strut = [0, 0, 0, 23, 0, 0, 0, 0, 0, 0, 0, 1366];
        X.InternAtom(false, 'X11_TEST_STRUT', (err, atom) => {
            should.not.exist(err);
            X.ChangeProperty(0, wid, atom, X.atoms.CARDINAL, 32, strut);
            X.GetProperty(0, wid, atom, X.atoms.CARDINAL, 0, 100, (err, prop) => {
                should.not.exist(err);
                prop.data.length.should.equal(48);
                const out = [];
                for (let i = 0; i + 4 <= prop.data.length; i += 4)
                    out.push(prop.data.readUInt32LE(i));
                out.should.eql(strut);
                done();
            });
        });
    });

    it('should encode a bare number as one element of the declared format', function(t, done) {
        X.InternAtom(false, 'X11_TEST_NUMBER', (err, atom) => {
            should.not.exist(err);
            X.ChangeProperty(0, wid, atom, X.atoms.CARDINAL, 32, 0xdeadbeef);
            X.GetProperty(0, wid, atom, X.atoms.CARDINAL, 0, 100, (err, prop) => {
                should.not.exist(err);
                prop.data.length.should.equal(4);
                prop.data.readUInt32LE(0).should.equal(0xdeadbeef);
                done();
            });
        });
    });

    it('should keep packing a byte array at format 8', function(t, done) {
        X.InternAtom(false, 'X11_TEST_BYTES', (err, atom) => {
            should.not.exist(err);
            X.ChangeProperty(0, wid, atom, X.atoms.STRING, 8, [104, 105]);
            X.GetProperty(0, wid, atom, X.atoms.STRING, 0, 100, (err, prop) => {
                should.not.exist(err);
                prop.data.toString().should.equal('hi');
                done();
            });
        });
    });

    after(function(t, done) {
        X.DestroyWindow(wid);
        X.terminate();
        X.on('end', done);
    });
});

