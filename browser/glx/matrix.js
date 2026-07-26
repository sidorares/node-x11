// 4x4 matrix math for the fixed-function GL emulation, OpenGL conventions:
// column-major storage (m[col * 4 + row]), matrices multiply on the right
// (glMultMatrix semantics), formulas straight from the GL 1.x spec.

function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// out = a * b (both column-major)
function multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; ++c)
        for (let r = 0; r < 4; ++r) {
            let s = 0;
            for (let k = 0; k < 4; ++k)
                s += a[k * 4 + r] * b[c * 4 + k];
            out[c * 4 + r] = s;
        }
    return out;
}

function translation(x, y, z) {
    const m = identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
}

function scaling(x, y, z) {
    const m = identity();
    m[0] = x;
    m[5] = y;
    m[10] = z;
    return m;
}

// glRotatef: angle in degrees, axis (x, y, z) normalized internally
function rotation(angle, x, y, z) {
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len === 0)
        return identity();
    x /= len;
    y /= len;
    z /= len;
    const rad = angle * Math.PI / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const t = 1 - c;
    const m = identity();
    m[0] = x * x * t + c;
    m[1] = y * x * t + z * s;
    m[2] = z * x * t - y * s;
    m[4] = x * y * t - z * s;
    m[5] = y * y * t + c;
    m[6] = z * y * t + x * s;
    m[8] = x * z * t + y * s;
    m[9] = y * z * t - x * s;
    m[10] = z * z * t + c;
    return m;
}

function ortho(l, r, b, t, n, f) {
    const m = identity();
    m[0] = 2 / (r - l);
    m[5] = 2 / (t - b);
    m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l);
    m[13] = -(t + b) / (t - b);
    m[14] = -(f + n) / (f - n);
    return m;
}

function frustum(l, r, b, t, n, f) {
    const m = new Float32Array(16);
    m[0] = 2 * n / (r - l);
    m[5] = 2 * n / (t - b);
    m[8] = (r + l) / (r - l);
    m[9] = (t + b) / (t - b);
    m[10] = -(f + n) / (f - n);
    m[11] = -1;
    m[14] = -2 * f * n / (f - n);
    return m;
}

// m * [x, y, z, w]
function transform(m, v) {
    const out = new Array(4);
    for (let r = 0; r < 4; ++r)
        out[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3];
    return out;
}

// normal matrix: inverse-transpose of the upper-left 3x3 of a modelview
// matrix, column-major 3x3 output (n[col * 3 + row])
function normalMatrix(m) {
    // a(row, col) of the upper-left 3x3
    const a00 = m[0], a10 = m[1], a20 = m[2];
    const a01 = m[4], a11 = m[5], a21 = m[6];
    const a02 = m[8], a12 = m[9], a22 = m[10];
    const c00 = a11 * a22 - a12 * a21;
    const c01 = -(a10 * a22 - a12 * a20);
    const c02 = a10 * a21 - a11 * a20;
    const det = a00 * c00 + a01 * c01 + a02 * c02;
    const out = new Float32Array(9);
    if (Math.abs(det) < 1e-12) {
        out[0] = out[4] = out[8] = 1;
        return out;
    }
    const c10 = -(a01 * a22 - a02 * a21);
    const c11 = a00 * a22 - a02 * a20;
    const c12 = -(a00 * a21 - a01 * a20);
    const c20 = a01 * a12 - a02 * a11;
    const c21 = -(a00 * a12 - a02 * a10);
    const c22 = a00 * a11 - a01 * a10;
    // inverse-transpose = cofactor matrix / det; cofactor C(row, col) goes to
    // out(row, col) = out[col * 3 + row]
    out[0] = c00 / det;
    out[1] = c10 / det;
    out[2] = c20 / det;
    out[3] = c01 / det;
    out[4] = c11 / det;
    out[5] = c21 / det;
    out[6] = c02 / det;
    out[7] = c12 / det;
    out[8] = c22 / det;
    return out;
}

// GL matrix-mode enums (from glxconstants)
const MODELVIEW = 0x1700;
const PROJECTION = 0x1701;
const TEXTURE = 0x1702;

const MAX_STACK_DEPTH = 32;

// The three fixed-function matrix stacks with the glMatrixMode / glPushMatrix
// / glLoadMatrix / glMultMatrix state machine.
class MatrixStacks {
    constructor() {
        this.mode = MODELVIEW;
        this.stacks = {
            [MODELVIEW]: [identity()],
            [PROJECTION]: [identity()],
            [TEXTURE]: [identity()]
        };
    }

    _stack() {
        return this.stacks[this.mode] || this.stacks[MODELVIEW];
    }

    setMode(mode) {
        if (this.stacks[mode])
            this.mode = mode;
    }

    top(mode) {
        const stack = this.stacks[mode] || this._stack();
        return stack[stack.length - 1];
    }

    load(m) {
        const stack = this._stack();
        stack[stack.length - 1] = Float32Array.from(m);
    }

    loadIdentity() {
        this.load(identity());
    }

    mult(m) {
        const stack = this._stack();
        stack[stack.length - 1] = multiply(stack[stack.length - 1], m);
    }

    push() {
        const stack = this._stack();
        if (stack.length < MAX_STACK_DEPTH)
            stack.push(Float32Array.from(stack[stack.length - 1]));
    }

    pop() {
        const stack = this._stack();
        if (stack.length > 1)
            stack.pop();
    }
}

module.exports = {
    identity,
    multiply,
    translation,
    scaling,
    rotation,
    ortho,
    frustum,
    transform,
    normalMatrix,
    MatrixStacks,
    MODELVIEW,
    PROJECTION,
    TEXTURE
};
