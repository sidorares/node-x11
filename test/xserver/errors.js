const assert = require('assert');
const { boot } = require('./boot');

describe('xserver: errors and framing', () => {

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

    it('BadWindow carries the bad id, opcode and sequence number', done => {
        X.MapWindow(0xbadf00d);
        const seq = X.seq_num;
        X.once('error', err => {
            assert.strictEqual(err.error, 3);              // BadWindow
            assert.strictEqual(err.badParam, 0xbadf00d);
            assert.strictEqual(err.majorOpcode, 8);        // MapWindow
            assert.strictEqual(err.seq, seq);
            assert.strictEqual(err.message, 'Bad window');
            done();
        });
    });

    it('BadDrawable/BadGC/BadAtom from the matching requests', done => {
        X.GetGeometry(0x123456, err => {
            assert.strictEqual(err.error, 9);              // BadDrawable
            X.ChangeGC(0x123457, { foreground: 1 });
            X.once('error', err2 => {
                assert.strictEqual(err2.error, 13);        // BadGContext
                X.GetProperty(0, root, 0x99999, 0, 0, 10, err3 => {
                    assert.strictEqual(err3.error, 5);     // BadAtom
                    assert.strictEqual(err3.badParam, 0x99999);
                    done();
                    return true;
                });
            });
            return true;
        });
    });

    it('BadIDChoice when creating a resource outside the client range', done => {
        X.CreateWindow(5, root, 0, 0, 10, 10);
        X.once('error', err => {
            assert.strictEqual(err.error, 14);
            assert.strictEqual(err.badParam, 5);
            done();
        });
    });

    it('BadValue on zero-sized CreateWindow', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 0, 10);
        X.once('error', err => {
            assert.strictEqual(err.error, 2);
            assert.strictEqual(err.majorOpcode, 1);
            done();
        });
    });

    it('unknown opcode yields BadImplementation without desyncing', done => {
        // raw request with an unassigned core opcode
        X.seq_num++;
        const raw = Buffer.alloc(4);
        raw[0] = 121;
        raw.writeUInt16LE(1, 2);
        X.pack_stream.put(raw);
        X.pack_stream.flush();
        X.once('error', err => {
            assert.strictEqual(err.error, 17); // BadImplementation
            assert.strictEqual(err.majorOpcode, 121);
            // framing survives: a normal request still round-trips
            X.GetGeometry(root, (err2, geom) => {
                if (err2) return done(err2);
                assert.strictEqual(geom.width, server.width);
                done();
            });
        });
    });

    it('unknown-length garbage requests are consumed whole', done => {
        // unassigned opcode with a 5-word body: server must consume it all
        X.seq_num++;
        const raw = Buffer.alloc(20);
        raw[0] = 122;
        raw.writeUInt16LE(5, 2);
        raw.fill(0xaa, 4);
        X.pack_stream.put(raw);
        X.pack_stream.flush();
        X.once('error', err => {
            assert.strictEqual(err.error, 17);
            X.QueryTree(root, (err2, tree) => {
                if (err2) return done(err2);
                assert.strictEqual(tree.root, root);
                done();
            });
        });
    });

    it('QueryExtension for an unknown extension reports absent', done => {
        X.QueryExtension('NO-SUCH-EXTENSION', (err, ext) => {
            if (err) return done(err);
            assert.strictEqual(ext.present, 0);
            assert.strictEqual(ext.majorOpcode, 0);
            done();
        });
    });
});
