const assert = require('assert');
const { boot } = require('./boot');

describe('xserver: colormaps and colors', () => {

    let server, display, X, root, cmap;

    beforeEach(done => {
        boot((err, ctx) => {
            if (err) return done(err);
            ({ server, display, X } = ctx);
            root = display.screen[0].root;
            cmap = display.screen[0].default_colormap;
            done();
        });
    });

    afterEach(() => {
        X.terminate();
        server = display = X = null;
    });

    it('AllocColor computes the TrueColor pixel from 16-bit rgb', done => {
        X.AllocColor(cmap, 0x1234, 0x5678, 0x9abc, (err, color) => {
            if (err) return done(err);
            assert.strictEqual(color.pixel, 0x12569a);
            assert.strictEqual(color.red, 0x12 * 257);
            assert.strictEqual(color.green, 0x56 * 257);
            assert.strictEqual(color.blue, 0x9a * 257);
            done();
        });
    });

    it('QueryColors is the inverse of the pixel computation', done => {
        X.QueryColors(cmap, [0xff8000, 0x000000, 0xffffff], (err, colors) => {
            if (err) return done(err);
            assert.deepStrictEqual(colors, [
                { red: 0xffff, green: 0x8080, blue: 0 },
                { red: 0, green: 0, blue: 0 },
                { red: 0xffff, green: 0xffff, blue: 0xffff }
            ]);
            done();
        });
    });

    it('LookupColor knows the built-in named-color table', done => {
        X.LookupColor(cmap, 'steelblue', (err, c) => {
            if (err) return done(err);
            assert.strictEqual(c.exactRed, 70 * 257);
            assert.strictEqual(c.exactGreen, 130 * 257);
            assert.strictEqual(c.exactBlue, 180 * 257);
            assert.strictEqual(c.visualRed, 70 * 257);
            X.LookupColor(cmap, 'Midnight Blue', (err2, c2) => {
                if (err2) return done(err2);
                assert.strictEqual(c2.exactRed, 25 * 257);
                assert.strictEqual(c2.exactBlue, 112 * 257);
                done();
            });
        });
    });

    it('AllocNamedColor returns the pixel for rgb.txt names', done => {
        X.AllocNamedColor(cmap, 'red', (err, c) => {
            if (err) return done(err);
            assert.strictEqual(c.pixel, 0xff0000);
            assert.strictEqual(c.exactRed, 0xffff);
            assert.strictEqual(c.exactGreen, 0);
            X.AllocNamedColor(cmap, 'grey', (err2, c2) => {
                if (err2) return done(err2);
                assert.strictEqual(c2.pixel, (190 << 16) | (190 << 8) | 190);
                done();
            });
        });
    });

    it('unknown color names produce BadName', done => {
        X.AllocNamedColor(cmap, 'nosuchcolorxyz', err => {
            assert.ok(err);
            assert.strictEqual(err.error, 15); // BadName
            done();
            return true;
        });
    });

    it('AllocColorCells/AllocColorPlanes fail with BadAlloc on TrueColor', done => {
        X.AllocColorCells(false, cmap, 1, 0, err => {
            assert.strictEqual(err.error, 11); // BadAlloc
            X.AllocColorPlanes(false, cmap, 1, 0, 0, 0, err2 => {
                assert.strictEqual(err2.error, 11);
                done();
                return true;
            });
            return true;
        });
    });

    it('StoreColors/StoreNamedColor fail with BadAccess (read-only visual)', done => {
        let first = false;
        X.on('error', err => {
            assert.strictEqual(err.error, 10); // BadAccess
            if (!first) {
                first = true;
                return;
            }
            done();
        });
        X.StoreColors(cmap, [{ pixel: 1, red: 2, green: 3, blue: 4 }]);
        X.StoreNamedColor(cmap, 5, 'red', 7);
    });

    it('colormap lifecycle requests are accepted', done => {
        const mid = X.AllocID();
        X.CreateColormap(mid, root, display.screen[0].root_visual, 0);
        X.InstallColormap(mid);
        X.UninstallColormap(mid);
        X.ListInstalledColormaps(root, (err, maps) => {
            if (err) return done(err);
            assert.deepStrictEqual(maps, [cmap]);
            X.FreeColormap(mid);
            // freed: further use errors with BadColormap
            X.InstallColormap(mid);
            X.once('error', err2 => {
                assert.strictEqual(err2.error, 12);
                assert.strictEqual(err2.badParam, mid);
                done();
            });
        });
    });
});
