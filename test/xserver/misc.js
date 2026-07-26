const assert = require('assert');
const { boot, sync } = require('./boot');

describe('xserver: fonts, cursors and misc requests', () => {

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

    it('OpenFont/QueryFont serve the built-in 8x8 metrics', done => {
        const fid = X.AllocID();
        X.OpenFont(fid, 'whatever-name-6x13');
        X.QueryFont(fid, (err, font) => {
            if (err) return done(err);
            assert.strictEqual(font.minBounds.characterWidth, 8);
            assert.strictEqual(font.maxBounds.characterWidth, 8);
            assert.strictEqual(font.minBounds.ascent, 7);
            assert.strictEqual(font.minBounds.descent, 1);
            assert.strictEqual(font.fontAscent, 7);
            assert.strictEqual(font.fontDescent, 1);
            assert.strictEqual(font.minCharOrByte2, 0);
            assert.strictEqual(font.maxCharOrByte2, 127);
            assert.strictEqual(font.defaultChar, 32);
            assert.deepStrictEqual(font.properties, []);
            assert.deepStrictEqual(font.charInfos, []);
            done();
        });
    });

    it('QueryTextExtents measures with the fixed cell size', done => {
        const fid = X.AllocID();
        X.OpenFont(fid, 'fixed');
        X.QueryTextExtents(fid, 'hello', (err, ext) => {
            if (err) return done(err);
            assert.strictEqual(ext.overallWidth, 5 * 8);
            assert.strictEqual(ext.fontAscent, 7);
            assert.strictEqual(ext.fontDescent, 1);
            assert.strictEqual(ext.overallRight, 40);
            done();
        });
    });

    it('CloseFont invalidates the font id', done => {
        const fid = X.AllocID();
        X.OpenFont(fid, 'fixed');
        X.CloseFont(fid);
        X.QueryFont(fid, err => {
            assert.ok(err);
            assert.strictEqual(err.error, 7); // BadFont
            done();
            return true;
        });
    });

    it('ListFonts and ListFontsWithInfo advertise "fixed"', done => {
        X.ListFonts('*', 10, (err, names) => {
            if (err) return done(err);
            assert.deepStrictEqual(names, ['fixed']);
            X.ListFontsWithInfo('*', 10, (err2, fonts) => {
                if (err2) return done(err2);
                assert.strictEqual(fonts.length, 1);
                assert.strictEqual(fonts[0].name, 'fixed');
                assert.strictEqual(fonts[0].maxBounds.characterWidth, 8);
                assert.strictEqual(fonts[0].fontAscent, 7);
                done();
            });
        });
    });

    it('GetFontPath/SetFontPath are accepted', done => {
        X.SetFontPath(['/nonexistent']);
        X.GetFontPath((err, paths) => {
            if (err) return done(err);
            assert.deepStrictEqual(paths, []);
            done();
        });
    });

    it('cursors: create/recolor/free are tracked', done => {
        const cid = X.AllocID();
        X.CreateGlyphCursor(cid, 1, 1, 68, 69,
            { R: 0, G: 0, B: 0 }, { R: 0xffff, G: 0xffff, B: 0xffff });
        sync(X, () => {
            const cursor = server.resources.get(cid);
            assert.ok(cursor);
            assert.strictEqual(cursor.type, 'cursor');
            assert.strictEqual(cursor.sourceChar, 68);
            X.RecolorCursor(cid, { R: 257, G: 514, B: 771 }, { R: 0, G: 0, B: 0 });
            sync(X, () => {
                assert.deepStrictEqual(server.resources.get(cid).fore, [257, 514, 771]);
                X.FreeCursor(cid);
                sync(X, () => {
                    assert.ok(!server.resources.has(cid));
                    done();
                });
            });
        });
    });

    it('QueryBestSize echoes a usable size', done => {
        X.QueryBestSize(0, root, 16, 16, (err, size) => {
            if (err) return done(err);
            assert.strictEqual(size.width, 16);
            assert.strictEqual(size.height, 16);
            done();
        });
    });

    it('ListExtensions includes the built-ins', done => {
        X.ListExtensions((err, names) => {
            if (err) return done(err);
            assert.ok(names.includes('BIG-REQUESTS'));
            assert.ok(names.includes('XC-MISC'));
            done();
        });
    });

    it('registerExtension exposes custom extensions through QueryExtension', done => {
        const seen = [];
        server.registerExtension('TEST-EXT', {
            eventsCount: 0,
            errorsCount: 0,
            handleRequest(srv, client, minor, body) {
                seen.push(minor);
                const b = client.startReply(0, 0);
                b.writeUInt32LE(0x1234, 8);
                client.send(b);
            }
        });
        X.QueryExtension('TEST-EXT', (err, ext) => {
            if (err) return done(err);
            assert.strictEqual(ext.present, 1);
            // drive it with a raw request
            X.seq_num++;
            const raw = Buffer.alloc(4);
            raw[0] = ext.majorOpcode;
            raw[1] = 7;
            raw.writeUInt16LE(1, 2);
            X.replies[X.seq_num] = [buf => buf.readUInt32LE(0), (err2, value) => {
                assert.strictEqual(value, 0x1234);
                assert.deepStrictEqual(seen, [7]);
                done();
            }];
            X.pack_stream.put(raw);
            X.pack_stream.flush();
        });
    });

    it('screen saver control round-trips through the stub', done => {
        X.GetScreenSaver((err, ss) => {
            if (err) return done(err);
            assert.strictEqual(ss.timeout, 600);
            X.SetScreenSaver(300, 200, 1, 0);
            X.GetScreenSaver((err2, ss2) => {
                if (err2) return done(err2);
                assert.strictEqual(ss2.timeout, 300);
                assert.strictEqual(ss2.interval, 200);
                assert.strictEqual(ss2.preferBlanking, 1);
                assert.strictEqual(ss2.allowExposures, 0);
                X.ForceScreenSaver(1);
                done();
            });
        });
    });

    it('host/access-control requests are accepted; ListHosts is empty', done => {
        X.ChangeHosts(0, 0, [127, 0, 0, 1]);
        X.SetAccessControl(0);
        X.SetCloseDownMode(0);
        X.ListHosts((err, res) => {
            if (err) return done(err);
            assert.strictEqual(res.mode, 0);
            assert.deepStrictEqual(res.hosts, []);
            X.NoOperation();
            X.GrabServer();
            X.UngrabServer();
            sync(X, () => done());
        });
    });

    it('CreateCursor from a depth-1 pixmap pair', done => {
        const src = X.AllocID();
        X.CreatePixmap(src, root, 1, 16, 16);
        const cid = X.AllocID();
        X.CreateCursor(cid, src, 0, { R: 0, G: 0, B: 0 }, { R: 0xffff, G: 0xffff, B: 0xffff }, 8, 8);
        sync(X, () => {
            assert.strictEqual(server.resources.get(cid).type, 'cursor');
            done();
        });
    });
});
