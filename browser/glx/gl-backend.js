/*
  GL backend seam for the GLX indirect-rendering emulator.

  The render decoder (render-decoder.js) and the GLX protocol extension
  (glx-extension.js) talk to a backend object implementing the method
  surface below. Two implementations ship here:

  - WebGLBackend: renders for real on a WebGL2RenderingContext, emulating
    the GL 1.x fixed-function pipeline (matrix stacks, Begin/End vertex
    accumulation, Gouraud lighting, texturing with sphere-map TexGen,
    fog, alpha test) with a single ubershader. Correctness over speed:
    vertex data is re-uploaded on every End.
  - RecordingBackend: node-only; records every call as [name, ...args]
    into `.calls` so the decoder and extension can be unit-tested without
    a GL context.

  Backend method surface (all GL enum arguments use the raw GL values from
  lib/ext/glxconstants.js; `params` arguments are plain number arrays):

    matrix stack     matrixMode(mode), loadIdentity(), loadMatrix(m16),
                     multMatrix(m16), pushMatrix(), popMatrix(),
                     rotate(angleDeg, x, y, z), translate(x, y, z),
                     scale(x, y, z), ortho(l, r, b, t, n, f),
                     frustum(l, r, b, t, n, f)
    primitives       begin(mode), end(), vertex(x, y, z),
                     color(r, g, b, a), normal(x, y, z), texCoord(s, t),
                     rectf(x1, y1, x2, y2), rasterPos(x, y)
    framebuffer      viewport(x, y, w, h), clearColor(r, g, b, a),
                     clearDepth(d), clearStencil(s), clear(glMask),
                     colorMask(r, g, b, a), depthMask(on),
                     stencilMask(mask), drawBuffer(mode), readBuffer(mode)
    state            enable(cap), disable(cap), isEnabled(cap) -> bool,
                     depthFunc(f), alphaFunc(f, ref), blendFunc(s, d),
                     logicOp(op), stencilFunc(f, ref, mask),
                     stencilOp(fail, zfail, zpass), cullFace(mode),
                     frontFace(dir), shadeModel(mode),
                     polygonMode(face, mode), scissor(x, y, w, h),
                     lineWidth(w), lineStipple(factor, pattern),
                     pointSize(s), hint(target, mode)
    lighting         light(lightEnum, pname, params),
                     lightModel(pname, params),
                     material(face, pname, params),
                     colorMaterial(face, mode), fog(pname, params)
    texturing        bindTexture(target, id), deleteTextures(ids),
                     texParameter(target, pname, params),
                     texEnv(target, pname, params),
                     texGen(coord, pname, params),
                     texImage2D(target, level, internalFormat, w, h,
                                border, format, type, data, unpack)
                       - data: Buffer/Uint8Array of raw wire bytes
                       - unpack: { swapBytes, lsbFirst, rowLength,
                                   skipRows, skipPixels, alignment }
    programs (stubs) programString(target, format, src),
                     bindProgram(target, program)
    frame/queries    resize(width, height), finish(), flush(),
                     readPixels(x, y, w, h, format, type, pack) -> Buffer
                       (pack: { alignment }; row padding per GL packing)
                     readPixelsUint32(w, h) -> Uint32Array, top-down rows,
                       0x00RRGGBB pixels (the JS X server raster format)
                     getParameter(pname) -> array of numbers or null,
                     getString(glEnum) -> string or null

  Display lists are NOT a backend concern: the decoder records decoded
  commands and replays them by re-dispatching to the backend.
*/

const mat = require('./matrix');

// GL enums used below (numeric so this file has no import-order concerns)
const GL = {
    MODELVIEW: 0x1700,
    POINTS: 0x0000,
    LINES: 0x0001,
    LINE_LOOP: 0x0002,
    LINE_STRIP: 0x0003,
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
    TRIANGLE_FAN: 0x0006,
    QUADS: 0x0007,
    QUAD_STRIP: 0x0008,
    POLYGON: 0x0009,
    LIGHTING: 0x0B50,
    LIGHT0: 0x4000,
    COLOR_MATERIAL: 0x0B57,
    NORMALIZE: 0x0BA1,
    RESCALE_NORMAL: 0x803A,
    FOG: 0x0B60,
    FOG_MODE: 0x0B65,
    FOG_DENSITY: 0x0B62,
    FOG_START: 0x0B63,
    FOG_END: 0x0B64,
    FOG_COLOR: 0x0B66,
    LINEAR: 0x2601,
    EXP: 0x0800,
    EXP2: 0x0801,
    ALPHA_TEST: 0x0BC0,
    ALWAYS: 0x0207,
    TEXTURE_2D: 0x0DE1,
    TEXTURE_GEN_S: 0x0C60,
    TEXTURE_GEN_T: 0x0C61,
    TEXTURE_ENV_MODE: 0x2200,
    MODULATE: 0x2100,
    DECAL: 0x2101,
    REPLACE: 0x1E01,
    AMBIENT: 0x1200,
    DIFFUSE: 0x1201,
    SPECULAR: 0x1202,
    POSITION: 0x1203,
    SPOT_DIRECTION: 0x1204,
    SPOT_EXPONENT: 0x1205,
    SPOT_CUTOFF: 0x1206,
    CONSTANT_ATTENUATION: 0x1207,
    LINEAR_ATTENUATION: 0x1208,
    QUADRATIC_ATTENUATION: 0x1209,
    EMISSION: 0x1600,
    SHININESS: 0x1601,
    AMBIENT_AND_DIFFUSE: 0x1602,
    LIGHT_MODEL_AMBIENT: 0x0B53,
    DEPTH_TEST: 0x0B71,
    BLEND: 0x0BE2,
    STENCIL_TEST: 0x0B90,
    SCISSOR_TEST: 0x0C11,
    CULL_FACE: 0x0B44,
    DITHER: 0x0BD0,
    POLYGON_OFFSET_FILL: 0x8037,
    DEPTH_BUFFER_BIT: 0x0100,
    STENCIL_BUFFER_BIT: 0x0400,
    COLOR_BUFFER_BIT: 0x4000,
    UNSIGNED_BYTE: 0x1401,
    FLOAT: 0x1406,
    RGB: 0x1907,
    RGBA: 0x1908,
    LUMINANCE: 0x1909,
    LUMINANCE_ALPHA: 0x190A,
    ALPHA: 0x1906,
    BGRA: 0x80E1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    NEAREST: 0x2600,
    NEAREST_MIPMAP_NEAREST: 0x2700,
    LINEAR_MIPMAP_NEAREST: 0x2701,
    NEAREST_MIPMAP_LINEAR: 0x2702,
    LINEAR_MIPMAP_LINEAR: 0x2703,
    CLAMP: 0x2900,
    CLAMP_TO_EDGE: 0x812F,
    SPHERE_MAP: 0x2402,
    VENDOR: 0x1F00,
    RENDERER: 0x1F01,
    VERSION: 0x1F02,
    EXTENSIONS: 0x1F03,
    MATRIX_MODE: 0x0BA0,
    VIEWPORT: 0x0BA2,
    MODELVIEW_MATRIX: 0x0BA6,
    PROJECTION_MATRIX: 0x0BA7,
    MAX_LIGHTS: 0x0D31,
    MAX_TEXTURE_SIZE: 0x0D33,
    MAX_MODELVIEW_STACK_DEPTH: 0x0D36,
    MAX_PROJECTION_STACK_DEPTH: 0x0D38,
    MAX_TEXTURE_STACK_DEPTH: 0x0D39,
    MAX_VIEWPORT_DIMS: 0x0D3A,
    MAX_LIST_NESTING: 0x0B31,
    MAX_CLIP_PLANES: 0x0D32,
    MAX_ATTRIB_STACK_DEPTH: 0x0D35,
    SUBPIXEL_BITS: 0x0D50,
    DEPTH_BITS: 0x0D56,
    STENCIL_BITS: 0x0D57,
    RED_BITS: 0x0D52,
    GREEN_BITS: 0x0D53,
    BLUE_BITS: 0x0D54,
    ALPHA_BITS: 0x0D55,
    DOUBLEBUFFER: 0x0C32,
    STEREO: 0x0C33,
    AUX_BUFFERS: 0x0C00,
    RGBA_MODE: 0x0C31,
    CURRENT_COLOR: 0x0B00,
    CURRENT_NORMAL: 0x0B02
};

// the full backend method surface (kept in one place so RecordingBackend is
// generated from it and tests can assert WebGLBackend implements all of it)
const BACKEND_METHODS = [
    'matrixMode', 'loadIdentity', 'loadMatrix', 'multMatrix', 'pushMatrix',
    'popMatrix', 'rotate', 'translate', 'scale', 'ortho', 'frustum',
    'begin', 'end', 'vertex', 'color', 'normal', 'texCoord', 'rectf',
    'rasterPos',
    'viewport', 'clearColor', 'clearDepth', 'clearStencil', 'clear',
    'colorMask', 'depthMask', 'stencilMask', 'drawBuffer', 'readBuffer',
    'enable', 'disable', 'isEnabled', 'depthFunc', 'alphaFunc', 'blendFunc',
    'logicOp', 'stencilFunc', 'stencilOp', 'cullFace', 'frontFace',
    'shadeModel', 'polygonMode', 'scissor', 'lineWidth', 'lineStipple',
    'pointSize', 'hint',
    'light', 'lightModel', 'material', 'colorMaterial', 'fog',
    'bindTexture', 'deleteTextures', 'texParameter', 'texEnv', 'texGen',
    'texImage2D',
    'programString', 'bindProgram',
    'resize', 'finish', 'flush', 'readPixels', 'readPixelsUint32',
    'getParameter', 'getString'
];

// shared read-only query table (headless defaults; WebGLBackend overrides
// the texture-size/bit-depth entries with real values)
const STATIC_PARAMS = {
    [GL.MAX_LIGHTS]: [8],
    [GL.MAX_TEXTURE_SIZE]: [4096],
    [GL.MAX_MODELVIEW_STACK_DEPTH]: [32],
    [GL.MAX_PROJECTION_STACK_DEPTH]: [32],
    [GL.MAX_TEXTURE_STACK_DEPTH]: [32],
    [GL.MAX_VIEWPORT_DIMS]: [4096, 4096],
    [GL.MAX_LIST_NESTING]: [64],
    [GL.MAX_CLIP_PLANES]: [6],
    [GL.MAX_ATTRIB_STACK_DEPTH]: [16],
    [GL.SUBPIXEL_BITS]: [4],
    [GL.DEPTH_BITS]: [24],
    [GL.STENCIL_BITS]: [8],
    [GL.RED_BITS]: [8],
    [GL.GREEN_BITS]: [8],
    [GL.BLUE_BITS]: [8],
    [GL.ALPHA_BITS]: [8],
    [GL.DOUBLEBUFFER]: [1],
    [GL.STEREO]: [0],
    [GL.AUX_BUFFERS]: [0],
    [GL.RGBA_MODE]: [1]
};

function bytesPerPixel(format) {
    switch (format) {
    case GL.RGBA:
    case GL.BGRA:
        return 4;
    case GL.RGB:
        return 3;
    case GL.LUMINANCE_ALPHA:
        return 2;
    default: // LUMINANCE, ALPHA, single-component fallbacks
        return 1;
    }
}

function paddedRowLength(width, bpp, alignment) {
    const a = alignment || 4;
    const raw = width * bpp;
    return Math.ceil(raw / a) * a;
}

// ---------------------------------------------------------------------------
// RecordingBackend
// ---------------------------------------------------------------------------

class RecordingBackend {
    constructor() {
        this.calls = [];
        this.caps = new Set();
        this.width = 0;
        this.height = 0;
    }
}

for (const name of BACKEND_METHODS) {
    RecordingBackend.prototype[name] = function(...args) {
        this.calls.push([name, ...args]);
    };
}

// record + minimal behavior for the queries the extension round-trips
RecordingBackend.prototype.enable = function(cap) {
    this.calls.push(['enable', cap]);
    this.caps.add(cap);
};

RecordingBackend.prototype.disable = function(cap) {
    this.calls.push(['disable', cap]);
    this.caps.delete(cap);
};

RecordingBackend.prototype.isEnabled = function(cap) {
    this.calls.push(['isEnabled', cap]);
    return this.caps.has(cap);
};

RecordingBackend.prototype.resize = function(width, height) {
    this.calls.push(['resize', width, height]);
    this.width = width;
    this.height = height;
};

RecordingBackend.prototype.readPixels = function(x, y, w, h, format, type, pack) {
    this.calls.push(['readPixels', x, y, w, h, format, type, pack]);
    const rowLen = paddedRowLength(w, bytesPerPixel(format), pack && pack.alignment);
    return Buffer.alloc(rowLen * h);
};

RecordingBackend.prototype.readPixelsUint32 = function(w, h) {
    this.calls.push(['readPixelsUint32', w, h]);
    return new Uint32Array(w * h);
};

RecordingBackend.prototype.getParameter = function(pname) {
    this.calls.push(['getParameter', pname]);
    return STATIC_PARAMS[pname] ? STATIC_PARAMS[pname].slice() : null;
};

RecordingBackend.prototype.getString = function(name) {
    this.calls.push(['getString', name]);
    switch (name) {
    case GL.VENDOR: return 'node-x11';
    case GL.RENDERER: return 'RecordingBackend';
    case GL.VERSION: return '1.4 node-x11 glx-emu';
    case GL.EXTENSIONS: return '';
    }
    return null;
};

// ---------------------------------------------------------------------------
// WebGLBackend
// ---------------------------------------------------------------------------

const MAX_LIGHTS = 8;

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec4 aColor;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
uniform mat4 uModelView;
uniform mat4 uProjection;
uniform mat4 uTextureMat;
uniform mat3 uNormalMat;
uniform float uLightingOn;
uniform float uColorMaterialOn;
uniform vec4 uMatAmbient;
uniform vec4 uMatDiffuse;
uniform vec4 uMatSpecular;
uniform vec4 uMatEmission;
uniform float uShininess;
uniform vec3 uSceneAmbient;
uniform float uLightOn[8];
uniform vec4 uLightPos[8];
uniform vec3 uLightAmb[8];
uniform vec3 uLightDif[8];
uniform vec3 uLightSpec[8];
uniform vec3 uLightAtt[8];
uniform vec4 uLightSpotDir[8];
uniform float uLightSpotExp[8];
uniform float uTexGenSphere;
uniform float uPointSize;
varying vec4 vColor;
varying vec2 vTexCoord;
varying float vEyeZ;
void main() {
    vec4 eye = uModelView * vec4(aPosition, 1.0);
    gl_Position = uProjection * eye;
    gl_PointSize = uPointSize;
    vEyeZ = -eye.z;
    vec3 n = normalize(uNormalMat * aNormal);
    if (uLightingOn > 0.5) {
        vec4 matAmb = uColorMaterialOn > 0.5 ? aColor : uMatAmbient;
        vec4 matDif = uColorMaterialOn > 0.5 ? aColor : uMatDiffuse;
        vec3 c = uMatEmission.rgb + matAmb.rgb * uSceneAmbient;
        for (int i = 0; i < 8; i++) {
            if (uLightOn[i] < 0.5) continue;
            vec3 L;
            float att = 1.0;
            if (uLightPos[i].w == 0.0) {
                L = normalize(uLightPos[i].xyz);
            } else {
                vec3 d = uLightPos[i].xyz - eye.xyz;
                float dist = max(length(d), 1e-6);
                L = d / dist;
                att = 1.0 / (uLightAtt[i].x + uLightAtt[i].y * dist +
                             uLightAtt[i].z * dist * dist);
            }
            if (uLightSpotDir[i].w > -1.5) {
                float sd = dot(-L, normalize(uLightSpotDir[i].xyz));
                att *= sd < uLightSpotDir[i].w ? 0.0
                     : pow(max(sd, 1e-4), uLightSpotExp[i]);
            }
            float nl = max(dot(n, L), 0.0);
            c += att * (uLightAmb[i] * matAmb.rgb + nl * uLightDif[i] * matDif.rgb);
            if (nl > 0.0) {
                vec3 h = normalize(L + vec3(0.0, 0.0, 1.0));
                c += att * pow(max(dot(n, h), 1e-4), max(uShininess, 1e-4)) *
                     uLightSpec[i] * uMatSpecular.rgb;
            }
        }
        vColor = vec4(clamp(c, 0.0, 1.0), matDif.a);
    } else {
        vColor = aColor;
    }
    if (uTexGenSphere > 0.5) {
        vec3 u = normalize(eye.xyz);
        vec3 r = reflect(u, n);
        float m = 2.0 * sqrt(r.x * r.x + r.y * r.y + (r.z + 1.0) * (r.z + 1.0));
        vTexCoord = vec2(r.x / m + 0.5, r.y / m + 0.5);
    } else {
        vTexCoord = (uTextureMat * vec4(aTexCoord, 0.0, 1.0)).xy;
    }
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;
varying vec2 vTexCoord;
varying float vEyeZ;
uniform float uTexturingOn;
uniform sampler2D uSampler;
uniform int uTexEnvMode;
uniform int uAlphaFunc;
uniform float uAlphaRef;
uniform int uFogMode;
uniform vec3 uFogColor;
uniform float uFogStart;
uniform float uFogEnd;
uniform float uFogDensity;
void main() {
    vec4 c = vColor;
    if (uTexturingOn > 0.5) {
        vec4 t = texture2D(uSampler, vTexCoord);
        if (uTexEnvMode == 1) c = t;
        else if (uTexEnvMode == 2) c = vec4(mix(c.rgb, t.rgb, t.a), c.a);
        else c = c * t;
    }
    if (uAlphaFunc != 0) {
        bool pass = true;
        if (uAlphaFunc == 512) pass = false;
        else if (uAlphaFunc == 513) pass = c.a < uAlphaRef;
        else if (uAlphaFunc == 514) pass = c.a == uAlphaRef;
        else if (uAlphaFunc == 515) pass = c.a <= uAlphaRef;
        else if (uAlphaFunc == 516) pass = c.a > uAlphaRef;
        else if (uAlphaFunc == 517) pass = c.a != uAlphaRef;
        else if (uAlphaFunc == 518) pass = c.a >= uAlphaRef;
        if (!pass) discard;
    }
    if (uFogMode != 0) {
        float f = 1.0;
        if (uFogMode == 1) f = (uFogEnd - vEyeZ) / max(uFogEnd - uFogStart, 1e-6);
        else if (uFogMode == 2) f = exp(-uFogDensity * vEyeZ);
        else f = exp(-uFogDensity * uFogDensity * vEyeZ * vEyeZ);
        c.rgb = mix(uFogColor, c.rgb, clamp(f, 0.0, 1.0));
    }
    gl_FragColor = c;
}
`;

// caps WebGL implements natively (same enum values as desktop GL)
const NATIVE_CAPS = new Set([
    GL.DEPTH_TEST, GL.BLEND, GL.STENCIL_TEST, GL.SCISSOR_TEST,
    GL.CULL_FACE, GL.DITHER, GL.POLYGON_OFFSET_FILL
]);

function defaultLight(index) {
    const on = index === 0;
    return {
        position: [0, 0, 1, 0],           // eye space, directional
        ambient: [0, 0, 0],
        diffuse: on ? [1, 1, 1] : [0, 0, 0],
        specular: on ? [1, 1, 1] : [0, 0, 0],
        attenuation: [1, 0, 0],
        spotDirection: [0, 0, -1],
        spotCutoff: 180,
        spotExponent: 0
    };
}

class WebGLBackend {
    // gl: a WebGL2RenderingContext created with
    // { preserveDrawingBuffer: true, stencil: true, depth: true, alpha: false }
    constructor(gl) {
        this.gl = gl;
        this.matrices = new mat.MatrixStacks();
        this.caps = new Set([GL.DITHER]);
        this.currentColor = [1, 1, 1, 1];
        this.currentNormal = [0, 0, 1];
        this.currentTexCoord = [0, 0];
        this.rasterPosition = [0, 0];
        this.lights = [];
        for (let i = 0; i < MAX_LIGHTS; ++i)
            this.lights.push(defaultLight(i));
        this.materialState = {
            ambient: [0.2, 0.2, 0.2, 1],
            diffuse: [0.8, 0.8, 0.8, 1],
            specular: [0, 0, 0, 1],
            emission: [0, 0, 0, 1],
            shininess: 0
        };
        this.sceneAmbient = [0.2, 0.2, 0.2];
        this.fogState = { mode: GL.EXP, density: 1, start: 0, end: 1, color: [0, 0, 0] };
        this.alphaState = { func: GL.ALWAYS, ref: 0 };
        this.texEnvMode = GL.MODULATE;
        this.textures = new Map();        // client id -> { tex, minFilter }
        this.boundTexture = 0;
        this.pointSizeValue = 1;
        this.viewportBox = [0, 0,
            gl.drawingBufferWidth || 0, gl.drawingBufferHeight || 0];
        this.batch = null;
        this._initGL();
    }

    _initGL() {
        const gl = this.gl;
        const compile = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                throw new Error(`glx-emu shader: ${gl.getShaderInfoLog(s)}`);
            return s;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
            throw new Error(`glx-emu link: ${gl.getProgramInfoLog(prog)}`);
        this.program = prog;
        this.attribs = {
            position: gl.getAttribLocation(prog, 'aPosition'),
            color: gl.getAttribLocation(prog, 'aColor'),
            normal: gl.getAttribLocation(prog, 'aNormal'),
            texCoord: gl.getAttribLocation(prog, 'aTexCoord')
        };
        this.uniforms = {};
        for (const name of ['uModelView', 'uProjection', 'uTextureMat',
            'uNormalMat', 'uLightingOn', 'uColorMaterialOn', 'uMatAmbient',
            'uMatDiffuse', 'uMatSpecular', 'uMatEmission', 'uShininess',
            'uSceneAmbient', 'uLightOn', 'uLightPos', 'uLightAmb',
            'uLightDif', 'uLightSpec', 'uLightAtt', 'uLightSpotDir',
            'uLightSpotExp', 'uTexGenSphere', 'uPointSize', 'uTexturingOn',
            'uSampler', 'uTexEnvMode', 'uAlphaFunc', 'uAlphaRef', 'uFogMode',
            'uFogColor', 'uFogStart', 'uFogEnd', 'uFogDensity'])
            this.uniforms[name] = gl.getUniformLocation(prog, name);
        this.vertexBuffer = gl.createBuffer();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.disable(gl.DEPTH_TEST);
    }

    // ---- matrix stack ----------------------------------------------------

    matrixMode(mode) {
        this.matrices.setMode(mode);
    }

    loadIdentity() {
        this.matrices.loadIdentity();
    }

    loadMatrix(m) {
        this.matrices.load(m);
    }

    multMatrix(m) {
        this.matrices.mult(m);
    }

    pushMatrix() {
        this.matrices.push();
    }

    popMatrix() {
        this.matrices.pop();
    }

    rotate(angle, x, y, z) {
        this.matrices.mult(mat.rotation(angle, x, y, z));
    }

    translate(x, y, z) {
        this.matrices.mult(mat.translation(x, y, z));
    }

    scale(x, y, z) {
        this.matrices.mult(mat.scaling(x, y, z));
    }

    ortho(l, r, b, t, n, f) {
        this.matrices.mult(mat.ortho(l, r, b, t, n, f));
    }

    frustum(l, r, b, t, n, f) {
        this.matrices.mult(mat.frustum(l, r, b, t, n, f));
    }

    // ---- primitives ------------------------------------------------------

    begin(mode) {
        this.batch = { mode: mode, data: [], count: 0 };
    }

    vertex(x, y, z) {
        const b = this.batch;
        if (!b)
            return;
        b.data.push(x, y, z,
            this.currentColor[0], this.currentColor[1],
            this.currentColor[2], this.currentColor[3],
            this.currentNormal[0], this.currentNormal[1], this.currentNormal[2],
            this.currentTexCoord[0], this.currentTexCoord[1]);
        b.count++;
    }

    color(r, g, b, a) {
        this.currentColor = [r, g, b, a];
    }

    normal(x, y, z) {
        this.currentNormal = [x, y, z];
    }

    texCoord(s, t) {
        this.currentTexCoord = [s, t];
    }

    rectf(x1, y1, x2, y2) {
        this.begin(GL.QUADS);
        this.vertex(x1, y1, 0);
        this.vertex(x2, y1, 0);
        this.vertex(x2, y2, 0);
        this.vertex(x1, y2, 0);
        this.end();
    }

    rasterPos(x, y) {
        this.rasterPosition = [x, y];
    }

    end() {
        const b = this.batch;
        this.batch = null;
        if (!b || b.count === 0)
            return;
        const STRIDE = 12;
        let mode = b.mode;
        let data = b.data;
        let count = b.count;
        if (mode === GL.QUADS) {
            // expand quads to triangles: 0 1 2, 0 2 3 per quad
            const quads = Math.floor(count / 4);
            const out = [];
            for (let q = 0; q < quads; ++q)
                for (const i of [0, 1, 2, 0, 2, 3]) {
                    const base = (q * 4 + i) * STRIDE;
                    for (let k = 0; k < STRIDE; ++k)
                        out.push(data[base + k]);
                }
            data = out;
            count = quads * 6;
            mode = GL.TRIANGLES;
        } else if (mode === GL.QUAD_STRIP) {
            mode = GL.TRIANGLE_STRIP; // same vertex order, same coverage
        } else if (mode === GL.POLYGON) {
            mode = GL.TRIANGLE_FAN;
        } else if (mode > GL.TRIANGLE_FAN) {
            return; // unknown primitive
        }
        this._draw(mode, new Float32Array(data), count);
    }

    _draw(mode, floats, count) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, floats, gl.DYNAMIC_DRAW);
        const stride = 48;
        gl.enableVertexAttribArray(this.attribs.position);
        gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.attribs.color);
        gl.vertexAttribPointer(this.attribs.color, 4, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(this.attribs.normal);
        gl.vertexAttribPointer(this.attribs.normal, 3, gl.FLOAT, false, stride, 28);
        gl.enableVertexAttribArray(this.attribs.texCoord);
        gl.vertexAttribPointer(this.attribs.texCoord, 2, gl.FLOAT, false, stride, 40);
        this._setUniforms();
        gl.drawArrays(mode, 0, count);
    }

    _setUniforms() {
        const gl = this.gl;
        const u = this.uniforms;
        const mv = this.matrices.top(mat.MODELVIEW);
        gl.uniformMatrix4fv(u.uModelView, false, mv);
        gl.uniformMatrix4fv(u.uProjection, false, this.matrices.top(mat.PROJECTION));
        gl.uniformMatrix4fv(u.uTextureMat, false, this.matrices.top(mat.TEXTURE));
        gl.uniformMatrix3fv(u.uNormalMat, false, mat.normalMatrix(mv));
        gl.uniform1f(u.uLightingOn, this.caps.has(GL.LIGHTING) ? 1 : 0);
        gl.uniform1f(u.uColorMaterialOn, this.caps.has(GL.COLOR_MATERIAL) ? 1 : 0);
        const m = this.materialState;
        gl.uniform4fv(u.uMatAmbient, m.ambient);
        gl.uniform4fv(u.uMatDiffuse, m.diffuse);
        gl.uniform4fv(u.uMatSpecular, m.specular);
        gl.uniform4fv(u.uMatEmission, m.emission);
        gl.uniform1f(u.uShininess, m.shininess);
        gl.uniform3fv(u.uSceneAmbient, this.sceneAmbient);
        const on = new Float32Array(MAX_LIGHTS);
        const pos = new Float32Array(MAX_LIGHTS * 4);
        const amb = new Float32Array(MAX_LIGHTS * 3);
        const dif = new Float32Array(MAX_LIGHTS * 3);
        const spec = new Float32Array(MAX_LIGHTS * 3);
        const att = new Float32Array(MAX_LIGHTS * 3);
        const spot = new Float32Array(MAX_LIGHTS * 4);
        const spotExp = new Float32Array(MAX_LIGHTS);
        for (let i = 0; i < MAX_LIGHTS; ++i) {
            const l = this.lights[i];
            on[i] = this.caps.has(GL.LIGHT0 + i) ? 1 : 0;
            pos.set(l.position, i * 4);
            amb.set(l.ambient, i * 3);
            dif.set(l.diffuse, i * 3);
            spec.set(l.specular, i * 3);
            att.set(l.attenuation, i * 3);
            spot.set(l.spotDirection, i * 4);
            // w = cos(cutoff), or -2 to mark "no spot" (cutoff 180)
            spot[i * 4 + 3] = l.spotCutoff >= 180 ? -2
                : Math.cos(l.spotCutoff * Math.PI / 180);
            spotExp[i] = l.spotExponent;
        }
        gl.uniform1fv(u.uLightOn, on);
        gl.uniform4fv(u.uLightPos, pos);
        gl.uniform3fv(u.uLightAmb, amb);
        gl.uniform3fv(u.uLightDif, dif);
        gl.uniform3fv(u.uLightSpec, spec);
        gl.uniform3fv(u.uLightAtt, att);
        gl.uniform4fv(u.uLightSpotDir, spot);
        gl.uniform1fv(u.uLightSpotExp, spotExp);
        gl.uniform1f(u.uTexGenSphere,
            this.caps.has(GL.TEXTURE_GEN_S) || this.caps.has(GL.TEXTURE_GEN_T) ? 1 : 0);
        gl.uniform1f(u.uPointSize, this.pointSizeValue);
        const texturing = this.caps.has(GL.TEXTURE_2D) &&
            this.textures.has(this.boundTexture);
        gl.uniform1f(u.uTexturingOn, texturing ? 1 : 0);
        if (texturing) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.textures.get(this.boundTexture).tex);
            gl.uniform1i(u.uSampler, 0);
        }
        gl.uniform1i(u.uTexEnvMode,
            this.texEnvMode === GL.REPLACE ? 1 : this.texEnvMode === GL.DECAL ? 2 : 0);
        gl.uniform1i(u.uAlphaFunc, this.caps.has(GL.ALPHA_TEST) ? this.alphaState.func : 0);
        gl.uniform1f(u.uAlphaRef, this.alphaState.ref);
        const fogModeIndex = { [GL.LINEAR]: 1, [GL.EXP]: 2, [GL.EXP2]: 3 };
        gl.uniform1i(u.uFogMode,
            this.caps.has(GL.FOG) ? (fogModeIndex[this.fogState.mode] || 2) : 0);
        gl.uniform3fv(u.uFogColor, this.fogState.color);
        gl.uniform1f(u.uFogStart, this.fogState.start);
        gl.uniform1f(u.uFogEnd, this.fogState.end);
        gl.uniform1f(u.uFogDensity, this.fogState.density);
    }

    // ---- framebuffer -----------------------------------------------------

    viewport(x, y, w, h) {
        this.viewportBox = [x, y, w, h];
        this.gl.viewport(x, y, w, h);
    }

    clearColor(r, g, b, a) {
        this.gl.clearColor(r, g, b, a);
    }

    clearDepth(d) {
        this.gl.clearDepth(d);
    }

    clearStencil(s) {
        this.gl.clearStencil(s);
    }

    clear(mask) {
        // GL and WebGL agree on the three buffer bits; drop the rest (ACCUM)
        const webglMask = mask &
            (GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);
        if (webglMask)
            this.gl.clear(webglMask);
    }

    colorMask(r, g, b, a) {
        this.gl.colorMask(!!r, !!g, !!b, !!a);
    }

    depthMask(on) {
        this.gl.depthMask(!!on);
    }

    stencilMask(mask) {
        this.gl.stencilMask(mask >>> 0);
    }

    drawBuffer() {}

    readBuffer() {}

    // ---- state -----------------------------------------------------------

    enable(cap) {
        this.caps.add(cap);
        if (NATIVE_CAPS.has(cap))
            this.gl.enable(cap);
    }

    disable(cap) {
        this.caps.delete(cap);
        if (NATIVE_CAPS.has(cap))
            this.gl.disable(cap);
    }

    isEnabled(cap) {
        return this.caps.has(cap);
    }

    depthFunc(f) {
        this.gl.depthFunc(f);
    }

    alphaFunc(f, ref) {
        this.alphaState = { func: f, ref: ref };
    }

    blendFunc(s, d) {
        this.gl.blendFunc(s, d);
    }

    logicOp() {} // no WebGL equivalent

    stencilFunc(f, ref, mask) {
        this.gl.stencilFunc(f, ref, mask >>> 0);
    }

    stencilOp(fail, zfail, zpass) {
        this.gl.stencilOp(fail, zfail, zpass);
    }

    cullFace(mode) {
        this.gl.cullFace(mode);
    }

    frontFace(dir) {
        this.gl.frontFace(dir);
    }

    shadeModel() {} // flat approximated as smooth

    polygonMode() {} // fill only; LINE/POINT ignored gracefully

    scissor(x, y, w, h) {
        this.gl.scissor(x, y, w, h);
    }

    lineWidth(w) {
        this.gl.lineWidth(w);
    }

    lineStipple() {} // not representable in WebGL

    pointSize(s) {
        this.pointSizeValue = s;
    }

    hint() {}

    // ---- lighting / material / fog ---------------------------------------

    light(lightEnum, pname, params) {
        const idx = lightEnum - GL.LIGHT0;
        if (idx < 0 || idx >= MAX_LIGHTS)
            return;
        const l = this.lights[idx];
        switch (pname) {
        case GL.POSITION:
            // fixed-function semantics: transform by the modelview matrix
            // in effect at the time of the call, store in eye space
            l.position = mat.transform(this.matrices.top(mat.MODELVIEW),
                [params[0], params[1], params[2], params[3] || 0]);
            break;
        case GL.AMBIENT:
            l.ambient = params.slice(0, 3);
            break;
        case GL.DIFFUSE:
            l.diffuse = params.slice(0, 3);
            break;
        case GL.SPECULAR:
            l.specular = params.slice(0, 3);
            break;
        case GL.SPOT_DIRECTION: {
            const mv = this.matrices.top(mat.MODELVIEW);
            const d = mat.transform(mv, [params[0], params[1], params[2], 0]);
            l.spotDirection = [d[0], d[1], d[2], 0];
            break;
        }
        case GL.SPOT_CUTOFF:
            l.spotCutoff = params[0];
            break;
        case GL.SPOT_EXPONENT:
            l.spotExponent = params[0];
            break;
        case GL.CONSTANT_ATTENUATION:
            l.attenuation[0] = params[0];
            break;
        case GL.LINEAR_ATTENUATION:
            l.attenuation[1] = params[0];
            break;
        case GL.QUADRATIC_ATTENUATION:
            l.attenuation[2] = params[0];
            break;
        }
    }

    lightModel(pname, params) {
        if (pname === GL.LIGHT_MODEL_AMBIENT)
            this.sceneAmbient = params.slice(0, 3);
        // LIGHT_MODEL_TWO_SIDE / LOCAL_VIEWER: not emulated
    }

    material(face, pname, params) {
        const m = this.materialState;
        const vec = () => [params[0], params[1], params[2],
            params.length > 3 ? params[3] : 1];
        switch (pname) {
        case GL.AMBIENT:
            m.ambient = vec();
            break;
        case GL.DIFFUSE:
            m.diffuse = vec();
            break;
        case GL.AMBIENT_AND_DIFFUSE:
            m.ambient = vec();
            m.diffuse = vec();
            break;
        case GL.SPECULAR:
            m.specular = vec();
            break;
        case GL.EMISSION:
            m.emission = vec();
            break;
        case GL.SHININESS:
            m.shininess = params[0];
            break;
        }
    }

    colorMaterial() {} // mode/face refinement not tracked; the enable bit is

    fog(pname, params) {
        const f = this.fogState;
        switch (pname) {
        case GL.FOG_MODE:
            f.mode = params[0];
            break;
        case GL.FOG_DENSITY:
            f.density = params[0];
            break;
        case GL.FOG_START:
            f.start = params[0];
            break;
        case GL.FOG_END:
            f.end = params[0];
            break;
        case GL.FOG_COLOR:
            f.color = params.slice(0, 3);
            break;
        }
    }

    // ---- texturing -------------------------------------------------------

    _textureRecord(id) {
        let rec = this.textures.get(id);
        if (!rec) {
            rec = { tex: this.gl.createTexture(), minFilter: GL.NEAREST_MIPMAP_LINEAR };
            this.textures.set(id, rec);
        }
        return rec;
    }

    bindTexture(target, id) {
        this.boundTexture = id;
        if (id)
            this.gl.bindTexture(this.gl.TEXTURE_2D, this._textureRecord(id).tex);
    }

    deleteTextures(ids) {
        for (const id of ids) {
            const rec = this.textures.get(id);
            if (rec) {
                this.gl.deleteTexture(rec.tex);
                this.textures.delete(id);
            }
        }
    }

    texParameter(target, pname, params) {
        const gl = this.gl;
        if (!this.boundTexture)
            return;
        let value = params[0];
        if (pname === GL.TEXTURE_MIN_FILTER)
            this._textureRecord(this.boundTexture).minFilter = value;
        if ((pname === GL.TEXTURE_WRAP_S || pname === GL.TEXTURE_WRAP_T) &&
            value === GL.CLAMP)
            value = GL.CLAMP_TO_EDGE; // legacy GL_CLAMP is absent in WebGL
        if (pname === GL.TEXTURE_MIN_FILTER || pname === GL.TEXTURE_MAG_FILTER ||
            pname === GL.TEXTURE_WRAP_S || pname === GL.TEXTURE_WRAP_T)
            gl.texParameteri(gl.TEXTURE_2D, pname, value);
        // priority/border color/LOD: ignored
    }

    texEnv(target, pname, params) {
        if (pname === GL.TEXTURE_ENV_MODE)
            this.texEnvMode = params[0];
    }

    texGen() {} // only SPHERE_MAP via TEXTURE_GEN_S/T enables (see _setUniforms)

    texImage2D(target, level, internalFormat, width, height, border, format, type, data, unpack) {
        const gl = this.gl;
        if (!this.boundTexture)
            return;
        const rec = this._textureRecord(this.boundTexture);
        gl.bindTexture(gl.TEXTURE_2D, rec.tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT,
            [1, 2, 4, 8].indexOf(unpack && unpack.alignment) !== -1 ? unpack.alignment : 4);
        if (gl.UNPACK_ROW_LENGTH !== undefined) {
            gl.pixelStorei(gl.UNPACK_ROW_LENGTH, (unpack && unpack.rowLength) || 0);
            gl.pixelStorei(gl.UNPACK_SKIP_ROWS, (unpack && unpack.skipRows) || 0);
            gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, (unpack && unpack.skipPixels) || 0);
        }
        // legacy numeric internal formats (1..4) and sized formats -> unsized
        let ifmt = internalFormat;
        if (ifmt === 1)
            ifmt = GL.LUMINANCE;
        else if (ifmt === 2)
            ifmt = GL.LUMINANCE_ALPHA;
        else if (ifmt === 3)
            ifmt = GL.RGB;
        else if (ifmt === 4)
            ifmt = GL.RGBA;
        else if ([GL.RGB, GL.RGBA, GL.LUMINANCE, GL.LUMINANCE_ALPHA, GL.ALPHA].indexOf(ifmt) === -1)
            ifmt = format;
        let pixels;
        if (type === GL.FLOAT) {
            // clamp float data to bytes; good enough for the fixed-function set
            const floats = new Float32Array(data.buffer, data.byteOffset,
                Math.floor(data.length / 4));
            pixels = new Uint8Array(floats.length);
            for (let i = 0; i < floats.length; ++i)
                pixels[i] = Math.max(0, Math.min(255, Math.round(floats[i] * 255)));
            type = GL.UNSIGNED_BYTE;
        } else {
            pixels = new Uint8Array(data.buffer, data.byteOffset, data.length);
        }
        gl.texImage2D(gl.TEXTURE_2D, level, ifmt, width, height, 0,
            format, type, pixels);
        // the GL default min filter needs mipmaps; keep the texture complete
        if (level === 0 && rec.minFilter >= GL.NEAREST_MIPMAP_NEAREST &&
            rec.minFilter <= GL.LINEAR_MIPMAP_LINEAR)
            gl.generateMipmap(gl.TEXTURE_2D);
    }

    // ---- programs (GL_ARB_*_program): accepted but not executed ----------

    programString() {}

    bindProgram() {}

    // ---- frame / queries -------------------------------------------------

    resize(width, height) {
        const canvas = this.gl.canvas;
        if (canvas && (canvas.width !== width || canvas.height !== height)) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    finish() {
        this.gl.finish();
    }

    flush() {
        this.gl.flush();
    }

    readPixels(x, y, w, h, format, type, pack) {
        const gl = this.gl;
        const rgba = new Uint8Array(w * h * 4);
        gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        if (format === GL.RGBA)
            return Buffer.from(rgba);
        const bpp = bytesPerPixel(format);
        const rowLen = paddedRowLength(w, bpp, pack && pack.alignment);
        const out = Buffer.alloc(rowLen * h);
        for (let row = 0; row < h; ++row)
            for (let col = 0; col < w; ++col) {
                const s = (row * w + col) * 4;
                const d = row * rowLen + col * bpp;
                switch (format) {
                case GL.RGB:
                    out[d] = rgba[s];
                    out[d + 1] = rgba[s + 1];
                    out[d + 2] = rgba[s + 2];
                    break;
                case GL.BGRA:
                    out[d] = rgba[s + 2];
                    out[d + 1] = rgba[s + 1];
                    out[d + 2] = rgba[s];
                    out[d + 3] = rgba[s + 3];
                    break;
                case GL.ALPHA:
                    out[d] = rgba[s + 3];
                    break;
                default: // LUMINANCE and friends: red channel
                    out[d] = rgba[s];
                    break;
                }
            }
        return out;
    }

    // top-down 0x00RRGGBB pixels for compositing into the JS X server raster
    readPixelsUint32(w, h) {
        const gl = this.gl;
        const rgba = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        const out = new Uint32Array(w * h);
        for (let y = 0; y < h; ++y) {
            const src = (h - 1 - y) * w * 4;
            for (let x = 0; x < w; ++x)
                out[y * w + x] = (rgba[src + x * 4] << 16) |
                    (rgba[src + x * 4 + 1] << 8) | rgba[src + x * 4 + 2];
        }
        return out;
    }

    getParameter(pname) {
        const gl = this.gl;
        switch (pname) {
        case GL.VIEWPORT:
            return this.viewportBox.slice();
        case GL.MATRIX_MODE:
            return [this.matrices.mode];
        case GL.MODELVIEW_MATRIX:
            return Array.from(this.matrices.top(mat.MODELVIEW));
        case GL.PROJECTION_MATRIX:
            return Array.from(this.matrices.top(mat.PROJECTION));
        case GL.CURRENT_COLOR:
            return this.currentColor.slice();
        case GL.CURRENT_NORMAL:
            return this.currentNormal.slice();
        case GL.MAX_TEXTURE_SIZE:
            return [gl.getParameter(gl.MAX_TEXTURE_SIZE)];
        case GL.DEPTH_BITS:
            return [gl.getParameter(gl.DEPTH_BITS)];
        case GL.STENCIL_BITS:
            return [gl.getParameter(gl.STENCIL_BITS)];
        }
        return STATIC_PARAMS[pname] ? STATIC_PARAMS[pname].slice() : null;
    }

    getString(name) {
        switch (name) {
        case GL.VENDOR: return 'node-x11';
        case GL.RENDERER: return 'node-x11 WebGL indirect emulator';
        case GL.VERSION: return '1.4 node-x11 glx-emu';
        case GL.EXTENSIONS: return '';
        }
        return null;
    }
}

module.exports = {
    WebGLBackend,
    RecordingBackend,
    BACKEND_METHODS
};
