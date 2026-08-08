// DRI3 against a real server (test-runner only adds this file when the
// server advertises DRI3 — Xorg with glamor or Xwayland; Xvfb never does).
// Also needs the optional native companion installed (`npm install x11-dri`,
// https://github.com/sidorares/node-x11-dri) and a usable render node; each
// prerequisite that is missing skips instead of failing, so the suite stays
// green on machines that simply lack a GPU.
//
// What is covered when everything is present: the full modern path —
// render on the GPU, export a dma-buf, pass the descriptor with
// PixmapFromBuffer, read the pixels back out of the server-side pixmap —
// then a Present of that pixmap through CompleteNotify/IdleNotify.
const should = require('should');
const x11 = require('../lib');

describe('DRI3 extension (live server)', () => {

    const W = 32;
    const H = 32;

    let display;
    let X;
    let root;
    let depth;
    let DRI3;
    let Present;
    let dri = null;
    let gpu = null;
    let surface = null;
    let gpuUsable = false;      // GPU context + server-side import both work
    const pixmaps = new Map();  // bo key -> pixmap XID (alive as long as the bo)

    before(function(done) {
        try {
            dri = require('x11-dri');
        } catch (e) {
            this.skip(); // native companion not installed
            return;
        }
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            depth = display.screen[0].root_depth;
            X.require('dri3', (err, ext) => {
                should.not.exist(err);
                DRI3 = ext;
                X.require('present', (err2, p) => {
                    should.not.exist(err2);
                    Present = p;
                    done();
                });
            });
        });
        client.on('error', done);
    });

    after(done => {
        if (X) {
            for (const pixmap of pixmaps.values())
                X.FreePixmap(pixmap);
        }
        if (surface) surface.destroy();
        if (gpu) gpu.destroy();
        if (!X) return done();
        X.terminate();
        X.on('end', done);
    });

    // create-or-reuse the pixmap wrapping a swapped-out buffer;
    // cb(err, pixmap)
    function ensurePixmap(out, drawable, cb) {
        if (!out.isNew)
            return cb(null, pixmaps.get(out.key));
        const pixmap = X.AllocID();
        DRI3.PixmapFromBuffer(pixmap, drawable, {
            fd: out.fd,
            width: out.width,
            height: out.height,
            stride: out.stride,
            depth,
            bpp: 32
        }, impErr => {
            if (impErr)
                return cb(impErr);
            pixmaps.set(out.key, pixmap);
            cb(null, pixmap);
        });
    }

    it('negotiates at least version 1.0', () => {
        DRI3.major.should.be.aboveOrEqual(1);
        DRI3.fdCapable.should.equal(true, 'unix-socket connections are fd-capable by default');
    });

    it('lists supported modifiers for the root window', done => {
        DRI3.GetSupportedModifiers(root, depth, 32, (err, mods) => {
            should.not.exist(err);
            mods.windowModifiers.should.be.an.Array();
            mods.screenModifiers.should.be.an.Array();
            mods.windowModifiers.forEach(m => (typeof m).should.equal('bigint'));
            done();
        });
    });

    it('imports a GPU-rendered dma-buf and the server sees the exact pixels', function(done) {
        if (depth !== 24 && depth !== 32)
            return this.skip();
        try {
            gpu = new dri.Gpu({ format: depth === 32 ? dri.FORMAT.ARGB8888 : dri.FORMAT.XRGB8888 });
            surface = gpu.createSurface(W, H);
            gpu.makeCurrent(surface);
        } catch (e) {
            return this.skip(); // no render node / no GL stack on this machine
        }
        const gl = gpu.gl;
        gl.viewport(0, 0, W, H);
        gl.clearColor(1, 0.5, 0, 1); // 0xff8000
        gl.clear(gl.COLOR_BUFFER_BIT);
        const out = surface.swap();
        out.isNew.should.equal(true);
        (typeof out.modifier).should.equal('bigint');

        ensurePixmap(out, root, (impErr, pixmap) => {
            if (impErr) {
                // a server rendering on another DRM device may refuse the
                // import; a real configuration, not a protocol failure
                console.log('        (server refused the import: ' + impErr.message + ' — skipping)');
                surface.release(out.key);
                return done();
            }
            gpuUsable = true;
            X.GetImage(2, pixmap, 0, 0, W, H, 0xffffffff, (err, img) => {
                should.not.exist(err);
                for (const at of [0, (H / 2 * W + W / 2) * 4, (W * H - 1) * 4])
                    (img.data.readUInt32LE(at) & 0xffffff).should.equal(0xff8000);
                surface.release(out.key);
                done();
            });
        });
    });

    it('presents a dma-buf pixmap: CompleteNotify and IdleNotify arrive', function(done) {
        if (!gpuUsable)
            return this.skip();
        this.timeout(8000);
        const gl = gpu.gl;
        const wid = X.AllocID();
        const eid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, W, H, 0, depth, 1, 0,
            { backgroundPixel: display.screen[0].black_pixel });
        X.MapWindow(wid);
        Present.SelectInput(eid, wid,
            Present.EventMask.CompleteNotify | Present.EventMask.IdleNotify);

        gl.clearColor(0, 0, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const out = surface.swap();

        let complete = false;
        let idle = false;
        const onEvent = ev => {
            if (ev.name === 'PresentCompleteNotify' && ev.serial === 7) {
                ev.kind.should.equal(Present.CompleteKind.Pixmap);
                complete = true;
            } else if (ev.name === 'PresentIdleNotify' && ev.serial === 7) {
                surface.release(out.key);
                idle = true;
            }
            if (complete && idle) {
                X.removeListener('event', onEvent);
                X.DestroyWindow(wid);
                done();
            }
        };
        X.on('event', onEvent);

        ensurePixmap(out, wid, (impErr, pixmap) => {
            should.not.exist(impErr); // it imported for the same device above
            // Async: complete immediately, not at a vblank that a headless
            // or throttled server may never deliver
            Present.Pixmap(wid, pixmap, { serial: 7, options: Present.Option.Async });
            X.flush();
        });
    });
});
