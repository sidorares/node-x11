// Direct rendering, the modern way: a spinning cube drawn with OpenGL ES 2
// on the GPU and shown through DRI3 + Present — the same path Mesa's own
// EGL/X11 backend uses, reimplemented in JavaScript.
//
// How it works, per frame:
//
//   GPU (render node)                      X server
//   -----------------                      --------
//   glDraw... into a GBM buffer
//   swap() -> dma-buf fd  ---- fd over unix socket (DRI3) ---> pixmap
//   Present.Pixmap(window, pixmap)  ------ vsync'd flip/copy -> on screen
//                       <---- PresentCompleteNotify (pace the next frame)
//                       <---- PresentIdleNotify     (buffer reusable)
//
// No pixel data ever crosses the socket — only descriptors and 32-byte
// events. Compare examples/opengl/glxgears.js (indirect GLX: every GL call
// serialized through the server, GL 1.x only) with this file (any GLES the
// GPU speaks, zero-copy).
//
// Needs: a Linux host with a DRM render node (/dev/dri/renderD*) and a
// server with DRI3+Present (Xorg with glamor, or Xwayland). Run it from this
// folder — see README.md:
//
//     npm install && npm start
//
// Keys: q / Escape quit.
//
// By default frames are paced by the server (PresentCompleteNotify at the
// display's refresh — or slower on a throttled/headless compositor). Run with
// --async to present unthrottled (Present.Option.Async), the vblank_mode=0
// of this world.

const x11 = require('x11');

let dri;
try {
    dri = require('x11-dri');
} catch (e) {
    console.error('The native companion is not installed. Run `npm install` in this folder.');
    console.error('(x11-dri: https://github.com/sidorares/node-x11-dri — builds anywhere with a C toolchain)');
    console.error(`(${e.message})`);
    process.exit(1);
}

const START_W = 480;
const START_H = 360;
const ASYNC = process.argv.includes('--async');

// ---------------------------------------------------------------------------
// Tiny column-major mat4 (just enough for one cube)
// ---------------------------------------------------------------------------

const mat4 = {
    perspective(fovy, aspect, near, far) {
        const f = 1 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2 * far * near * nf, 0
        ]);
    },
    multiply(a, b) { // a * b
        const out = new Float32Array(16);
        for (let c = 0; c < 4; c++)
            for (let r = 0; r < 4; r++)
                out[c * 4 + r] =
                    a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                    a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        return out;
    },
    rotateXY(ax, ay) {
        const cx = Math.cos(ax), sx = Math.sin(ax);
        const cy = Math.cos(ay), sy = Math.sin(ay);
        // Ry * Rx
        return new Float32Array([
            cy, 0, -sy, 0,
            sx * sy, cx, sx * cy, 0,
            cx * sy, -sx, cx * cy, 0,
            0, 0, 0, 1
        ]);
    },
    translateZ(z) {
        const out = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1]);
        return out;
    }
};

// ---------------------------------------------------------------------------
// Cube geometry: 24 vertices (x,y,z,r,g,b), 36 indices
// ---------------------------------------------------------------------------

function cubeGeometry() {
    const faces = [
        // normal axis, sign, color
        { axis: 2, sign: 1, color: [0.90, 0.30, 0.24] },  // +z red
        { axis: 2, sign: -1, color: [0.20, 0.60, 0.86] }, // -z blue
        { axis: 0, sign: 1, color: [0.18, 0.80, 0.44] },  // +x green
        { axis: 0, sign: -1, color: [0.95, 0.77, 0.06] }, // -x yellow
        { axis: 1, sign: 1, color: [0.61, 0.35, 0.71] },  // +y purple
        { axis: 1, sign: -1, color: [0.90, 0.49, 0.13] }  // -y orange
    ];
    const verts = [];
    const idx = [];
    faces.forEach((f, fi) => {
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        corners.forEach(([u, v]) => {
            const p = [0, 0, 0];
            p[f.axis] = f.sign;
            p[(f.axis + 1) % 3] = f.sign > 0 ? u : -u; // keep faces CCW from outside
            p[(f.axis + 2) % 3] = v;
            verts.push(p[0], p[1], p[2], f.color[0], f.color[1], f.color[2]);
        });
        const b = fi * 4;
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    return { verts: new Float32Array(verts), idx: new Uint16Array(idx) };
}

// ---------------------------------------------------------------------------

x11.createClient((err, display) => {
    if (err) throw err;
    const X = display.client;
    const screen = display.screen[0];
    const root = screen.root;
    const depth = screen.root_depth;

    if (depth !== 24 && depth !== 32) {
        console.error(`root depth ${depth} — this example expects a 24/32-bit screen`);
        return X.terminate();
    }

    X.require('dri3', (err, DRI3) => {
        if (err) {
            console.error('DRI3 not available:', err.message);
            console.error('(Xvfb/Xephyr have no DRI3; run under Xorg or Xwayland.)');
            return X.terminate();
        }
        if (!DRI3.fdCapable) {
            console.error('connection cannot pass descriptors (remote/TCP display?)');
            return X.terminate();
        }
        X.require('present', (err, Present) => {
            if (err) throw err;
            start(X, screen, root, depth, DRI3, Present);
        });
    });
}).on('error', err => {
    // window killed by the WM, server gone, etc.
    console.error('X connection:', err.message || err);
    process.exit(0);
});

function start(X, screen, root, depth, DRI3, Present) {
    // --- GPU ---------------------------------------------------------------
    let gpu;
    try {
        gpu = new dri.Gpu({
            format: depth === 32 ? dri.FORMAT.ARGB8888 : dri.FORMAT.XRGB8888
        });
    } catch (e) {
        console.error('no usable GPU:', e.message);
        console.error('(try the CPU variant: software.js in this folder)');
        return X.terminate();
    }
    const gl = gpu.gl;

    // --- window ------------------------------------------------------------
    const wid = X.AllocID();
    const eid = X.AllocID();
    X.CreateWindow(wid, root, 0, 0, START_W, START_H, 0, depth, 1, 0, {
        backgroundPixel: screen.black_pixel,
        eventMask: x11.eventMask.StructureNotify | x11.eventMask.KeyPress
    });
    const title = Buffer.from('DRI3 cube - node-x11', 'latin1');
    X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, title);
    X.MapWindow(wid);

    Present.SelectInput(eid, wid,
        Present.EventMask.CompleteNotify | Present.EventMask.IdleNotify);

    // --- swapchain ---------------------------------------------------------
    // Buffers cycle through: rendered -> presented -> idle -> rendered again.
    // A "generation" is one window size; resizing retires the old surface
    // once the server has idled all of its buffers.
    let generation = null;
    const retiring = [];
    let serial = 0;
    let frames = 0;
    let mode = '?';
    let statT = Date.now();
    let needBuffer = false;
    let closing = false;

    // Buffer states: 'busy' — presented, the server still reads it (its GBM
    // buffer is locked on our side); 'free' — IdleNotify arrived, the GBM
    // buffer went back to the surface's pool (the pixmap stays valid: it
    // references the same GPU memory and is simply presented again the next
    // time the GPU hands us that buffer).
    function makeGeneration(w, h) {
        const surface = gpu.createSurface(w, h);
        gpu.makeCurrent(surface);
        return {
            surface,
            width: w,
            height: h,
            buffers: new Map(),  // bo key -> { pixmap, state }
            byPixmap: new Map(), // pixmap -> bo key
            inFlight: 0          // presents not yet idled
        };
    }

    function dropBuffer(gen, key, buf) {
        X.FreePixmap(buf.pixmap);
        gen.buffers.delete(key);
        gen.byPixmap.delete(buf.pixmap);
        if (gen.buffers.size === 0) {
            gen.surface.destroy();
            const i = retiring.indexOf(gen);
            if (i !== -1)
                retiring.splice(i, 1);
            return true;
        }
        return false;
    }

    function retire(gen) {
        // free-state buffers can go now; busy ones go as their IdleNotify
        // arrives (see the PresentIdleNotify handler)
        for (const [key, buf] of [...gen.buffers]) {
            if (buf.state === 'free')
                dropBuffer(gen, key, buf);
        }
        if (gen.buffers.size > 0)
            retiring.push(gen);
    }

    // --- GL scene (survives resize: it lives in the context) ---------------
    generation = makeGeneration(START_W, START_H); // also makes the context current
    const prog = buildProgram(gl, `
        attribute vec3 aPos;
        attribute vec3 aColor;
        uniform mat4 uMVP;
        varying vec3 vColor;
        void main() {
            gl_Position = uMVP * vec4(aPos, 1.0);
            vColor = aColor;
        }
    `, `
        precision mediump float;
        varying vec3 vColor;
        void main() {
            gl_FragColor = vec4(vColor, 1.0);
        }
    `);
    const geo = cubeGeometry();
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, geo.verts, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    const aColor = gl.getAttribLocation(prog, 'aColor');
    const uMVP = gl.getUniformLocation(prog, 'uMVP');
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const t0 = Date.now();

    function drawScene(w, h) {
        gl.viewport(0, 0, w, h);
        gl.clearColor(0.09, 0.09, 0.12, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 24, 12);
        gl.enableVertexAttribArray(aColor);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

        const t = (Date.now() - t0) / 1000;
        const proj = mat4.perspective(Math.PI / 4, w / h, 0.1, 100);
        const mv = mat4.multiply(mat4.translateZ(-6), mat4.rotateXY(t * 0.9, t * 1.3));
        gl.uniformMatrix4fv(uMVP, false, mat4.multiply(proj, mv));
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
    }

    // --- frame loop, paced by PresentCompleteNotify -------------------------
    // At most 2 presents outstanding: enough to keep the pipe full, small
    // enough that the ~4-buffer GBM surface never starves the renderer.
    const MAX_IN_FLIGHT = 2;

    function renderFrame(targetMsc) {
        if (closing || !generation)
            return;
        const gen = generation;
        if (gen.inFlight >= MAX_IN_FLIGHT) {
            needBuffer = true; // resumed by the next IdleNotify
            return;
        }
        drawScene(gen.width, gen.height);

        const out = gen.surface.swap();
        if (out === null) {
            // every buffer is still with the server — wait for an IdleNotify,
            // then draw again (the failed swap's frame was not kept)
            needBuffer = true;
            return;
        }

        const present = () => {
            if (closing || gen !== generation)
                return;
            serial = (serial + 1) >>> 0;
            const buf = gen.buffers.get(out.key);
            buf.state = 'busy';
            gen.inFlight++;
            Present.Pixmap(wid, buf.pixmap, {
                serial,
                options: ASYNC ? Present.Option.Async : Present.Option.None,
                targetMsc: ASYNC ? 0 : (targetMsc || 0)
            });
            X.flush();
        };

        if (out.isNew) {
            // first time this GBM buffer surfaces: wrap its dma-buf in a pixmap
            const pixmap = X.AllocID();
            gen.buffers.set(out.key, { pixmap, state: 'busy' });
            gen.byPixmap.set(pixmap, out.key);
            DRI3.PixmapFromBuffer(pixmap, wid, {
                fd: out.fd,
                width: out.width,
                height: out.height,
                stride: out.stride,
                depth,
                bpp: 32
            }, impErr => {
                if (impErr) {
                    console.error('server could not import the GPU buffer:', impErr.message);
                    console.error('(cross-device setup? try GBM_USE.LINEAR, or the software variant)');
                    return shutdown(1);
                }
                present();
            });
        } else {
            present();
        }
    }

    // --- events --------------------------------------------------------------
    X.on('event', ev => {
        switch (ev.name) {
        case 'PresentCompleteNotify':
            if (ev.kind === Present.CompleteKind.Pixmap) {
                frames++;
                mode = ['Copy', 'Flip', 'Skip', 'SuboptimalCopy'][ev.mode] || ev.mode;
                const now = Date.now();
                if (now - statT >= 2000) {
                    console.log(`${(frames * 1000 / (now - statT)).toFixed(1)} fps (${mode}, msc ${ev.msc})`);
                    frames = 0;
                    statT = now;
                }
                renderFrame(ev.msc + 1);
            }
            break;

        case 'PresentIdleNotify': {
            const gen = generation && generation.byPixmap.has(ev.pixmap)
                ? generation
                : retiring.find(g => g.byPixmap.has(ev.pixmap));
            if (!gen)
                break;
            const key = gen.byPixmap.get(ev.pixmap);
            const buf = gen.buffers.get(key);
            gen.inFlight = Math.max(0, gen.inFlight - 1);
            if (buf.state === 'busy') {
                buf.state = 'free';
                gen.surface.release(key); // GBM may hand it to the GPU again
            }
            if (gen === generation) {
                if (needBuffer) {
                    needBuffer = false;
                    renderFrame(0);
                }
            } else {
                dropBuffer(gen, key, buf); // retiring after a resize
            }
            break;
        }

        case 'ConfigureNotify':
            if (ev.wid === wid && generation &&
                (ev.width !== generation.width || ev.height !== generation.height)) {
                retire(generation);
                generation = makeGeneration(ev.width, ev.height);
                needBuffer = false;
                renderFrame(0);
            }
            break;

        case 'KeyPress':
            if (ev.keycode === 9 || ev.keycode === 24) // Esc, q (pc105)
                shutdown(0);
            break;

        case 'DestroyNotify':
            if (ev.wid === wid)
                shutdown(0);
            break;
        }
    });

    function shutdown(code) {
        if (closing) return;
        closing = true;
        try {
            const gens = generation ? [generation, ...retiring] : [...retiring];
            generation = null;
            retiring.length = 0;
            for (const gen of gens) {
                for (const buf of gen.buffers.values())
                    X.FreePixmap(buf.pixmap);
                gen.surface.destroy(); // releases still-locked buffers itself
            }
            gpu.destroy();
            X.DestroyWindow(wid);
        } finally {
            X.terminate();
            process.exitCode = code;
        }
    }
    process.on('SIGINT', () => shutdown(0));

    // --- go ------------------------------------------------------------------
    console.log(`GPU: ${gl.getString(gl.RENDERER)} on ${gpu.devicePath}`);
    console.log(`DRI3 ${DRI3.major}.${DRI3.minor}, Present ${Present.major}.${Present.minor}` +
        (ASYNC ? ' (async presents)' : ''));
    console.log('q or Esc to quit');
    renderFrame(0);
}

function buildProgram(gl, vsSource, fsSource) {
    const compile = (type, source) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, source);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
            throw new Error(`shader compile failed: ${gl.getShaderInfoLog(sh)}`);
        return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error(`program link failed: ${gl.getProgramInfoLog(prog)}`);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
}
