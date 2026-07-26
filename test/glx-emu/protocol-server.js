// GLX emulator against the real JS X server (lib/xserver) over a stream
// pair, driven by the real client: X.require('glx') + QueryVersion /
// GetVisualConfigs / CreateContext / MakeCurrent / Render round trips with
// a RecordingBackend. Self-skips if the server core is not available.
const assert = require('assert');
const { createGlxExtension, RecordingBackend } = require('../../browser/glx');

let serverAvailable = false;
let xserver = null;
try {
    xserver = require('../../lib/xserver');
    if (xserver.createServer && xserver.createStreamPair) {
        const probe = xserver.createServer({ width: 64, height: 64 });
        serverAvailable = typeof probe.registerExtension === 'function' &&
            typeof probe.addClientStream === 'function';
    }
} catch (e) {
    serverAvailable = false;
}

(serverAvailable ? describe : describe.skip)('glx-emu against the JS X server', function() {
    this.timeout(10000);

    let server, X, display, GLX, backend, swaps, surfaces;

    before(function(done) {
        const x11 = require('../../lib');
        server = xserver.createServer({ width: 640, height: 480 });
        backend = new RecordingBackend();
        swaps = [];
        surfaces = new Map();
        const ext = createGlxExtension({
            backend: backend,
            getDrawableSurface: xid => surfaces.get(xid) || null
        });
        server.registerExtension('GLX', ext);
        const [clientSide, serverSide] = xserver.createStreamPair();
        server.addClientStream(serverSide);
        x11.createClient({ display: ':9', stream: clientSide }, (err, dpy) => {
            assert.ifError(err);
            display = dpy;
            X = dpy.client;
            X.require('glx', (err, glx) => {
                assert.ifError(err);
                GLX = glx;
                done();
            });
        });
    });

    after(function() {
        if (X)
            X.terminate();
    });

    it('QueryVersion replies 1.4', function(done) {
        GLX.QueryVersion(1, 4, (err, version) => {
            assert.ifError(err);
            assert.deepStrictEqual(version, [1, 4]);
            done();
        });
    });

    it('advertises the server root visual as a GL visual', function(done) {
        GLX.GetVisualConfigs(0, (err, configs) => {
            assert.ifError(err);
            const cfg = configs.find(c => c.rgbMode && c.doubleBufferMode &&
                c.depthBits > 0);
            assert.ok(cfg, 'no double-buffered RGBA visual advertised');
            assert.strictEqual(cfg.visualID, server.rootVisual);
            done();
        });
    });

    it('CreateContext + MakeCurrent + Render + SwapBuffers round trip', function(done) {
        GLX.GetVisualConfigs(0, (err, configs) => {
            assert.ifError(err);
            const visual = configs[0].visualID;
            const win = X.AllocID();
            X.CreateWindow(win, display.screen[0].root, 0, 0, 100, 100,
                0, 0, 0, 0, {});
            surfaces.set(win, {
                width: 100,
                height: 100,
                notifySwap: pixels => swaps.push(pixels)
            });
            const ctx = X.AllocID();
            GLX.CreateContext(ctx, visual, 0, 0, 0);
            GLX.MakeCurrent(win, ctx, 0, (err, tag) => {
                assert.ifError(err);
                assert.ok(tag > 0);
                const gl = GLX.renderPipeline(tag);
                gl.Viewport(0, 0, 100, 100);
                gl.Begin(gl.TRIANGLES);
                gl.Color3f(1, 0, 0);
                gl.Vertex3f(0, 0, 0);
                gl.Vertex3f(1, 0, 0);
                gl.Vertex3f(0, 1, 0);
                gl.End();
                gl.Render();
                gl.SwapBuffers(win);
                GLX.Finish(tag, err => {
                    assert.ifError(err);
                    const names = backend.calls.map(c => c[0]);
                    assert.deepStrictEqual(names, [
                        'resize', 'viewport', 'begin', 'color',
                        'vertex', 'vertex', 'vertex', 'end',
                        'finish', 'readPixelsUint32', 'finish'
                    ]);
                    assert.strictEqual(swaps.length, 1);
                    assert.ok(swaps[0] instanceof Uint32Array);
                    assert.strictEqual(swaps[0].length, 100 * 100);
                    done();
                });
            });
        });
    });

    it('display lists work through the real server framing', function(done) {
        GLX.GetVisualConfigs(0, (err, configs) => {
            assert.ifError(err);
            const ctx = X.AllocID();
            GLX.CreateContext(ctx, configs[0].visualID, 0, 0, 0);
            GLX.MakeCurrent(display.screen[0].root, ctx, 0, (err, tag) => {
                assert.ifError(err);
                const gl = GLX.renderPipeline(tag);
                gl.GenLists(1, (err, list) => {
                    assert.ifError(err);
                    assert.ok(list > 0);
                    gl.NewList(list, gl.COMPILE);
                    gl.Translatef(1, 2, 3);
                    gl.EndList();
                    // Finish is a round-trip barrier: the server has
                    // processed everything sent before it replies
                    GLX.Finish(tag, err => {
                        assert.ifError(err);
                        const before = backend.calls.length;
                        gl.CallList(list);
                        gl.Render();
                        GLX.Finish(tag, err => {
                            assert.ifError(err);
                            assert.deepStrictEqual(backend.calls.slice(before),
                                [['translate', 1, 2, 3], ['finish']]);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('reports GLX errors with the assigned error codes', function(done) {
        GLX.MakeCurrent(display.screen[0].root, 0xdeadbeef, 0, err => {
            assert.ok(err);
            assert.strictEqual(err.message, 'GLXBadContext');
            assert.strictEqual(err.badParam, 0xdeadbeef);
            done();
            return true; // mark the error handled (client convention)
        });
    });
});
