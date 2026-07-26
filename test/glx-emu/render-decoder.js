// Render-command decoder tests: command buffers are produced by the REAL
// client serializer (lib/ext/glxrender.js) and decoded into a
// RecordingBackend, so encoder and decoder are verified against each other
// byte-for-byte. No X server, no WebGL.
const assert = require('assert');
const createPipeline = require('../../lib/ext/glxrender');
const { RecordingBackend, RenderDecoder, WebGLBackend, BACKEND_METHODS } =
    require('../../browser/glx');

const fr = Math.fround;
const TAG = 7;

// wire the client-side render pipeline straight into a decoder: what the
// client would send over GLXRender/GLXRenderLarge is decoded immediately
function rig() {
    const backend = new RecordingBackend();
    const decoder = new RenderDecoder(backend);
    const GLX = {
        Render(ctx, data) {
            decoder.decode(Buffer.isBuffer(data) ? data : Buffer.concat(data));
        },
        RenderLarge(ctx, num, total, data) {
            decoder.renderLarge(num, total, data);
        },
        NewList(ctx, list, mode) {
            decoder.newList(list, mode);
        },
        EndList() {
            decoder.endList();
        },
        DeleteLists(ctx, list, range) {
            decoder.deleteLists(list, range);
        },
        GenLists(ctx, count, cb) {
            cb(null, decoder.genLists(count));
        },
        GenTextures() {},
        DeleteTextures() {},
        IsTexture() {},
        SwapBuffers() {},
        Finish() {},
        Flush() {}
    };
    const gl = createPipeline(GLX, TAG);
    return { backend, decoder, gl };
}

describe('glx-emu render decoder', () => {
    it('decodes a Begin/Color/Vertex/End triangle batch', () => {
        const { backend, gl } = rig();
        gl.Begin(gl.TRIANGLES);
        gl.Color3f(1, 0, 0);
        gl.Vertex3f(0, 0.8, 0);
        gl.Color3f(0, 1, 0);
        gl.Vertex3f(-0.8, -0.8, 0);
        gl.Color4f(0, 0, 1, 0.5);
        gl.Vertex2f(0.8, -0.8);
        gl.End();
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['begin', 4],
            ['color', 1, 0, 0, 1],
            ['vertex', 0, fr(0.8), 0],
            ['color', 0, 1, 0, 1],
            ['vertex', fr(-0.8), fr(-0.8), 0],
            ['color', 0, 0, 1, 0.5],
            ['vertex', fr(0.8), fr(-0.8), 0],
            ['end']
        ]);
    });

    it('decodes matrix commands (doubles exact, floats frounded)', () => {
        const { backend, gl } = rig();
        gl.MatrixMode(gl.PROJECTION);
        gl.LoadIdentity();
        gl.Ortho(-1.1, 1.1, -2, 2, -1, 1);
        gl.Frustum(-1, 1, -0.75, 0.75, 5, 60);
        gl.MatrixMode(gl.MODELVIEW);
        gl.PushMatrix();
        gl.Rotatef(20.5, 1, 0, 0);
        gl.Translatef(0, 0, -40);
        gl.Scalef(1, -1, 1);
        gl.PopMatrix();
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['matrixMode', 0x1701],
            ['loadIdentity'],
            ['ortho', -1.1, 1.1, -2, 2, -1, 1],
            ['frustum', -1, 1, -0.75, 0.75, 5, 60],
            ['matrixMode', 0x1700],
            ['pushMatrix'],
            ['rotate', fr(20.5), 1, 0, 0],
            ['translate', 0, 0, -40],
            ['scale', 1, -1, 1],
            ['popMatrix']
        ]);
    });

    it('decodes LoadMatrixf and MultMatrixf 16-float payloads', () => {
        const { backend, gl } = rig();
        const m = [];
        for (let i = 0; i < 16; ++i)
            m.push(i * 0.25);
        gl.LoadMatrixf(m);
        gl.MultMatrixf(m);
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['loadMatrix', m.map(fr)],
            ['multMatrix', m.map(fr)]
        ]);
    });

    it('decodes clears, masks and buffer state', () => {
        const { backend, gl } = rig();
        gl.ClearColor(0.2, 0.2, 0.2, 1);
        gl.ClearDepth(0.75); // double on the wire: stays exact
        gl.ClearStencil(3);
        gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        gl.ColorMask(0, 0, 0, 0);
        gl.DepthMask(false);
        gl.DepthMask(true);
        gl.StencilMask(0xff);
        gl.DrawBuffer(gl.BACK);
        gl.ReadBuffer(gl.FRONT);
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['clearColor', fr(0.2), fr(0.2), fr(0.2), 1],
            ['clearDepth', 0.75],
            ['clearStencil', 3],
            ['clear', 0x4500],
            ['colorMask', false, false, false, false],
            ['depthMask', false],
            ['depthMask', true],
            ['stencilMask', 0xff],
            ['drawBuffer', 0x0405],
            ['readBuffer', 0x0404]
        ]);
    });

    it('decodes enable/disable and pipeline state commands', () => {
        const { backend, gl } = rig();
        gl.Enable(gl.DEPTH_TEST);
        gl.Disable(gl.LIGHTING);
        gl.DepthFunc(gl.LEQUAL);
        gl.AlphaFunc(gl.GREATER, 0.25);
        gl.BlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.LogicOp(gl.XOR);
        gl.StencilFunc(gl.EQUAL, 1, 0xff);
        gl.StencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        gl.CullFace(gl.BACK);
        gl.FrontFace(gl.CW);
        gl.ShadeModel(gl.FLAT);
        gl.PolygonMode(gl.FRONT, gl.LINE);
        gl.Scissor(1, 2, 3, 4);
        gl.LineWidth(2.5);
        gl.LineStipple(2, 0x0F0F);
        gl.PointSize(4);
        gl.Hint(gl.PERSPECTIVE_CORRECTION_HINT, gl.NICEST);
        gl.Viewport(0, 0, 500, 400);
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['enable', 0x0B71],
            ['disable', 0x0B50],
            ['depthFunc', 0x0203],
            ['alphaFunc', 0x0204, 0.25],
            ['blendFunc', 0x0302, 0x0303],
            ['logicOp', 0x1506],
            ['stencilFunc', 0x0202, 1, 0xff],
            ['stencilOp', 0x1E00, 0x1E00, 0x1E01],
            ['cullFace', 0x0405],
            ['frontFace', 0x0900],
            ['shadeModel', 0x1D00],
            ['polygonMode', 0x0404, 0x1B01],
            ['scissor', 1, 2, 3, 4],
            ['lineWidth', 2.5],
            ['lineStipple', 2, 0x0F0F],
            ['pointSize', 4],
            ['hint', 0x0C50, 0x1102],
            ['viewport', 0, 0, 500, 400]
        ]);
    });

    it('decodes lighting, material and fog commands', () => {
        const { backend, gl } = rig();
        gl.Lightfv(gl.LIGHT0, gl.POSITION, [5, 5, 10, 0]);
        gl.Lightfv(gl.LIGHT1, gl.DIFFUSE, 0.25, 0.5, 0.75, 1);
        gl.LightModelf(gl.LIGHT_MODEL_TWO_SIDE, 1);
        gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, [0.8, 0.1, 0, 1]);
        gl.Materialf(gl.FRONT, gl.SHININESS, 40);
        gl.ColorMaterial(gl.FRONT_AND_BACK, gl.AMBIENT_AND_DIFFUSE);
        gl.Fogf(gl.FOG_MODE, gl.LINEAR);
        gl.Fogfv(gl.FOG_COLOR, [0.5, 0.5, 0.5, 1]);
        gl.Normal3fv([0, 1, 0]);
        gl.TexCoord2f(0.5, 0.25);
        gl.RasterPos2f(10, 20);
        gl.Rectf(0, 0, 1, 1);
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['light', 0x4000, 0x1203, [5, 5, 10, 0]],
            ['light', 0x4001, 0x1201, [0.25, 0.5, 0.75, 1]],
            ['lightModel', 0x0B52, [1]],
            ['material', 0x0404, 0x1602, [fr(0.8), fr(0.1), 0, 1]],
            ['material', 0x0404, 0x1601, [40]],
            ['colorMaterial', 0x0408, 0x1602],
            ['fog', 0x0B65, [0x2601]],
            ['fog', 0x0B66, [0.5, 0.5, 0.5, 1]],
            ['normal', 0, 1, 0],
            ['texCoord', 0.5, 0.25],
            ['rasterPos', 10, 20],
            ['rectf', 0, 0, 1, 1]
        ]);
    });

    it('decodes texture state commands', () => {
        const { backend, gl } = rig();
        gl.BindTexture(gl.TEXTURE_2D, 3);
        gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.TexParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.TexParameterfv(gl.TEXTURE_2D, gl.TEXTURE_BORDER_COLOR, [0, 0.5, 1, 1]);
        gl.TexEnvf(gl.TEXTURE_ENV, gl.TEXTURE_ENV_MODE, gl.MODULATE);
        gl.TexEnvi(gl.TEXTURE_ENV, gl.TEXTURE_ENV_MODE, gl.DECAL);
        gl.TexGeni(gl.S, gl.TEXTURE_GEN_MODE, gl.SPHERE_MAP);
        gl.TexGenfv(gl.T, gl.OBJECT_PLANE, [0, 1, 0, 0]);
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['bindTexture', 0x0DE1, 3],
            ['texParameter', 0x0DE1, 0x2801, [0x2601]],
            ['texParameter', 0x0DE1, 0x2800, [0x2600]],
            ['texParameter', 0x0DE1, 0x1004, [0, 0.5, 1, 1]],
            ['texEnv', 0x2300, 0x2200, [0x2100]],
            ['texEnv', 0x2300, 0x2200, [0x2101]],
            ['texGen', 0x2000, 0x2500, [0x2402]],
            ['texGen', 0x2001, 0x2501, [0, 1, 0, 0]]
        ]);
    });

    it('reassembles RenderLarge into a TexImage2D call with sliced payload', () => {
        const { backend, gl } = rig();
        const data = [255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30];
        gl.TexImage2D(gl.TEXTURE_2D, 0, 3, 2, 2, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
        assert.strictEqual(backend.calls.length, 1);
        const call = backend.calls[0];
        assert.strictEqual(call[0], 'texImage2D');
        // target, level, internalFormat, width, height, border, format, type
        assert.deepStrictEqual(call.slice(1, 9), [0x0DE1, 0, 3, 2, 2, 0, 0x1907, 0x1401]);
        assert.deepStrictEqual(Array.from(call[9]), data);
        assert.deepStrictEqual(call[10], {
            swapBytes: 0,
            lsbFirst: 0,
            rowLength: 0,
            skipRows: 0,
            skipPixels: 0,
            alignment: 4
        });
    });

    it('reassembles multi-chunk RenderLarge streams', () => {
        const backend = new RecordingBackend();
        const decoder = new RenderDecoder(backend);
        // craft a large-framed Viewport command ([u32 len][u32 opcode][4 ints],
        // layouts per lib/ext/glxrender.js) split across three chunks
        const cmd = Buffer.alloc(24);
        cmd.writeUInt32LE(24, 0);
        cmd.writeUInt32LE(191, 4);
        cmd.writeInt32LE(1, 8);
        cmd.writeInt32LE(2, 12);
        cmd.writeInt32LE(30, 16);
        cmd.writeInt32LE(40, 20);
        decoder.renderLarge(1, 3, cmd.slice(0, 8));
        decoder.renderLarge(2, 3, cmd.slice(8, 16));
        assert.deepStrictEqual(backend.calls, []); // nothing until the last chunk
        decoder.renderLarge(3, 3, cmd.slice(16));
        assert.deepStrictEqual(backend.calls, [['viewport', 1, 2, 30, 40]]);
    });

    it('records display lists and replays them on CallList', () => {
        const { backend, decoder, gl } = rig();
        let listId = null;
        gl.GenLists(2, (err, first) => {
            assert.ifError(err);
            listId = first;
        });
        assert.strictEqual(listId, 1);
        gl.NewList(listId, gl.COMPILE);
        gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, [1, 0, 0, 1]);
        gl.Begin(gl.QUADS);
        gl.Vertex3f(0, 0, 0);
        gl.End();
        gl.EndList();
        // COMPILE mode: nothing reached the backend while recording
        assert.deepStrictEqual(backend.calls, []);
        assert.strictEqual(decoder.isList(listId), true);
        gl.CallList(listId);
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['material', 0x0404, 0x1602, [1, 0, 0, 1]],
            ['begin', 7],
            ['vertex', 0, 0, 0],
            ['end']
        ]);
        // replay is repeatable
        gl.CallList(listId);
        gl.Render();
        assert.strictEqual(backend.calls.length, 8);
        // deletion
        gl.DeleteLists(listId, 2);
        assert.strictEqual(decoder.isList(listId), false);
        gl.CallList(listId);
        gl.Render();
        assert.strictEqual(backend.calls.length, 8); // deleted list is a no-op
    });

    it('executes while recording in COMPILE_AND_EXECUTE mode', () => {
        const { backend, decoder } = rig();
        decoder.genLists(1);
        decoder.newList(1, 0x1301); // COMPILE_AND_EXECUTE
        decoder.dispatch('begin', [4]);
        decoder.dispatch('vertex', [1, 2, 3]);
        decoder.dispatch('end', []);
        decoder.endList();
        assert.deepStrictEqual(backend.calls, [
            ['begin', 4],
            ['vertex', 1, 2, 3],
            ['end']
        ]);
        decoder.execList(1);
        assert.strictEqual(backend.calls.length, 6);
    });

    it('records nested CallList without expanding it', () => {
        const { backend, decoder } = rig();
        decoder.genLists(2);
        decoder.newList(1, 0x1300);
        decoder.dispatch('translate', [1, 0, 0]);
        decoder.endList();
        decoder.newList(2, 0x1300);
        decoder.dispatch('callList', [1]); // compiled, not expanded
        decoder.endList();
        assert.deepStrictEqual(backend.calls, []);
        decoder.execList(2);
        assert.deepStrictEqual(backend.calls, [['translate', 1, 0, 0]]);
        // list 1 changing changes list 2's replay (GL semantics)
        decoder.newList(1, 0x1300);
        decoder.dispatch('translate', [5, 0, 0]);
        decoder.endList();
        decoder.execList(2);
        assert.deepStrictEqual(backend.calls[1], ['translate', 5, 0, 0]);
    });

    it('decodes ProgramString and BindProgram', () => {
        const { backend, gl } = rig();
        gl.ProgramString(0x8620, 0x8875, '!!ARBvp1.0\nEND');
        gl.BindProgram(0x8620, 5);
        gl.Render();
        assert.deepStrictEqual(backend.calls, [
            ['programString', 0x8620, 0x8875, '!!ARBvp1.0\nEND'],
            ['bindProgram', 0x8620, 5]
        ]);
    });

    it('skips unknown opcodes by length and keeps decoding', () => {
        const backend = new RecordingBackend();
        const decoder = new RenderDecoder(backend);
        // [unknown opcode 999, len 12] [End, len 4]  (small framing:
        // u16 len, u16 opcode - see lib/ext/glxrender.js commandBuffer)
        const buf = Buffer.alloc(16);
        buf.writeUInt16LE(12, 0);
        buf.writeUInt16LE(999, 2);
        buf.writeUInt16LE(4, 12);
        buf.writeUInt16LE(23, 14);
        decoder.decode(buf);
        assert.deepStrictEqual(backend.calls, [['end']]);
        assert.strictEqual(decoder.stats.unknown[999], 1);
        assert.strictEqual(decoder.stats.commands, 2);
    });

    it('stops cleanly on a malformed zero-length command', () => {
        const backend = new RecordingBackend();
        const decoder = new RenderDecoder(backend);
        const buf = Buffer.alloc(8); // len 0 would loop forever if unguarded
        assert.doesNotThrow(() => decoder.decode(buf));
        assert.deepStrictEqual(backend.calls, []);
    });

    it('WebGLBackend implements the full backend method surface', () => {
        for (const name of BACKEND_METHODS)
            assert.strictEqual(typeof WebGLBackend.prototype[name], 'function',
                `WebGLBackend missing ${name}()`);
    });
});
