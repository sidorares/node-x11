// Unit tests for the glXChooseFBConfig-style selection rules (GLX 1.4 spec
// §3.3.3) — pure filter+sort over decoded fbconfig objects, no server needed.
const assert = require('assert');
const { chooseFBConfigs, glxConst: C } = require('../lib/ext/glx');

// a plausible fbconfig; override per test
let nextId = 1;
function cfg(over) {
    return Object.assign({
        FBCONFIG_ID: nextId++,
        VISUAL_ID: 0x21,
        BUFFER_SIZE: 24,
        LEVEL: 0,
        DOUBLEBUFFER: 0,
        STEREO: 0,
        AUX_BUFFERS: 0,
        RED_SIZE: 8, GREEN_SIZE: 8, BLUE_SIZE: 8, ALPHA_SIZE: 0,
        DEPTH_SIZE: 0,
        STENCIL_SIZE: 0,
        ACCUM_RED_SIZE: 0, ACCUM_GREEN_SIZE: 0,
        ACCUM_BLUE_SIZE: 0, ACCUM_ALPHA_SIZE: 0,
        RENDER_TYPE: C.RGBA_BIT,
        DRAWABLE_TYPE: C.WINDOW_BIT | C.PIXMAP_BIT,
        X_RENDERABLE: 1,
        X_VISUAL_TYPE: C.TRUE_COLOR,
        CONFIG_CAVEAT: C.NONE,
        TRANSPARENT_TYPE: C.NONE
    }, over);
}

const ids = configs => configs.map(c => c.FBCONFIG_ID);

describe('GLX ChooseFBConfig selection rules', () => {

  describe('matching', () => {

    it('defaults require RGBA rendering to a window', () => {
        const rgbaWindow = cfg({});
        const indexOnly = cfg({ RENDER_TYPE: C.COLOR_INDEX_BIT });
        const pbufferOnly = cfg({ DRAWABLE_TYPE: C.PBUFFER_BIT });
        const out = chooseFBConfigs([indexOnly, rgbaWindow, pbufferOnly], {});
        assert.deepStrictEqual(ids(out), [rgbaWindow.FBCONFIG_ID]);
    });

    it('sized attributes match as minimums', () => {
        const small = cfg({ RED_SIZE: 5, GREEN_SIZE: 6, BLUE_SIZE: 5 });
        const big = cfg({});
        const out = chooseFBConfigs([small, big], { RED_SIZE: 8 });
        assert.deepStrictEqual(ids(out), [big.FBCONFIG_ID]);
    });

    it('mask attributes require all requested bits', () => {
        const winOnly = cfg({ DRAWABLE_TYPE: C.WINDOW_BIT });
        const winPbuffer = cfg({ DRAWABLE_TYPE: C.WINDOW_BIT | C.PBUFFER_BIT });
        const out = chooseFBConfigs([winOnly, winPbuffer],
            { DRAWABLE_TYPE: C.WINDOW_BIT | C.PBUFFER_BIT });
        assert.deepStrictEqual(ids(out), [winPbuffer.FBCONFIG_ID]);
    });

    it('DOUBLEBUFFER is exact when specified, any when not', () => {
        const single = cfg({ DOUBLEBUFFER: 0 });
        const dbl = cfg({ DOUBLEBUFFER: 1 });
        assert.deepStrictEqual(ids(chooseFBConfigs([single, dbl], { DOUBLEBUFFER: true })),
            [dbl.FBCONFIG_ID]);
        assert.deepStrictEqual(ids(chooseFBConfigs([single, dbl], { DOUBLEBUFFER: false })),
            [single.FBCONFIG_ID]);
        assert.strictEqual(chooseFBConfigs([single, dbl], {}).length, 2);
    });

    it('null means don\'t care', () => {
        const stereo = cfg({ STEREO: 1 });
        const mono = cfg({});
        // STEREO defaults to false; null lifts the restriction
        assert.strictEqual(chooseFBConfigs([stereo, mono], {}).length, 1);
        assert.strictEqual(chooseFBConfigs([stereo, mono], { STEREO: null }).length, 2);
    });

    it('FBCONFIG_ID short-circuits every other attribute', () => {
        const indexOnly = cfg({ RENDER_TYPE: C.COLOR_INDEX_BIT, DOUBLEBUFFER: 1 });
        const other = cfg({});
        const out = chooseFBConfigs([other, indexOnly],
            { FBCONFIG_ID: indexOnly.FBCONFIG_ID, DOUBLEBUFFER: false });
        assert.deepStrictEqual(ids(out), [indexOnly.FBCONFIG_ID]);
    });

    it('unknown attribute names throw', () => {
        assert.throws(() => chooseFBConfigs([cfg({})], { RED_SIZ: 8 }),
            /unknown GLX attribute/);
    });

    it('an attribute the config does not report only matches undemanding requests', () => {
        const noSamples = cfg({}); // SAMPLE_BUFFERS/SAMPLES absent
        assert.strictEqual(chooseFBConfigs([noSamples], { SAMPLES: 4 }).length, 0);
        assert.strictEqual(chooseFBConfigs([noSamples], { SAMPLES: 0 }).length, 1);
    });
  });

  describe('sorting', () => {

    it('rule 1: no caveat, then slow, then non-conformant', () => {
        const slow = cfg({ CONFIG_CAVEAT: C.SLOW_CONFIG });
        const nonConf = cfg({ CONFIG_CAVEAT: C.NON_CONFORMANT_CONFIG });
        const clean = cfg({});
        const out = chooseFBConfigs([slow, nonConf, clean], {});
        assert.deepStrictEqual(ids(out),
            [clean.FBCONFIG_ID, slow.FBCONFIG_ID, nonConf.FBCONFIG_ID]);
    });

    it('rule 2: deeper color wins only for requested components', () => {
        const deep = cfg({ RED_SIZE: 10, GREEN_SIZE: 10, BLUE_SIZE: 10,
            ALPHA_SIZE: 2, BUFFER_SIZE: 32 });
        const shallow = cfg({});
        // color depth requested: deeper first despite larger BUFFER_SIZE
        assert.deepStrictEqual(ids(chooseFBConfigs([shallow, deep], { RED_SIZE: 1 })),
            [deep.FBCONFIG_ID, shallow.FBCONFIG_ID]);
        // not requested: rule 3 (smaller BUFFER_SIZE) decides instead
        assert.deepStrictEqual(ids(chooseFBConfigs([deep, shallow], {})),
            [shallow.FBCONFIG_ID, deep.FBCONFIG_ID]);
    });

    it('rule 4: single buffered precedes double buffered', () => {
        const dbl = cfg({ DOUBLEBUFFER: 1 });
        const single = cfg({});
        assert.deepStrictEqual(ids(chooseFBConfigs([dbl, single], {})),
            [single.FBCONFIG_ID, dbl.FBCONFIG_ID]);
    });

    it('rule 6: no depth buffer preferred when unrequested, largest when requested', () => {
        const none = cfg({});
        const d16 = cfg({ DEPTH_SIZE: 16 });
        const d24 = cfg({ DEPTH_SIZE: 24 });
        assert.deepStrictEqual(ids(chooseFBConfigs([d16, d24, none], {})),
            [none.FBCONFIG_ID, d24.FBCONFIG_ID, d16.FBCONFIG_ID]);
        assert.deepStrictEqual(ids(chooseFBConfigs([d16, d24, none], { DEPTH_SIZE: 1 })),
            [d24.FBCONFIG_ID, d16.FBCONFIG_ID]);
    });

    it('rule 7: smaller stencil preferred', () => {
        const s8 = cfg({ STENCIL_SIZE: 8 });
        const s0 = cfg({});
        assert.deepStrictEqual(ids(chooseFBConfigs([s8, s0], {})),
            [s0.FBCONFIG_ID, s8.FBCONFIG_ID]);
    });

    it('rule 8: larger accum total wins for requested components', () => {
        const accum16 = cfg({ ACCUM_RED_SIZE: 16, ACCUM_GREEN_SIZE: 16,
            ACCUM_BLUE_SIZE: 16 });
        const accum8 = cfg({ ACCUM_RED_SIZE: 8, ACCUM_GREEN_SIZE: 8,
            ACCUM_BLUE_SIZE: 8 });
        const out = chooseFBConfigs([accum8, accum16], { ACCUM_RED_SIZE: 1 });
        assert.deepStrictEqual(ids(out),
            [accum16.FBCONFIG_ID, accum8.FBCONFIG_ID]);
    });

    it('rule 9: TrueColor visuals precede DirectColor', () => {
        const direct = cfg({ X_VISUAL_TYPE: C.DIRECT_COLOR });
        const truec = cfg({});
        assert.deepStrictEqual(ids(chooseFBConfigs([direct, truec], {})),
            [truec.FBCONFIG_ID, direct.FBCONFIG_ID]);
    });

    it('equal configs keep server order', () => {
        const a = cfg({});
        const b = cfg({});
        const c = cfg({});
        assert.deepStrictEqual(ids(chooseFBConfigs([a, b, c], {})),
            [a.FBCONFIG_ID, b.FBCONFIG_ID, c.FBCONFIG_ID]);
    });
  });
});
