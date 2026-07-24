// GLX / core-X interop: an off-screen GLX pbuffer renders a spinning
// scene, and a completely ordinary X window (default visual, no GL
// anywhere near it) displays the result.
//
// Per frame: render into the pbuffer -> glFinish -> glReadPixels the RGBA
// data over the wire -> repack to the server's ZPixmap layout -> core
// PutImage into the plain window. No GLX drawable is ever attached to the
// visible window, so this works with any window/visual - the same pattern
// works for compositing GL output into pixmaps, shared-memory consumers,
// image files, etc.
//
// Needs a server with indirect GLX enabled (+iglx), see docs/ext/glx.md.
const x11 = require('../../lib');

const SIZE = 240; // pbuffer and window size

x11.createClient((err, display) => {
    if (err) throw err;
    const X = display.client;
    const root = display.screen[0].root;
    const rootDepth = display.screen[0].root_depth;

    X.require('glx', (err, GLX) => {
        if (err) throw err;
        GLX.GetFBConfigs(0, (err, configs) => {
            if (err) throw err;
            const cfg = configs.find(c =>
                (c.DRAWABLE_TYPE & GLX.glxConst.PBUFFER_BIT) &&
                (c.RENDER_TYPE & GLX.glxConst.RGBA_BIT) &&
                c.DEPTH_SIZE > 0);
            if (!cfg)
                throw new Error('no pbuffer-capable RGBA fbconfig on this server');

            // plain window on the default visual - nothing GL about it
            const win = X.AllocID();
            X.CreateWindow(win, root, 0, 0, SIZE, SIZE, 0, 0, 0, 0,
                { backgroundPixel: display.screen[0].black_pixel,
                  eventMask: x11.eventMask.Exposure });
            X.MapWindow(win);
            const gc = X.AllocID();
            X.CreateGC(gc, win);

            // hidden GL surface
            const pbuffer = X.AllocID();
            GLX.CreatePbuffer(0, cfg.FBCONFIG_ID, pbuffer,
                [GLX.glxAttrib.PBUFFER_WIDTH, SIZE, GLX.glxAttrib.PBUFFER_HEIGHT, SIZE]);
            const ctx = X.AllocID();
            GLX.CreateNewContext(ctx, cfg.FBCONFIG_ID, 0, GLX.glxAttrib.RGBA_TYPE, 0, 0);

            GLX.MakeContextCurrent(0, pbuffer, pbuffer, ctx, (err, tag) => {
                if (err) throw err;
                const gl = GLX.renderPipeline(tag);

                gl.Enable(gl.DEPTH_TEST);
                gl.Viewport(0, 0, SIZE, SIZE);
                gl.MatrixMode(gl.PROJECTION);
                gl.LoadIdentity();
                gl.Frustum(-1, 1, -1, 1, 2, 20);
                gl.MatrixMode(gl.MODELVIEW);
                // tightly packed rows for ReadPixels
                GLX.PixelStorei(tag, GLX.PACK_ALIGNMENT, 1);

                // GL RGBA rows (bottom-up) -> ZPixmap BGRX rows (top-down)
                const zpixmap = Buffer.alloc(SIZE * SIZE * 4);
                function present(rgba) {
                    for (let y = 0; y < SIZE; ++y) {
                        const src = (SIZE - 1 - y) * SIZE * 4;
                        const dst = y * SIZE * 4;
                        for (let x = 0; x < SIZE; ++x) {
                            zpixmap[dst + x * 4] = rgba[src + x * 4 + 2];     // B
                            zpixmap[dst + x * 4 + 1] = rgba[src + x * 4 + 1]; // G
                            zpixmap[dst + x * 4 + 2] = rgba[src + x * 4];     // R
                            zpixmap[dst + x * 4 + 3] = 0;
                        }
                    }
                    X.PutImage(2, win, gc, SIZE, SIZE, 0, 0, 0, rootDepth, zpixmap);
                }

                let angle = 0;
                let busy = false;
                setInterval(() => {
                    if (busy) return; // don't outrun the readback
                    busy = true;
                    angle += 3;

                    gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    gl.LoadIdentity();
                    gl.Translatef(0, 0, -6);
                    gl.Rotatef(angle, 0, 0, 1);
                    gl.Begin(gl.TRIANGLES);
                    gl.Color3f(1, 0, 0);
                    gl.Vertex3f(0, 1.6, 0);
                    gl.Color3f(0, 1, 0);
                    gl.Vertex3f(-1.4, -0.8, 0);
                    gl.Color3f(0, 0, 1);
                    gl.Vertex3f(1.4, -0.8, 0);
                    gl.End();
                    gl.Render();

                    GLX.Finish(tag, err => {
                        if (err) throw err;
                        GLX.ReadPixels(tag, 0, 0, SIZE, SIZE, GLX.RGBA,
                            GLX.UNSIGNED_BYTE, 0, 0, (err, rgba) => {
                                if (err) throw err;
                                present(rgba);
                                busy = false;
                            });
                    });
                }, 40);
            });
        });
    });
    X.on('error', e => console.log('XERR', e.message));
});
