// Classic mesh viewer over indirect GLX: the Utah teapot (default) or the
// Stanford bunny, straight from npm:
//
//     node examples/opengl/teapot.js          # the teapot
//     node examples/opengl/teapot.js bunny    # the bunny
//
// Both meshes come from the zero-dependency public-domain packages
// `teapot` and `bunny` (devDependencies of this repo), which export
// {positions: [[x,y,z],...], cells: [[a,b,c],...]}. Neither ships normals,
// so smooth per-vertex normals are computed here (area-weighted face
// normal accumulation). Geometry is compiled into a server-side display
// list once; each frame just replays it.
//
// Needs a server with indirect GLX enabled (+iglx), see docs/ext/glx.md.
const x11 = require('../../lib');

const MESHES = {
    teapot: { load: () => require('teapot') },
    bunny: { load: () => require('bunny') }
};

const which = process.argv[2] || 'teapot';
if (!MESHES[which]) {
    console.error(`unknown mesh "${which}" - use: ${Object.keys(MESHES).join(', ')}`);
    process.exit(1);
}
const mesh = MESHES[which].load();

// center the mesh and scale it to fit a ~unit radius
function normalizeMesh(positions) {
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (const v of positions)
        for (let i = 0; i < 3; ++i) {
            mn[i] = Math.min(mn[i], v[i]);
            mx[i] = Math.max(mx[i], v[i]);
        }
    const center = [0, 1, 2].map(i => (mn[i] + mx[i]) / 2);
    const scale = 2.6 / Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
    return positions.map(v => [
        (v[0] - center[0]) * scale,
        (v[1] - center[1]) * scale,
        (v[2] - center[2]) * scale
    ]);
}

// smooth per-vertex normals: accumulate (area-weighted) face normals
function computeNormals(positions, cells) {
    const normals = positions.map(() => [0, 0, 0]);
    for (const cell of cells) {
        const [a, b, c] = cell.map(i => positions[i]);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0]
        ];
        for (const i of cell) {
            normals[i][0] += n[0];
            normals[i][1] += n[1];
            normals[i][2] += n[2];
        }
    }
    for (const n of normals) {
        const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
        n[0] /= len;
        n[1] /= len;
        n[2] /= len;
    }
    return normals;
}

const positions = normalizeMesh(mesh.positions);
const normals = computeNormals(positions, mesh.cells);

const W = 500;
const H = 500;

x11.createClient((err, display) => {
    if (err) throw err;
    const X = display.client;
    const root = display.screen[0].root;

    X.require('glx', (err, GLX) => {
        if (err) throw err;
        GLX.GetVisualConfigs(0, (err, configs) => {
            if (err) throw err;
            const cfg = configs.find(c => c.rgbMode && c.doubleBufferMode && c.depthBits > 0);
            if (!cfg)
                throw new Error('no double-buffered RGBA GL visual on this server');

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

                    gl.Enable(gl.DEPTH_TEST);
                    gl.Enable(gl.LIGHTING);
                    gl.Enable(gl.LIGHT0);
                    gl.Enable(gl.LIGHT1);
                    gl.Lightfv(gl.LIGHT0, gl.DIFFUSE, [1, 0.95, 0.85, 1]);
                    gl.Lightfv(gl.LIGHT1, gl.DIFFUSE, [0.25, 0.3, 0.45, 1]);
                    gl.Viewport(0, 0, W, H);
                    gl.MatrixMode(gl.PROJECTION);
                    gl.LoadIdentity();
                    gl.Frustum(-1, 1, -1, 1, 2, 20);
                    gl.MatrixMode(gl.MODELVIEW);

                    gl.GenLists(1, (err, list) => {
                        if (err) throw err;
                        // compile the whole mesh into a server-side list
                        gl.NewList(list, gl.COMPILE);
                        gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, [0.85, 0.75, 0.55, 1]);
                        gl.Materialfv(gl.FRONT, gl.SPECULAR, [0.9, 0.9, 0.9, 1]);
                        gl.Materialf(gl.FRONT, gl.SHININESS, 40);
                        gl.Begin(gl.TRIANGLES);
                        for (const cell of mesh.cells) {
                            for (const i of cell) {
                                gl.Normal3fv(normals[i]);
                                gl.Vertex3fv(positions[i]);
                            }
                        }
                        gl.End();
                        gl.Render();
                        gl.EndList();

                        let angle = 0;
                        setInterval(() => {
                            angle += 1.5;
                            gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                            gl.LoadIdentity();
                            gl.Translatef(0, 0, -4.5);
                            gl.Lightfv(gl.LIGHT0, gl.POSITION, [3, 4, 5, 0]);
                            gl.Lightfv(gl.LIGHT1, gl.POSITION, [-4, -2, 2, 0]);
                            gl.Rotatef(15, 1, 0, 0);
                            gl.Rotatef(angle, 0, 1, 0);
                            gl.CallList(list);
                            gl.Render();
                            gl.SwapBuffers(win);
                        }, 40);
                    });
                });
            }
        });
    });
    X.on('error', e => console.log('XERR', e.message));
});
