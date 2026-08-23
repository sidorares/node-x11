// Unit test for the QueryPictFormats reply walk: the screens section is a
// list of variable-length structs (PICTSCREEN -> PICTDEPTH -> PICTVISUAL),
// and neither Xvfb nor the bundled JS server answers with more than one
// screen or more than one depth, so the nesting is exercised here against a
// hand-built reply instead.
const assert = require('assert');
const { unpackPictFormats } = require('../lib/ext/render');

// reply body as the client sees it: the first 8 bytes of the reply are
// stripped, so num_formats is at 0 and the format list starts at 24
function buildReply(formats, screens, subpixels) {
    const chunks = [];
    const header = Buffer.alloc(24);
    header.writeUInt32LE(formats.length, 0);
    header.writeUInt32LE(screens.length, 4);
    header.writeUInt32LE(
        screens.reduce((n, s) => n + s.depths.length, 0), 8);
    header.writeUInt32LE(
        screens.reduce((n, s) =>
            n + s.depths.reduce((m, d) => m + d.visuals.length, 0), 0), 12);
    header.writeUInt32LE(subpixels.length, 16);
    chunks.push(header);

    for (const f of formats) {
        const b = Buffer.alloc(28);
        b.writeUInt32LE(f.id, 0);
        b.writeUInt8(f.type, 4);
        b.writeUInt8(f.depth, 5);
        b.writeUInt16LE(f.redShift, 8);
        b.writeUInt16LE(f.redMask, 10);
        b.writeUInt16LE(f.greenShift, 12);
        b.writeUInt16LE(f.greenMask, 14);
        b.writeUInt16LE(f.blueShift, 16);
        b.writeUInt16LE(f.blueMask, 18);
        b.writeUInt16LE(f.alphaShift, 20);
        b.writeUInt16LE(f.alphaMask, 22);
        b.writeUInt32LE(f.colormap, 24);
        chunks.push(b);
    }

    for (const s of screens) {
        const head = Buffer.alloc(8);
        head.writeUInt32LE(s.depths.length, 0);
        head.writeUInt32LE(s.fallback, 4);
        chunks.push(head);
        for (const d of s.depths) {
            const dh = Buffer.alloc(8);
            dh.writeUInt8(d.depth, 0);
            dh.writeUInt16LE(d.visuals.length, 2);
            chunks.push(dh);
            for (const v of d.visuals) {
                const vb = Buffer.alloc(8);
                vb.writeUInt32LE(v.visual, 0);
                vb.writeUInt32LE(v.format, 4);
                chunks.push(vb);
            }
        }
    }

    const sub = Buffer.alloc(subpixels.length * 4);
    subpixels.forEach((v, i) => sub.writeUInt32LE(v, i * 4));
    chunks.push(sub);

    return Buffer.concat(chunks);
}

const RGB24 = { id: 32, type: 1, depth: 24,
    redShift: 16, redMask: 255, greenShift: 8, greenMask: 255,
    blueShift: 0, blueMask: 255, alphaShift: 0, alphaMask: 0, colormap: 0 };
const RGBA32 = { id: 33, type: 1, depth: 32,
    redShift: 16, redMask: 255, greenShift: 8, greenMask: 255,
    blueShift: 0, blueMask: 255, alphaShift: 24, alphaMask: 255, colormap: 0 };
const RGB565 = { id: 34, type: 1, depth: 16,
    redShift: 11, redMask: 31, greenShift: 5, greenMask: 63,
    blueShift: 0, blueMask: 31, alphaShift: 0, alphaMask: 0, colormap: 0 };

const SCREENS = [
    { fallback: 32, depths: [
        { depth: 16, visuals: [{ visual: 0x20, format: 34 }] },
        { depth: 24, visuals: [
            { visual: 0x21, format: 32 },
            { visual: 0x22, format: 32 }
        ] },
        { depth: 32, visuals: [{ visual: 0x23, format: 33 }] }
    ] },
    { fallback: 32, depths: [
        { depth: 24, visuals: [{ visual: 0x140, format: 32 }] }
    ] }
];

describe('RENDER QueryPictFormats reply', () => {

    it('should decode formats, screens and subpixels of a multi-screen reply', () => {
        const res = unpackPictFormats(
            buildReply([RGB24, RGBA32, RGB565], SCREENS, [0, 1]));
        assert.deepStrictEqual(res.formats.map(f => f.id), [32, 33, 34]);
        assert.deepStrictEqual(res.screens, SCREENS);
        assert.deepStrictEqual(res.subpixels, [0, 1]);
    });

    it('should give every format entry both positional and named fields', () => {
        const res = unpackPictFormats(buildReply([RGB565], SCREENS, [0, 0]));
        const f = res.formats[0];
        assert.deepStrictEqual(Array.from(f),
            [34, 1, 16, 11, 31, 5, 63, 0, 31, 0, 0, 0]);
        assert.strictEqual(f.length, 12);
        for (const [i, name] of ['id', 'type', 'depth',
            'redShift', 'redMask', 'greenShift', 'greenMask',
            'blueShift', 'blueMask', 'alphaShift', 'alphaMask',
            'colormap'].entries())
            assert.strictEqual(f[name], f[i], name);
    });

    it('should read the screens section past a format list of any length', () => {
        // regression guard: the screens walk starts after num_formats * 28
        // bytes, so a wrong stride shows up as a garbage first screen
        const many = [];
        for (let i = 0; i < 17; ++i)
            many.push(Object.assign({}, RGB24, { id: 100 + i }));
        const res = unpackPictFormats(buildReply(many, SCREENS, [5]));
        assert.strictEqual(res.formats.length, 17);
        assert.deepStrictEqual(res.screens, SCREENS);
        assert.deepStrictEqual(res.subpixels, [5]);
    });

    it('should tolerate a server that sends no subpixel list (pre-0.6)', () => {
        const res = unpackPictFormats(buildReply([RGB24], SCREENS, []));
        assert.deepStrictEqual(res.subpixels, []);
        assert.strictEqual(res.screens.length, 2);
    });
});
