'use strict';

// RENDER 0.11's blend operators, Multiply (0x30) to HSLLuminosity (0x3e), as
// pixman composites them. They are the PDF blend modes CSS's mix-blend-mode
// and canvas's globalCompositeOperation name, and they are not Porter-Duff:
// the colour a pixel comes to is a function of both colours, so no pair of
// factors (render.js's blendFactors) can say what they do. Premultiplied, for
// every one of them,
//
//     result alpha  = sa + da - sa * da
//     result colour = (1 - sa) * d + (1 - da) * s + B(s, d)
//
// where B is the mode's blend function scaled by sa * da. A transparent
// source (sa = 0, and so s = 0) leaves the destination as it was, whatever
// the mode: B is 0 there.
//
// pixman runs them two ways, and which one decides the last bit. Those whose
// blend function divides (operator_needs_division in pixman-general.c:
// ColorDodge, ColorBurn, SoftLight and the four HSL modes) go through its
// "wide" path, in floats, and are stored as pixman_float_to_unorm stores
// them, which truncates rather than rounds. The rest stay "narrow", in 8-bit
// integers: Multiply as three products each rounded and added
// (combine_multiply_u), the others as one sum in units of 255 * 255 rounded
// once (PDF_SEPARABLE_BLEND_MODE). The narrow ones are reproduced here to the
// bit; the wide ones are within one of the server's, since pixman's floats
// are single precision and a compiler may fuse their multiply-adds.

const BLEND_FIRST = 0x30;
const BLEND_LAST = 0x3e;

const isBlendOp = op => op >= BLEND_FIRST && op <= BLEND_LAST;

const MULTIPLY = 0x30;
const SCREEN = 0x31;
const OVERLAY = 0x32;
const DARKEN = 0x33;
const LIGHTEN = 0x34;
const COLOR_DODGE = 0x35;
const COLOR_BURN = 0x36;
const HARD_LIGHT = 0x37;
const SOFT_LIGHT = 0x38;
const DIFFERENCE = 0x39;
const EXCLUSION = 0x3a;
const HSL_HUE = 0x3b;
const HSL_SATURATION = 0x3c;
const HSL_COLOR = 0x3d;
const HSL_LUMINOSITY = 0x3e;

/** whether pixman composites `op` in floats (its wide path) */
const isWideBlend = op =>
    op === COLOR_DODGE || op === COLOR_BURN || op === SOFT_LIGHT || op >= HSL_HUE;

// ---------------------------------------------------------------------
// narrow: pixman-combine32.h's 8-bit arithmetic

// a * b / 255, rounded: MUL_UN8
function mulUn8(a, b) {
    const t = a * b + 0x80;
    return ((t >> 8) + t) >> 8;
}

// x / 255, rounded, for x in 0 .. 255 * 255: DIV_ONE_UN8
function divOneUn8(x) {
    const t = x + 0x80;
    return (t + (t >> 8)) >> 8;
}

const clampSum = x => (x < 0 ? 0 : x > 65025 ? 65025 : x);

// B(s, d) * sa * da, in units of 255 * 255, from 8-bit operands
function narrowBlend(op, d, ad, s, as) {
    switch (op) {
        case SCREEN:
            return s * ad + d * as - s * d;
        case OVERLAY:
            return 2 * d < ad ? 2 * s * d : as * ad - 2 * (ad - d) * (as - s);
        case DARKEN: {
            const sd = ad * s, ds = as * d;
            return sd > ds ? ds : sd;
        }
        case LIGHTEN: {
            const sd = ad * s, ds = as * d;
            return sd > ds ? sd : ds;
        }
        case HARD_LIGHT:
            return 2 * s < as ? 2 * s * d : as * ad - 2 * (ad - d) * (as - s);
        case DIFFERENCE: {
            const ds = d * as, sd = s * ad;
            return sd < ds ? ds - sd : sd - ds;
        }
        default: // EXCLUSION
            return s * ad + d * as - 2 * d * s;
    }
}

// `s` and `d` are 8-bit integers, [a, r, g, b]
function narrowPixel(op, s, d, out) {
    const sa = s[0], da = d[0];
    if (op === MULTIPLY) {
        // combine_multiply_u: s * (1 - da) + d * (1 - sa), each product
        // rounded and the pair added with saturation, then d * s rounded and
        // added again with saturation. The alpha goes the same way.
        const isa = 255 - sa, ida = 255 - da;
        for (let c = 0; c < 4; c++) {
            const ss = Math.min(255, mulUn8(s[c], ida) + mulUn8(d[c], isa));
            out[c] = Math.min(255, ss + mulUn8(d[c], s[c]));
        }
        return out;
    }
    const isa = 255 - sa, ida = 255 - da;
    out[0] = divOneUn8(clampSum(da * 255 + sa * 255 - sa * da));
    for (let c = 1; c < 4; c++)
        out[c] = divOneUn8(clampSum(isa * d[c] + ida * s[c] + narrowBlend(op, d[c], da, s[c], sa)));
    return out;
}

// ---------------------------------------------------------------------
// wide: pixman-combine-float.c, on 0..1

// B(s, d) * sa * da for the separable wide modes
function wideSeparable(op, sa, s, da, d) {
    switch (op) {
        case COLOR_DODGE:
            if (d === 0)
                return 0;
            if (d * sa >= sa * da - s * da)
                return sa * da;
            if (sa - s === 0)
                return sa * da;
            return sa * sa * d / (sa - s);
        case COLOR_BURN:
            if (d >= da)
                return sa * da;
            if (sa * (da - d) >= s * da)
                return 0;
            if (s === 0)
                return 0;
            return sa * (da - sa * (da - d) / s);
        default: // SOFT_LIGHT
            if (2 * s <= sa) {
                if (da === 0)
                    return d * sa;
                return d * sa - d * (da - d) * (sa - 2 * s) / da;
            }
            if (da === 0)
                return d * sa;
            if (4 * d <= da)
                return d * sa + (2 * s - sa) * d * ((16 * d / da - 12) * d / da + 3);
            return d * sa + (Math.sqrt(d * da) - d) * (2 * s - sa);
    }
}

const lum = c => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const sat = c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);

// clip_color: pull a colour back inside [0, a] along the line to its
// luminosity
function clipColor(c, a) {
    const l = lum(c);
    const n = Math.min(c[0], c[1], c[2]);
    const x = Math.max(c[0], c[1], c[2]);
    if (n < 0) {
        const t = l - n;
        for (let i = 0; i < 3; i++)
            c[i] = t === 0 ? 0 : l + ((c[i] - l) * l) / t;
    }
    if (x > a) {
        const t = x - l;
        for (let i = 0; i < 3; i++)
            c[i] = t === 0 ? a : l + ((c[i] - l) * (a - l)) / t;
    }
}

function setLum(c, a, l) {
    const delta = l - lum(c);
    c[0] += delta;
    c[1] += delta;
    c[2] += delta;
    clipColor(c, a);
}

// set_sat: the largest channel to `s`, the smallest to 0 and the middle one
// in proportion. Which of two equal channels counts as which makes no
// difference to the result.
function setSat(c, s) {
    let max = 0, min = 0;
    for (let i = 1; i < 3; i++) {
        if (c[i] > c[max])
            max = i;
        if (c[i] < c[min])
            min = i;
    }
    if (max === min) { // all three equal
        c[0] = c[1] = c[2] = 0;
        return;
    }
    const mid = 3 - max - min;
    const t = c[max] - c[min];
    c[mid] = ((c[mid] - c[min]) * s) / t;
    c[max] = s;
    c[min] = 0;
}

// B(s, d) * sa * da for the HSL modes: `res` gets it, from colours `sc`
// and `dc` (premultiplied rgb)
function hslBlend(op, res, dc, da, sc, sa) {
    switch (op) {
        case HSL_HUE:
            for (let i = 0; i < 3; i++)
                res[i] = sc[i] * da;
            setSat(res, sat(dc) * sa);
            setLum(res, sa * da, lum(dc) * sa);
            return;
        case HSL_SATURATION:
            for (let i = 0; i < 3; i++)
                res[i] = dc[i] * sa;
            setSat(res, sat(sc) * da);
            setLum(res, sa * da, lum(dc) * sa);
            return;
        case HSL_COLOR:
            for (let i = 0; i < 3; i++)
                res[i] = sc[i] * da;
            setLum(res, sa * da, lum(dc) * sa);
            return;
        default: // HSL_LUMINOSITY
            for (let i = 0; i < 3; i++)
                res[i] = dc[i] * sa;
            setLum(res, sa * da, lum(sc) * da);
    }
}

// pixman_float_to_unorm(f, 8): clamped, then truncated to 1/256ths with 256
// folded down to 255 — not rounded
function floatToUnorm8(f) {
    if (!(f > 0))
        return 0;
    if (f > 1)
        f = 1;
    const u = Math.floor(f * 256);
    return u - (u >> 8);
}

const scratch = { sc: [0, 0, 0], dc: [0, 0, 0], rc: [0, 0, 0] };

// `s` and `d` are [a, r, g, b] in 0..255, which `s` need not be whole in: a
// mask has scaled it in floats, as pixman's wide path does
function widePixel(op, s, d, out) {
    const sa = s[0] / 255, da = d[0] / 255;
    out[0] = floatToUnorm8(sa + da - sa * da);
    if (op < HSL_HUE) {
        for (let c = 1; c < 4; c++) {
            const sc = s[c] / 255, dc = d[c] / 255;
            out[c] = floatToUnorm8((1 - sa) * dc + (1 - da) * sc + wideSeparable(op, sa, sc, da, dc));
        }
        return out;
    }
    const { sc, dc, rc } = scratch;
    for (let i = 0; i < 3; i++) {
        sc[i] = s[i + 1] / 255;
        dc[i] = d[i + 1] / 255;
    }
    hslBlend(op, rc, dc, da, sc, sa);
    for (let i = 0; i < 3; i++)
        out[i + 1] = floatToUnorm8((1 - sa) * dc[i] + (1 - da) * sc[i] + rc[i]);
    return out;
}

const whole = [0, 0, 0, 0];

/**
 * One pixel through blend operator `op`: `s` (the source, already through
 * any mask) and `d` are [a, r, g, b], premultiplied, 0..255, and `out` gets
 * the result in the same form, in whole numbers. A source that is not whole
 * is rounded first for a narrow mode, as pixman's 8-bit mask multiply
 * rounds it.
 */
function blendPixel(op, s, d, out) {
    if (isWideBlend(op))
        return widePixel(op, s, d, out);
    for (let c = 0; c < 4; c++)
        whole[c] = Math.round(s[c]);
    return narrowPixel(op, whole, d, out);
}

module.exports = { BLEND_FIRST, BLEND_LAST, isBlendOp, isWideBlend, blendPixel };
