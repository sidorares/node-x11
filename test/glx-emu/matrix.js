// Matrix math used by the GLX emulator's fixed-function pipeline: verify
// the GL-spec formulas against known matrices and transforms.
const assert = require('assert');
const mat = require('../../browser/glx/matrix');

function approxEqual(actual, expected, eps = 1e-5) {
    assert.strictEqual(actual.length, expected.length);
    for (let i = 0; i < expected.length; ++i)
        assert.ok(Math.abs(actual[i] - expected[i]) < eps,
            `element ${i}: ${actual[i]} !== ${expected[i]}`);
}

describe('glx-emu matrix math', () => {
    it('identity transforms points unchanged', () => {
        approxEqual(mat.transform(mat.identity(), [3, -4, 5, 1]), [3, -4, 5, 1]);
    });

    it('translation moves points', () => {
        const m = mat.translation(1, 2, 3);
        approxEqual(mat.transform(m, [10, 20, 30, 1]), [11, 22, 33, 1]);
        // direction vectors (w=0) are unaffected
        approxEqual(mat.transform(m, [10, 20, 30, 0]), [10, 20, 30, 0]);
    });

    it('scaling scales points', () => {
        approxEqual(mat.transform(mat.scaling(2, 3, -1), [1, 1, 1, 1]), [2, 3, -1, 1]);
    });

    it('rotation about z by 90 degrees maps +x to +y', () => {
        const m = mat.rotation(90, 0, 0, 1);
        approxEqual(mat.transform(m, [1, 0, 0, 1]), [0, 1, 0, 1]);
        approxEqual(mat.transform(m, [0, 1, 0, 1]), [-1, 0, 0, 1]);
    });

    it('rotation normalizes the axis', () => {
        const a = mat.rotation(37, 0, 0, 10);
        const b = mat.rotation(37, 0, 0, 1);
        approxEqual(Array.from(a), Array.from(b));
    });

    it('glOrtho matches the GL spec matrix', () => {
        // glOrtho(-1, 1, -1, 1, -1, 1) is the identity except z is negated
        approxEqual(Array.from(mat.ortho(-1, 1, -1, 1, -1, 1)),
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]);
        // asymmetric volume
        const m = mat.ortho(0, 4, 0, 2, 1, 11);
        approxEqual(Array.from(m), [
            0.5, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, -0.2, 0,
            -1, -1, -1.2, 1
        ]);
    });

    it('glFrustum matches the GL spec matrix', () => {
        const m = mat.frustum(-1, 1, -1, 1, 2, 6);
        approxEqual(Array.from(m), [
            2, 0, 0, 0,
            0, 2, 0, 0,
            0, 0, -2, -1,
            0, 0, -6, 0
        ]);
        // a point on the near plane maps to z_ndc = -1
        const near = mat.transform(m, [0, 0, -2, 1]);
        assert.ok(Math.abs(near[2] / near[3] + 1) < 1e-6);
        // a point on the far plane maps to z_ndc = +1
        const far = mat.transform(m, [0, 0, -6, 1]);
        assert.ok(Math.abs(far[2] / far[3] - 1) < 1e-6);
    });

    it('multiply applies the right-hand matrix first', () => {
        // GL semantics: (T * R) * v == T applied after R
        const t = mat.translation(5, 0, 0);
        const r = mat.rotation(90, 0, 0, 1);
        const tr = mat.multiply(t, r);
        approxEqual(mat.transform(tr, [1, 0, 0, 1]), [5, 1, 0, 1]);
    });

    it('normalMatrix is the inverse-transpose of the upper 3x3', () => {
        // for a pure rotation the normal matrix equals the rotation
        const r = mat.rotation(30, 0, 1, 0);
        const n = mat.normalMatrix(r);
        approxEqual([n[0], n[1], n[2]], [r[0], r[1], r[2]]);
        // for a non-uniform scale S the normal matrix is S^-1
        const n2 = mat.normalMatrix(mat.scaling(2, 4, 8));
        approxEqual(Array.from(n2), [0.5, 0, 0, 0, 0.25, 0, 0, 0, 0.125]);
    });

    it('MatrixStacks tracks mode, push/pop and load/mult', () => {
        const s = new mat.MatrixStacks();
        s.setMode(mat.PROJECTION);
        s.mult(mat.ortho(-1, 1, -1, 1, -1, 1));
        s.setMode(mat.MODELVIEW);
        s.mult(mat.translation(1, 2, 3));
        s.push();
        s.mult(mat.translation(1, 0, 0));
        approxEqual(mat.transform(s.top(mat.MODELVIEW), [0, 0, 0, 1]), [2, 2, 3, 1]);
        s.pop();
        approxEqual(mat.transform(s.top(mat.MODELVIEW), [0, 0, 0, 1]), [1, 2, 3, 1]);
        // projection stack was untouched by modelview ops
        approxEqual(Array.from(s.top(mat.PROJECTION)),
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]);
        // pop never underflows
        s.pop();
        s.pop();
        approxEqual(mat.transform(s.top(mat.MODELVIEW), [0, 0, 0, 1]), [1, 2, 3, 1]);
    });
});
