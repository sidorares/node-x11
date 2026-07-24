// Advanced fixed-function indirect GLX demo:
//
//  - planar reflection of a spinning cube via the stencil buffer
//  - projected planar shadow (shadow matrix onto the floor plane)
//  - sphere-map environment mapping on the cube (TexGen)
//  - dynamic texture: the floor texture is regenerated and re-uploaded
//    with TexImage2D every frame (plasma effect)
//
// Everything here is GL 1.x fixed-function - that's all indirect GLX can
// carry; there is no GLSL/ARB-program path over the wire on current
// servers. The X server must allow indirect GLX contexts (+iglx), see
// docs/ext/glx.md.
const x11 = require('../../lib');

const W = 500;
const H = 500;
const TEX = 64;                 // texture side
const LIGHT = [3.0, 6.0, 4.0];  // above and to the side of the cube

// shadow projection of light LIGHT onto plane y=0:
// M[r][c] = dot*(r==c) - L[r]*p[c], p=(0,1,0,0), L=(lx,ly,lz,1), dot=p.L=ly
// (column-major, as MultMatrixf expects)
const ly = LIGHT[1];
const shadowMatrix = [
    ly, 0, 0, 0,
    -LIGHT[0], 0, -LIGHT[2], -1,
    0, 0, ly, 0,
    0, 0, 0, ly
];

// static environment texture: fake sky-over-ground sphere map
function makeEnvTexture() {
    const data = new Array(TEX * TEX * 3);
    for (let y = 0; y < TEX; ++y) {
        for (let x = 0; x < TEX; ++x) {
            const i = (y * TEX + x) * 3;
            const v = y / (TEX - 1);
            if (v > 0.5) {          // sky: white horizon fading to blue
                const t = (v - 0.5) * 2;
                data[i] = 255 - 155 * t;
                data[i + 1] = 255 - 105 * t;
                data[i + 2] = 255;
            } else {                // ground: dark warm brown
                const t = v * 2;
                data[i] = 90 + 110 * t;
                data[i + 1] = 60 + 80 * t;
                data[i + 2] = 30 + 40 * t;
            }
        }
    }
    return data;
}

// dynamic floor texture: animated plasma checkerboard
function makeFloorTexture(t) {
    const data = new Array(TEX * TEX * 3);
    for (let y = 0; y < TEX; ++y) {
        for (let x = 0; x < TEX; ++x) {
            const i = (y * TEX + x) * 3;
            const checker = ((x >> 3) + (y >> 3)) & 1;
            const wave = 0.5 + 0.5 * Math.sin(x / 5 + t) * Math.sin(y / 5 + t * 0.7);
            data[i] = checker ? 40 + 60 * wave : 200 * wave;
            data[i + 1] = checker ? 90 + 120 * wave : 60;
            data[i + 2] = checker ? 60 : 120 + 100 * wave;
        }
    }
    return data;
}

x11.createClient((err, display) => {
    if (err) throw err;
    const X = display.client;
    const root = display.screen[0].root;

    X.require('glx', (err, GLX) => {
        if (err) throw err;
        GLX.GetVisualConfigs(0, (err, configs) => {
            if (err) throw err;
            const cfg = configs.find(c => c.rgbMode && c.doubleBufferMode &&
                c.depthBits > 0 && c.stencilBits > 0);
            if (!cfg)
                throw new Error('need a double-buffered RGBA visual with depth and stencil');

            let depth = 24;
            const depths = display.screen[0].depths;
            for (const d in depths)
                if (Object.keys(depths[d]).indexOf(String(cfg.visualID)) !== -1)
                    depth = parseInt(d);

            const cmid = X.AllocID();
            X.CreateColormap(cmid, root, cfg.visualID, 0);
            const win = X.AllocID();
            X.CreateWindow(win, root, 0, 0, W, H, 0, depth, 1, cfg.visualID,
                { colormap: cmid, backgroundPixel: 0, borderPixel: 0,
                  eventMask: x11.eventMask.StructureNotify });
            X.MapWindow(win);

            let started = false;
            X.on('event', ev => {
                if (ev.name !== 'MapNotify' || started)
                    return;
                started = true;
                setTimeout(start, 100); // XQuartz: drawable must be realized
            });

            function start() {
                const ctx = X.AllocID();
                GLX.CreateContext(ctx, cfg.visualID, 0, 0, 0);
                GLX.MakeCurrent(win, ctx, 0, (err, tag) => {
                    if (err) throw err;
                    const gl = GLX.renderPipeline(tag);
                    GLX.GenTextures(tag, 2, (err, textures) => {
                        if (err) throw err;
                        run(gl, textures[0], textures[1]);
                    });
                });
            }

            function run(gl, envTex, floorTex) {
                // one-time state
                gl.Enable(gl.DEPTH_TEST);
                gl.Enable(gl.NORMALIZE);
                gl.Enable(gl.LIGHTING);
                gl.Enable(gl.LIGHT0);
                gl.Viewport(0, 0, W, H);
                gl.MatrixMode(gl.PROJECTION);
                gl.LoadIdentity();
                gl.Frustum(-1, 1, -1, 1, 2, 60);
                gl.MatrixMode(gl.MODELVIEW);

                // static environment texture
                gl.BindTexture(gl.TEXTURE_2D, envTex);
                gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.TexImage2D(gl.TEXTURE_2D, 0, 3, TEX, TEX, 0, gl.RGB,
                    gl.UNSIGNED_BYTE, makeEnvTexture());

                // dynamic floor texture (contents re-uploaded per frame)
                gl.BindTexture(gl.TEXTURE_2D, floorTex);
                gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                let angle = 0;
                setInterval(() => {
                    angle += 2;
                    drawFrame(gl, envTex, floorTex, angle);
                    gl.SwapBuffers(win);
                }, 40);
            }

            function drawFloorGeometry(gl, textured) {
                gl.Begin(gl.QUADS);
                gl.Normal3f(0, 1, 0);
                if (textured) gl.TexCoord2f(0, 0);
                gl.Vertex3f(-3, 0, -3);
                if (textured) gl.TexCoord2f(0, 3);
                gl.Vertex3f(-3, 0, 3);
                if (textured) gl.TexCoord2f(3, 3);
                gl.Vertex3f(3, 0, 3);
                if (textured) gl.TexCoord2f(3, 0);
                gl.Vertex3f(3, 0, -3);
                gl.End();
            }

            function drawCubeGeometry(gl) {
                const s = 0.8;
                const faces = [
                    [[0, 0, 1], [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]],
                    [[0, 0, -1], [-s, -s, -s], [-s, s, -s], [s, s, -s], [s, -s, -s]],
                    [[0, 1, 0], [-s, s, -s], [-s, s, s], [s, s, s], [s, s, -s]],
                    [[0, -1, 0], [-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s]],
                    [[1, 0, 0], [s, -s, -s], [s, s, -s], [s, s, s], [s, -s, s]],
                    [[-1, 0, 0], [-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s]]
                ];
                gl.Begin(gl.QUADS);
                for (const f of faces) {
                    gl.Normal3f(f[0][0], f[0][1], f[0][2]);
                    for (let v = 1; v < 5; ++v)
                        gl.Vertex3f(f[v][0], f[v][1], f[v][2]);
                }
                gl.End();
            }

            // spinning cube, env-mapped when requested
            function drawCube(gl, envTex, angle, envMapped) {
                gl.PushMatrix();
                gl.Translatef(0, 1.4, 0);
                gl.Rotatef(angle, 0, 1, 0);
                gl.Rotatef(angle * 0.7, 1, 0, 0);
                gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, [0.9, 0.9, 0.9, 1]);
                if (envMapped) {
                    gl.BindTexture(gl.TEXTURE_2D, envTex);
                    gl.TexEnvf(gl.TEXTURE_ENV, gl.TEXTURE_ENV_MODE, gl.MODULATE);
                    gl.TexGeni(gl.S, gl.TEXTURE_GEN_MODE, gl.SPHERE_MAP);
                    gl.TexGeni(gl.T, gl.TEXTURE_GEN_MODE, gl.SPHERE_MAP);
                    gl.Enable(gl.TEXTURE_GEN_S);
                    gl.Enable(gl.TEXTURE_GEN_T);
                    gl.Enable(gl.TEXTURE_2D);
                }
                drawCubeGeometry(gl);
                if (envMapped) {
                    gl.Disable(gl.TEXTURE_2D);
                    gl.Disable(gl.TEXTURE_GEN_S);
                    gl.Disable(gl.TEXTURE_GEN_T);
                }
                gl.PopMatrix();
            }

            function drawFrame(gl, envTex, floorTex, angle) {
                // regenerate the dynamic floor texture
                gl.BindTexture(gl.TEXTURE_2D, floorTex);
                gl.TexImage2D(gl.TEXTURE_2D, 0, 3, TEX, TEX, 0, gl.RGB,
                    gl.UNSIGNED_BYTE, makeFloorTexture(angle / 30));

                gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
                gl.LoadIdentity();
                gl.Translatef(0, -1, -9);
                gl.Rotatef(20, 1, 0, 0);
                gl.Lightfv(gl.LIGHT0, gl.POSITION, [LIGHT[0], LIGHT[1], LIGHT[2], 1]);

                // 1. mark the floor area in the stencil buffer (no color/depth)
                gl.Enable(gl.STENCIL_TEST);
                gl.StencilFunc(gl.ALWAYS, 1, 0xff);
                gl.StencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);
                gl.ColorMask(0, 0, 0, 0);
                gl.DepthMask(false);
                drawFloorGeometry(gl, false);
                gl.ColorMask(1, 1, 1, 1);
                gl.DepthMask(true);

                // 2. reflected cube, only where the floor is
                gl.StencilFunc(gl.EQUAL, 1, 0xff);
                gl.StencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
                gl.PushMatrix();
                gl.Scalef(1, -1, 1);
                gl.Lightfv(gl.LIGHT0, gl.POSITION, [LIGHT[0], LIGHT[1], LIGHT[2], 1]);
                gl.FrontFace(gl.CW); // mirroring flips the winding
                drawCube(gl, envTex, angle, true);
                gl.FrontFace(gl.CCW);
                gl.PopMatrix();
                gl.Lightfv(gl.LIGHT0, gl.POSITION, [LIGHT[0], LIGHT[1], LIGHT[2], 1]);

                // 3. translucent textured floor over the reflection
                gl.Disable(gl.LIGHTING);
                gl.Enable(gl.BLEND);
                gl.BlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                gl.BindTexture(gl.TEXTURE_2D, floorTex);
                gl.TexEnvf(gl.TEXTURE_ENV, gl.TEXTURE_ENV_MODE, gl.MODULATE);
                gl.Enable(gl.TEXTURE_2D);
                gl.Color4f(1, 1, 1, 0.6);
                drawFloorGeometry(gl, true);
                gl.Disable(gl.TEXTURE_2D);

                // 4. projected shadow, flattened onto the floor plane
                gl.Disable(gl.DEPTH_TEST);
                gl.Color4f(0, 0, 0, 0.45);
                gl.PushMatrix();
                gl.MultMatrixf(shadowMatrix);
                gl.Translatef(0, 1.4, 0);
                gl.Rotatef(angle, 0, 1, 0);
                gl.Rotatef(angle * 0.7, 1, 0, 0);
                drawCubeGeometry(gl);
                gl.PopMatrix();
                gl.Enable(gl.DEPTH_TEST);
                gl.Disable(gl.BLEND);
                gl.Disable(gl.STENCIL_TEST);
                gl.Enable(gl.LIGHTING);

                // 5. the cube itself
                drawCube(gl, envTex, angle, true);

                gl.Render();
            }
        });
    });
    X.on('error', e => console.log('XERR', e.message));
});
