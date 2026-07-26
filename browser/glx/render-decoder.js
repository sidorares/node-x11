/*
  GLX Render / RenderLarge command-stream decoder.

  Decodes the X_GLrop_* command stream produced by the client serializer in
  lib/ext/glxrender.js (which is the authoritative list of opcodes and byte
  layouts this decoder must understand) into calls on a GL backend
  (gl-backend.js).

  Framing:
  - Render (small): sequence of [u16 totalLength][u16 opcode][payload],
    lengths include the 4-byte header and are 4-aligned.
  - RenderLarge (reassembled): [u32 totalLength][u32 opcode][payload];
    the request stream carries requestNum/totalRequests chunking which
    renderLarge() reassembles before decoding.

  Unknown opcodes are skipped by length and counted in stats.unknown —
  the decoder never throws on foreign input.

  Display lists live here (not in the backend): NewList/EndList record the
  decoded commands; CallList replays them by re-dispatching to the backend.
  The GLX single requests for list management (GenLists & co) are routed in
  by the protocol extension.
*/

const COMPILE = 0x1300;
const COMPILE_AND_EXECUTE = 0x1301;

// ---- payload readers (offsets relative to payload start) ------------------

function u32(b, o) {
    return b.readUInt32LE(o);
}

function i32(b, o) {
    return b.readInt32LE(o);
}

function f32(b, o) {
    return b.readFloatLE(o);
}

function f64(b, o) {
    return b.readDoubleLE(o);
}

function floats(b, o, count) {
    const out = new Array(count);
    for (let i = 0; i < count; ++i)
        out[i] = f32(b, o + i * 4);
    return out;
}

// ---- opcode table ---------------------------------------------------------
// handler(decoder, buf, off, payloadLen); off = payload start

const handlers = {
    1: (d, b, o) => d.dispatch('callList', [u32(b, o)]),                    // CallList
    3: (d, b, o) => d.dispatch('listBase', [u32(b, o)]),                    // ListBase
    4: (d, b, o) => d.dispatch('begin', [u32(b, o)]),                       // Begin
    8: (d, b, o) => d.dispatch('color', [f32(b, o), f32(b, o + 4), f32(b, o + 8), 1]),          // Color3fv
    16: (d, b, o) => d.dispatch('color', [f32(b, o), f32(b, o + 4), f32(b, o + 8), f32(b, o + 12)]), // Color4fv
    23: d => d.dispatch('end', []),                                         // End
    30: (d, b, o) => d.dispatch('normal', floats(b, o, 3)),                 // Normal3fv
    34: (d, b, o) => d.dispatch('rasterPos', [f32(b, o), f32(b, o + 4)]),   // RasterPos2f
    46: (d, b, o) => d.dispatch('rectf', floats(b, o, 4)),                  // Rectf
    54: (d, b, o) => d.dispatch('texCoord', [f32(b, o), f32(b, o + 4)]),    // TexCoord2fv
    66: (d, b, o) => d.dispatch('vertex', [f32(b, o), f32(b, o + 4), 0]),   // Vertex2f
    70: (d, b, o) => d.dispatch('vertex', floats(b, o, 3)),                 // Vertex3fv
    78: (d, b, o) => d.dispatch('colorMaterial', [u32(b, o), u32(b, o + 4)]),   // ColorMaterial
    79: (d, b, o) => d.dispatch('cullFace', [u32(b, o)]),                   // CullFace
    80: (d, b, o) => d.dispatch('fog', [u32(b, o), [f32(b, o + 4)]]),       // Fogf
    81: (d, b, o, len) => d.dispatch('fog', [u32(b, o), floats(b, o + 4, (len - 4) / 4)]), // Fogfv
    84: (d, b, o) => d.dispatch('frontFace', [u32(b, o)]),                  // FrontFace
    85: (d, b, o) => d.dispatch('hint', [u32(b, o), u32(b, o + 4)]),        // Hint
    87: (d, b, o) => d.dispatch('light', [u32(b, o), u32(b, o + 4), floats(b, o + 8, 4)]),  // Lightfv
    90: (d, b, o) => d.dispatch('lightModel', [u32(b, o), [f32(b, o + 4)]]),    // LightModelf
    94: (d, b, o) => d.dispatch('lineStipple', [u32(b, o), u32(b, o + 4)]), // LineStipple
    95: (d, b, o) => d.dispatch('lineWidth', [f32(b, o)]),                  // LineWidth
    96: (d, b, o) => d.dispatch('material', [u32(b, o), u32(b, o + 4), [f32(b, o + 8)]]),   // Materialf
    97: (d, b, o) => d.dispatch('material', [u32(b, o), u32(b, o + 4), floats(b, o + 8, 4)]), // Materialfv
    100: (d, b, o) => d.dispatch('pointSize', [f32(b, o)]),                 // PointSize
    101: (d, b, o) => d.dispatch('polygonMode', [u32(b, o), u32(b, o + 4)]),    // PolygonMode
    103: (d, b, o) => d.dispatch('scissor', [i32(b, o), i32(b, o + 4), i32(b, o + 8), i32(b, o + 12)]), // Scissor
    104: (d, b, o) => d.dispatch('shadeModel', [u32(b, o)]),                // ShadeModel
    105: (d, b, o) => d.dispatch('texParameter', [u32(b, o), u32(b, o + 4), [f32(b, o + 8)]]),  // TexParameterf
    106: (d, b, o, len) => d.dispatch('texParameter', [u32(b, o), u32(b, o + 4), floats(b, o + 8, (len - 8) / 4)]), // TexParameterfv
    107: (d, b, o) => d.dispatch('texParameter', [u32(b, o), u32(b, o + 4), [i32(b, o + 8)]]),  // TexParameteri
    110: texImage2D,                                                        // TexImage2D
    111: (d, b, o) => d.dispatch('texEnv', [u32(b, o), u32(b, o + 4), [f32(b, o + 8)]]),    // TexEnvf
    113: (d, b, o) => d.dispatch('texEnv', [u32(b, o), u32(b, o + 4), [i32(b, o + 8)]]),    // TexEnvi
    118: (d, b, o, len) => d.dispatch('texGen', [u32(b, o), u32(b, o + 4), floats(b, o + 8, (len - 8) / 4)]),   // TexGenfv
    119: (d, b, o) => d.dispatch('texGen', [u32(b, o), u32(b, o + 4), [i32(b, o + 8)]]),    // TexGeni
    126: (d, b, o) => d.dispatch('drawBuffer', [u32(b, o)]),                // DrawBuffer
    127: (d, b, o) => d.dispatch('clear', [u32(b, o)]),                     // Clear
    130: (d, b, o) => d.dispatch('clearColor', floats(b, o, 4)),            // ClearColor
    131: (d, b, o) => d.dispatch('clearStencil', [i32(b, o)]),              // ClearStencil
    132: (d, b, o) => d.dispatch('clearDepth', [f64(b, o)]),                // ClearDepth
    133: (d, b, o) => d.dispatch('stencilMask', [u32(b, o)]),               // StencilMask
    134: (d, b, o) => d.dispatch('colorMask', [!!b[o], !!b[o + 1], !!b[o + 2], !!b[o + 3]]),    // ColorMask
    135: (d, b, o) => d.dispatch('depthMask', [!!u32(b, o)]),               // DepthMask
    138: (d, b, o) => d.dispatch('disable', [u32(b, o)]),                   // Disable
    139: (d, b, o) => d.dispatch('enable', [u32(b, o)]),                    // Enable
    159: (d, b, o) => d.dispatch('alphaFunc', [u32(b, o), f32(b, o + 4)]),  // AlphaFunc
    160: (d, b, o) => d.dispatch('blendFunc', [u32(b, o), u32(b, o + 4)]),  // BlendFunc
    161: (d, b, o) => d.dispatch('logicOp', [u32(b, o)]),                   // LogicOp
    162: (d, b, o) => d.dispatch('stencilFunc', [u32(b, o), i32(b, o + 4), u32(b, o + 8)]), // StencilFunc
    163: (d, b, o) => d.dispatch('stencilOp', [u32(b, o), u32(b, o + 4), u32(b, o + 8)]),   // StencilOp
    164: (d, b, o) => d.dispatch('depthFunc', [u32(b, o)]),                 // DepthFunc
    171: (d, b, o) => d.dispatch('readBuffer', [u32(b, o)]),                // ReadBuffer
    175: (d, b, o) => d.dispatch('frustum', doubles6(b, o)),                // Frustum
    176: d => d.dispatch('loadIdentity', []),                               // LoadIdentity
    177: (d, b, o) => d.dispatch('loadMatrix', [floats(b, o, 16)]),         // LoadMatrixf
    179: (d, b, o) => d.dispatch('matrixMode', [u32(b, o)]),                // MatrixMode
    180: (d, b, o) => d.dispatch('multMatrix', [floats(b, o, 16)]),         // MultMatrixf
    182: (d, b, o) => d.dispatch('ortho', doubles6(b, o)),                  // Ortho
    183: d => d.dispatch('popMatrix', []),                                  // PopMatrix
    184: d => d.dispatch('pushMatrix', []),                                 // PushMatrix
    186: (d, b, o) => d.dispatch('rotate', floats(b, o, 4)),                // Rotatef
    188: (d, b, o) => d.dispatch('scale', floats(b, o, 3)),                 // Scalef
    190: (d, b, o) => d.dispatch('translate', floats(b, o, 3)),             // Translatef
    191: (d, b, o) => d.dispatch('viewport', [i32(b, o), i32(b, o + 4), i32(b, o + 8), i32(b, o + 12)]),    // Viewport
    4117: (d, b, o) => d.dispatch('bindTexture', [u32(b, o), u32(b, o + 4)]),   // BindTexture
    4180: (d, b, o) => d.dispatch('bindProgram', [u32(b, o), u32(b, o + 4)]),   // BindProgramARB
    4217: programString                                                     // ProgramStringARB
};

// ProgramStringARB: target, format, length, then the program source
function programString(d, b, o) {
    const target = u32(b, o);
    const format = u32(b, o + 4);
    const len = u32(b, o + 8);
    const src = b.toString('latin1', o + 12, o + 12 + len);
    d.dispatch('programString', [target, format, src]);
}

function doubles6(b, o) {
    const out = new Array(6);
    for (let i = 0; i < 6; ++i)
        out[i] = f64(b, o + i * 8);
    return out;
}

// TexImage2D: 20 bytes of pixel-unpack state, 32 bytes of arguments, then
// the pixel data (layout per lib/ext/glxrender.js TexImage2D)
function texImage2D(d, b, o, payloadLen) {
    const unpack = {
        swapBytes: b[o],
        lsbFirst: b[o + 1],
        rowLength: u32(b, o + 4),
        skipRows: u32(b, o + 8),
        skipPixels: u32(b, o + 12),
        alignment: u32(b, o + 16)
    };
    const target = u32(b, o + 20);
    const level = u32(b, o + 24);
    const internalFormat = u32(b, o + 28);
    const width = u32(b, o + 32);
    const height = u32(b, o + 36);
    const border = u32(b, o + 40);
    const format = u32(b, o + 44);
    const type = u32(b, o + 48);
    const data = b.slice(o + 52, o + payloadLen);
    d.dispatch('texImage2D', [target, level, internalFormat, width, height,
        border, format, type, data, unpack]);
}

const MAX_LIST_NESTING = 64;

class RenderDecoder {
    constructor(backend) {
        this.backend = backend;
        this.stats = { commands: 0, unknown: {} };
        this.lists = new Map();     // list id -> [[name, args], ...]
        this.recording = null;      // { id, mode, cmds }
        this.listBase = 0;
        this.nextList = 1;
        this.pendingLarge = null;   // { total, chunks }
    }

    // decode a GLXRender data stream (small command framing)
    decode(buf) {
        let off = 0;
        while (off + 4 <= buf.length) {
            const len = buf.readUInt16LE(off);
            const opcode = buf.readUInt16LE(off + 2);
            if (len < 4 || off + len > buf.length)
                break; // malformed tail; stop rather than loop forever
            this._command(opcode, buf, off + 4, len - 4);
            off += (len + 3) & ~3;
        }
    }

    // decode a reassembled GLXRenderLarge stream (large command framing)
    decodeLarge(buf) {
        let off = 0;
        while (off + 8 <= buf.length) {
            const len = buf.readUInt32LE(off);
            const opcode = buf.readUInt32LE(off + 4);
            if (len < 8 || off + len > buf.length)
                break;
            this._command(opcode, buf, off + 8, len - 8);
            off += (len + 3) & ~3;
        }
    }

    // one GLXRenderLarge request; decodes once all chunks have arrived
    renderLarge(requestNum, requestTotal, data) {
        if (requestNum === 1)
            this.pendingLarge = { total: requestTotal, chunks: [] };
        if (!this.pendingLarge)
            return;
        if (data.length)
            this.pendingLarge.chunks.push(data);
        if (requestNum >= this.pendingLarge.total) {
            const all = Buffer.concat(this.pendingLarge.chunks);
            this.pendingLarge = null;
            this.decodeLarge(all);
        }
    }

    _command(opcode, buf, off, payloadLen) {
        this.stats.commands++;
        const h = handlers[opcode];
        if (!h) {
            this.stats.unknown[opcode] = (this.stats.unknown[opcode] || 0) + 1;
            return;
        }
        h(this, buf, off, payloadLen);
    }

    // route a decoded command: record into an open display list or execute
    dispatch(name, args) {
        if (this.recording) {
            this.recording.cmds.push([name, args]);
            if (this.recording.mode === COMPILE_AND_EXECUTE)
                this.exec(name, args);
        } else {
            this.exec(name, args);
        }
    }

    exec(name, args, depth = 0) {
        if (name === 'callList')
            return this.execList(args[0], depth);
        if (name === 'listBase') {
            this.listBase = args[0];
            return;
        }
        const fn = this.backend[name];
        if (typeof fn === 'function')
            fn.apply(this.backend, args);
    }

    execList(id, depth = 0) {
        if (depth > MAX_LIST_NESTING)
            return;
        const cmds = this.lists.get(id);
        if (!cmds)
            return;
        for (const [name, args] of cmds)
            this.exec(name, args, depth + 1);
    }

    // ---- display-list management (driven by GLX single requests) ---------

    genLists(count) {
        if (count <= 0)
            return 0;
        const first = this.nextList;
        this.nextList += count;
        for (let i = 0; i < count; ++i)
            this.lists.set(first + i, []);
        return first;
    }

    newList(id, mode) {
        this.recording = {
            id: id,
            mode: mode === COMPILE_AND_EXECUTE ? COMPILE_AND_EXECUTE : COMPILE,
            cmds: []
        };
    }

    endList() {
        if (!this.recording)
            return;
        this.lists.set(this.recording.id, this.recording.cmds);
        if (this.recording.id >= this.nextList)
            this.nextList = this.recording.id + 1;
        this.recording = null;
    }

    deleteLists(first, range) {
        for (let i = 0; i < range; ++i)
            this.lists.delete(first + i);
    }

    isList(id) {
        return this.lists.has(id);
    }
}

module.exports = { RenderDecoder };
