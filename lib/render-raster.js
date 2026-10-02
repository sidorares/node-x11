'use strict';

// RENDER's polygon rasterization, as the X servers do it.
//
// renderproto defines the default poly-mode, Precise ("Polygon
// Rasterization"): for an 8-bit alpha, a regular grid of samples 17 wide and
// 15 high in each pixel, and each trapezoid or triangle Add-combined into the
// mask. 17 x 15 = 255, so a pixel's alpha is its count of covered samples.
// pixman implements it, and pixman is what rasterizes Trapezoids, Triangles,
// TriStrip, TriFan and AddTraps on the common servers: fb (Xvfb, XQuartz,
// Xorg unaccelerated) through pixman_composite_trapezoids and
// pixman_add_traps, glamor (Xorg's modesetting driver, Xwayland) through
// pixman_rasterize_trapezoid and fbTriangles.
//
// This is a port of pixman's pixman-trap.c, pixman-edge.c and
// pixman-edge-imp.h, down to their rounding, so that the bytes come out the
// same. Coordinates are the 16.16 fixed-point integers of the requests, not
// floats, and every quirk is kept, because matching the servers is the
// point. The one that looks like a bug: pixman_edge_step leaves an edge's
// error term alone when a step carries nothing, so an edge entered part-way
// down has not quite the x it would have had stepped there one sample row
// at a time — and where a trapezoid's rasterization starts depends on the
// mask it is drawn into (see `window` below).
//
// The JS server (lib/xserver/extensions/render.js) rasterizes with this, and
// a client can use it to know the mask a server will draw: no Node APIs, so
// it runs in a browser too.
//
// A mask is an object
//   data    — the pixels, one array element each: alpha 0..255 in the low
//             byte (a Uint8Array, or the JS server's Uint32Array rasters), or
//             for `bits: 1` the low bit
//   width, height — the image the shapes are clipped to
//   bits    — 8 (the default) or 1, as pixman's a8 and a1
//   window  — optional { x, y, width, height } inside the image: the part of
//             it `data` holds. The shapes are clipped against the image, not
//             the window, so a window comes out as those bytes of the whole.
//   stride  — elements per row of `data`; the window's width by default
// and the shapes are Add-combined into it, saturating, as pixman adds them
// into its image (for `bits: 1`, or-ed).

// sample rows per pixel at 8 bits (N_Y_FRAC) and their spacing, in 16.16
const STEP_Y_SMALL = 4369; // 65536 / 15
const STEP_Y_BIG = 4370; // 65536 - 14 * STEP_Y_SMALL
const Y_FRAC_FIRST = 2185; // STEP_Y_BIG / 2
const Y_FRAC_LAST = 63351; // Y_FRAC_FIRST + 14 * STEP_Y_SMALL
// sample columns per pixel at 8 bits (N_X_FRAC)
const N_X_FRAC = 17;
const STEP_X_SMALL = 3855; // 65536 / 17
const X_FRAC_FIRST = 1928; // (65536 - 16 * STEP_X_SMALL) / 2

// at 1 bit, one sample, at the centre of the pixel
const STEP_Y_1 = 65536;
const Y_FRAC_1 = 32768;

// the two sample grids, as pixman_edge_init and the sample functions use them
const GRID8 = { stepSmall: STEP_Y_SMALL, stepBig: STEP_Y_BIG, first: Y_FRAC_FIRST, last: Y_FRAC_LAST };
const GRID1 = { stepSmall: STEP_Y_1, stepBig: STEP_Y_1, first: Y_FRAC_1, last: Y_FRAC_1 };

// C's integer division, which truncates toward zero. Exact for |a| < 2^53: a
// quotient that is not whole lies at least 1/|b| from the nearest integer,
// further than rounding the double can carry it.
const cdiv = (a, b) => Math.trunc(a / b);

// pixman_fixed_ceil, then to int: the first whole pixel at or after f
const ceilInt = f => ((f + 0xffff) | 0) >> 16;

/** pixman_sample_ceil_y: the first sample row at or below y */
function sampleCeilY(y, g) {
    const f = y & 0xffff;
    let i = y - f;
    let fy = Math.floor((f - g.first + (g.stepSmall - 1)) / g.stepSmall) * g.stepSmall + g.first;
    if (fy > g.last) {
        if (i >> 16 === 0x7fff) {
            fy = 0xffff; // saturate
        } else {
            fy = g.first;
            i += 65536;
        }
    }
    return i | fy;
}

/** pixman_sample_floor_y: the last sample row strictly above y */
function sampleFloorY(y, g) {
    const f = y & 0xffff;
    let i = y - f;
    let fy = Math.floor((f - 1 - g.first) / g.stepSmall) * g.stepSmall + g.first;
    if (fy < g.first) {
        if (i >> 16 === -32768) {
            fy = 0; // saturate
        } else {
            fy = g.last;
            i -= 65536;
        }
    }
    return i | fy;
}

// pixman_edge_t, as int32 fields: storing into the array truncates the way
// C's int32 does
const X = 0;
const E = 1;
const DY = 2;
const SIGNDX = 3;
const STEPX_SMALL = 4;
const DX_SMALL = 5;
const STEPX_BIG = 6;
const DX_BIG = 7;
const STEPX = 8;
const DX = 9;
const left = new Int32Array(10);
const right = new Int32Array(10);

/** _pixman_edge_multi_init: the x step and error step for n units of y */
function multiInit(edge, n, stepxAt, dxAt) {
    // |n * dx| < 65536 * 2^31: exact in a double
    let ne = n * edge[DX];
    let stepx = Math.imul(n, edge[STEPX]);
    if (ne > 0) {
        const nx = cdiv(ne, edge[DY]) | 0;
        ne -= nx * edge[DY];
        stepx = (stepx + Math.imul(nx, edge[SIGNDX])) | 0;
    }
    edge[stepxAt] = stepx;
    edge[dxAt] = ne;
}

/**
 * pixman_edge_step: move the edge n units of y at once. The products are
 * 64-bit in C, and n * dx passes 2^53 for a tall edge entered far below its
 * top, so past that it is done in BigInt.
 */
function edgeStep(edge, n) {
    const dx = edge[DX];
    const dy = edge[DY];
    const signdx = edge[SIGNDX];
    edge[X] = (edge[X] + Math.imul(n, edge[STEPX])) | 0;
    const carry = n * dx;
    if (Math.abs(carry) <= 2 ** 52) {
        const ne = edge[E] + carry;
        if (n >= 0) {
            // the error term is not updated when nothing carries: pixman's
            if (ne > 0) {
                const nx = cdiv(ne + dy - 1, dy) | 0;
                edge[E] = ne - nx * dy;
                edge[X] = (edge[X] + Math.imul(nx, signdx)) | 0;
            }
        } else if (ne <= -dy) {
            const nx = cdiv(-ne, dy) | 0;
            edge[E] = ne + nx * dy;
            edge[X] = (edge[X] - Math.imul(nx, signdx)) | 0;
        }
        return;
    }
    const ne = BigInt(edge[E]) + BigInt(n) * BigInt(dx);
    const bdy = BigInt(dy);
    if (n >= 0) {
        if (ne > 0n) {
            const nx = BigInt.asIntN(32, (ne + bdy - 1n) / bdy);
            edge[E] = Number(BigInt.asIntN(32, ne - nx * bdy));
            edge[X] = (edge[X] + Math.imul(Number(nx), signdx)) | 0;
        }
    } else if (ne <= -bdy) {
        const nx = BigInt.asIntN(32, -ne / bdy);
        edge[E] = Number(BigInt.asIntN(32, ne + nx * bdy));
        edge[X] = (edge[X] - Math.imul(Number(nx), signdx)) | 0;
    }
}

/**
 * pixman_edge_init: the edge from (xTop, yTop) down to (xBot, yBot), placed
 * on the sample row yStart
 */
function edgeInit(edge, g, yStart, xTop, yTop, xBot, yBot) {
    const dx = (xBot - xTop) | 0;
    const dy = (yBot - yTop) | 0;
    edge[X] = xTop;
    edge[E] = 0;
    edge[DY] = dy;
    edge[DX] = 0;
    // pixman leaves these unset for a horizontal edge, which never reaches
    // a sample row
    edge[STEPX] = 0;
    edge[SIGNDX] = 0;
    edge[STEPX_SMALL] = edge[DX_SMALL] = edge[STEPX_BIG] = edge[DX_BIG] = 0;
    if (dy) {
        if (dx >= 0) {
            edge[SIGNDX] = 1;
            edge[STEPX] = cdiv(dx, dy);
            edge[DX] = dx % dy;
            edge[E] = -dy;
        } else {
            const ndx = -dx | 0;
            edge[SIGNDX] = -1;
            edge[STEPX] = -cdiv(ndx, dy);
            edge[DX] = ndx % dy;
            edge[E] = 0;
        }
        multiInit(edge, g.stepSmall, STEPX_SMALL, DX_SMALL);
        multiInit(edge, g.stepBig, STEPX_BIG, DX_BIG);
    }
    edgeStep(edge, (yStart - yTop) | 0);
}

/** pixman_line_fixed_edge_init: the line through two points, top first */
function lineEdgeInit(edge, g, yStart, x1, y1, x2, y2, xo, yo) {
    if (y1 <= y2)
        edgeInit(edge, g, yStart, (x1 + xo) | 0, (y1 + yo) | 0, (x2 + xo) | 0, (y2 + yo) | 0);
    else
        edgeInit(edge, g, yStart, (x2 + xo) | 0, (y2 + yo) | 0, (x1 + xo) | 0, (y1 + yo) | 0);
}

// One row of span coverage, as a difference array: a span adds 17 - ls to the
// pixel it starts in, 17 to each one after, rs to the one it ends in, which is
// four cells however long the span. Sample rows are summed into it and each
// pixel row is integrated into the mask as the edges step past it, so the
// scratch is one row wide whatever the mask. Every count is non-negative, so
// adding a row's sum and saturating once is pixman's saturating add of every
// span in turn.
let rowAcc = new Int32Array(0);

function rowScratch(cells) {
    if (rowAcc.length < cells)
        rowAcc = new Int32Array(Math.max(cells, rowAcc.length * 2));
    return rowAcc;
}

/** add window row `row` of the accumulated coverage into the mask */
function flushRow(m, acc, row, lo, hi) {
    const data = m.data;
    const at = row * m.stride;
    let sum = 0;
    for (let x = lo; x <= hi; x++) {
        sum += acc[x];
        acc[x] = 0;
        if (sum > 0) {
            const v = (data[at + x] & 0xff) + sum;
            data[at + x] = v > 255 ? 255 : v;
        }
    }
    acc[hi + 1] = 0;
}

/**
 * rasterize_edges_8 between the edges `left` and `right`, from sample row t
 * to b inclusive. pixman clips each span to the image: from 0, and to its
 * last pixel taken whole. Clipping to the window instead gives the window's
 * pixels what the image's clip gives them, since a clipped span adds to the
 * pixels it still reaches what the whole span would.
 */
function rasterizeEdges8(m, t, b) {
    const ww = m.ww;
    const wh = m.wh;
    const xLo = m.wx * 65536;
    const xEnd = ww * 65536;
    const acc = rowScratch(ww + 2);
    let y = t;
    let row = (y >> 16) - m.wy;
    if (row >= wh)
        return;
    let lx = left[X];
    let le = left[E];
    const ldy = left[DY];
    const lsign = left[SIGNDX];
    const lsxs = left[STEPX_SMALL];
    const ldxs = left[DX_SMALL];
    const lsxb = left[STEPX_BIG];
    const ldxb = left[DX_BIG];
    let rx = right[X];
    let re = right[E];
    const rdy = right[DY];
    const rsign = right[SIGNDX];
    const rsxs = right[STEPX_SMALL];
    const rdxs = right[DX_SMALL];
    const rsxb = right[STEPX_BIG];
    const rdxb = right[DX_BIG];
    let lo = ww;
    let hi = -1;
    for (;;) {
        if (row >= 0) {
            let l = lx - xLo;
            if (l < 0)
                l = 0;
            let r = rx - xLo;
            if (r >= xEnd)
                r = xEnd - 1;
            if (r > l) {
                const li = l >> 16;
                const ri = r >> 16;
                const ls = (((l & 0xffff) + X_FRAC_FIRST) / STEP_X_SMALL) | 0;
                const rs = (((r & 0xffff) + X_FRAC_FIRST) / STEP_X_SMALL) | 0;
                acc[li] += N_X_FRAC - ls;
                acc[li + 1] += ls;
                acc[ri] -= N_X_FRAC - rs;
                acc[ri + 1] -= rs;
                if (li < lo)
                    lo = li;
                if (ri > hi)
                    hi = ri;
            }
        }
        if (y === b) {
            if (hi >= lo)
                flushRow(m, acc, row, lo, hi);
            return;
        }
        if ((y & 0xffff) !== Y_FRAC_LAST) {
            lx = (lx + lsxs) | 0;
            le = (le + ldxs) | 0;
            if (le > 0) {
                le = (le - ldy) | 0;
                lx = (lx + lsign) | 0;
            }
            rx = (rx + rsxs) | 0;
            re = (re + rdxs) | 0;
            if (re > 0) {
                re = (re - rdy) | 0;
                rx = (rx + rsign) | 0;
            }
            y = (y + STEP_Y_SMALL) | 0;
        } else {
            lx = (lx + lsxb) | 0;
            le = (le + ldxb) | 0;
            if (le > 0) {
                le = (le - ldy) | 0;
                lx = (lx + lsign) | 0;
            }
            rx = (rx + rsxb) | 0;
            re = (re + rdxb) | 0;
            if (re > 0) {
                re = (re - rdy) | 0;
                rx = (rx + rsign) | 0;
            }
            y = (y + STEP_Y_BIG) | 0;
            if (hi >= lo) {
                flushRow(m, acc, row, lo, hi);
                lo = ww;
                hi = -1;
            }
            if (++row >= wh)
                return;
        }
    }
}

/**
 * rasterize_edges_1: one sample per pixel, at its centre. pixman moves both
 * edges half a pixel less one unit right, so a centre exactly on an edge
 * goes to the shape on its right, and sets the pixels from the left edge's
 * up to the right edge's.
 */
function rasterizeEdges1(m, t, b) {
    const data = m.data;
    const wh = m.wh;
    const xLo = m.wx * 65536;
    const xEnd = m.ww * 65536;
    let y = t;
    let row = (y >> 16) - m.wy;
    for (;;) {
        if (row >= wh)
            return;
        if (row >= 0) {
            let l = ((left[X] + 32767) | 0) - xLo;
            if (l < 0)
                l = 0;
            let r = ((right[X] + 32767) | 0) - xLo;
            if (r >= xEnd)
                r = xEnd;
            if (r > l) {
                const at = row * m.stride;
                for (let x = l >> 16, ri = r >> 16; x < ri; x++)
                    data[at + x] |= 1;
            }
        }
        if (y === b)
            return;
        stepBig(left);
        stepBig(right);
        y = (y + STEP_Y_1) | 0;
        row++;
    }
}

function stepBig(edge) {
    edge[X] = (edge[X] + edge[STEPX_BIG]) | 0;
    edge[E] = (edge[E] + edge[DX_BIG]) | 0;
    if (edge[E] > 0) {
        edge[E] = (edge[E] - edge[DY]) | 0;
        edge[X] = (edge[X] + edge[SIGNDX]) | 0;
    }
}

/** the mask, checked, with its window and grid resolved */
function prepare(mask) {
    const bits = mask.bits === undefined ? 8 : mask.bits;
    if (bits !== 8 && bits !== 1)
        throw new RangeError(`render-raster: bits must be 8 or 1, got ${bits}`);
    const width = mask.width | 0;
    const height = mask.height | 0;
    const w = mask.window || { x: 0, y: 0, width, height };
    const wx = w.x | 0;
    const wy = w.y | 0;
    const ww = w.width | 0;
    const wh = w.height | 0;
    if (wx < 0 || wy < 0 || ww < 0 || wh < 0 || wx + ww > width || wy + wh > height)
        throw new RangeError('render-raster: the window must lie inside the mask');
    // spans are worked in window-relative 16.16, which an int32 holds to
    // 32767 pixels: the most an X drawable has
    if (ww > 32767)
        throw new RangeError('render-raster: a mask or window is at most 32767 pixels wide');
    const stride = mask.stride === undefined ? ww : mask.stride | 0;
    if (mask.data.length < (wh > 0 ? (wh - 1) * stride + ww : 0))
        throw new RangeError('render-raster: data is too short for the mask');
    return {
        data: mask.data,
        stride,
        bits,
        g: bits === 1 ? GRID1 : GRID8,
        width,
        height,
        wx,
        wy,
        ww,
        wh
    };
}

/** rasterize between the edges already set up, from sample row t to b */
function rasterizeEdges(m, t, b) {
    if (m.bits === 1)
        rasterizeEdges1(m, t, b);
    else
        rasterizeEdges8(m, t, b);
}

/** pixman_rasterize_trapezoid for the trapezoid at `traps[i]` */
function rasterizeTrapezoid(m, traps, i, xo, yo) {
    const top = traps[i] | 0;
    const bottom = traps[i + 1] | 0;
    const l1y = traps[i + 3] | 0;
    const l2y = traps[i + 5] | 0;
    const r1y = traps[i + 7] | 0;
    const r2y = traps[i + 9] | 0;
    // pixman_trapezoid_valid
    if (l1y === l2y || r1y === r2y || !(bottom > top))
        return;
    if (m.ww === 0 || m.wh === 0)
        return;
    let t = (top + yo) | 0;
    if (t < 0)
        t = 0;
    t = sampleCeilY(t, m.g);
    let b = (bottom + yo) | 0;
    if (b >> 16 >= m.height)
        b = ((m.height << 16) - 1) | 0;
    b = sampleFloorY(b, m.g);
    if (b < t)
        return;
    lineEdgeInit(left, m.g, t, traps[i + 2] | 0, l1y, traps[i + 4] | 0, l2y, xo, yo);
    lineEdgeInit(right, m.g, t, traps[i + 6] | 0, r1y, traps[i + 8] | 0, r2y, xo, yo);
    rasterizeEdges(m, t, b);
}

/**
 * pixman_add_trapezoids: Add-combine trapezoids into the mask, offset by
 * (xOff, yOff) whole pixels. `trapezoids` is flat 16.16 integers, ten per
 * trapezoid in the order of the Trapezoids request: top, bottom, then the
 * left line's two points x1, y1, x2, y2 and the right line's. Each side is
 * the whole line through its points, whatever their y, cut at top and
 * bottom. A trapezoid with a horizontal side or with bottom <= top is
 * skipped.
 */
function addTrapezoids(mask, xOff, yOff, trapezoids) {
    const m = prepare(mask);
    const xo = xOff << 16;
    const yo = yOff << 16;
    for (let i = 0; i + 9 < trapezoids.length; i += 10)
        rasterizeTrapezoid(m, trapezoids, i, xo, yo);
}

/**
 * pixman_add_traps: Add-combine the AddTraps request's trapezoids into the
 * mask, offset by (xOff, yOff) whole pixels. `traps` is flat 16.16
 * integers, six per trap in the request's order: top left x, right x, y,
 * then bottom left x, right x, y. Each side runs from its top point to its
 * bottom point.
 */
function addTraps(mask, xOff, yOff, traps) {
    const m = prepare(mask);
    if (m.ww === 0 || m.wh === 0)
        return;
    const xo = xOff << 16;
    const yo = yOff << 16;
    for (let i = 0; i + 5 < traps.length; i += 6) {
        const topY = ((traps[i + 2] | 0) + yo) | 0;
        const botY = ((traps[i + 5] | 0) + yo) | 0;
        let t = topY < 0 ? 0 : topY;
        t = sampleCeilY(t, m.g);
        let b = botY;
        if (b >> 16 >= m.height)
            b = ((m.height << 16) - 1) | 0;
        b = sampleFloorY(b, m.g);
        if (b < t)
            continue;
        edgeInit(left, m.g, t, ((traps[i] | 0) + xo) | 0, topY, ((traps[i + 3] | 0) + xo) | 0, botY);
        edgeInit(right, m.g, t, ((traps[i + 1] | 0) + xo) | 0, topY, ((traps[i + 4] | 0) + xo) | 0, botY);
        rasterizeEdges(m, t, b);
    }
}

// greater_y: below, or level and to the right
const greaterY = (ax, ay, bx, by) => (ay === by ? ax > bx : ay > by);

// clockwise: whether b is clockwise of a about ref, in y-down space. The
// products are 64-bit in C.
function clockwise(refX, refY, ax, ay, bx, by) {
    const adx = (ax - refX) | 0;
    const ady = (ay - refY) | 0;
    const bdx = (bx - refX) | 0;
    const bdy = (by - refY) | 0;
    const p = bdy * adx;
    const q = ady * bdx;
    if (Number.isSafeInteger(p) && Number.isSafeInteger(q))
        return p < q;
    return BigInt(bdy) * BigInt(adx) < BigInt(ady) * BigInt(bdx);
}

/**
 * triangle_to_trapezoids: each triangle — six 16.16 integers, three points —
 * as the two trapezoids pixman splits it into, top half then bottom half,
 * in the layout addTrapezoids takes. A triangle with a level side gives one
 * trapezoid with bottom == top, which is skipped when rasterized.
 */
function trianglesToTrapezoids(triangles) {
    const n = Math.floor(triangles.length / 6);
    const out = new Int32Array(n * 20);
    for (let k = 0; k < n; k++) {
        const i = k * 6;
        let tx = triangles[i] | 0;
        let ty = triangles[i + 1] | 0;
        let lx = triangles[i + 2] | 0;
        let ly = triangles[i + 3] | 0;
        let rx = triangles[i + 4] | 0;
        let ry = triangles[i + 5] | 0;
        let s;
        // the top point first, then left before right
        if (greaterY(tx, ty, lx, ly)) {
            s = lx; lx = tx; tx = s;
            s = ly; ly = ty; ty = s;
        }
        if (greaterY(tx, ty, rx, ry)) {
            s = rx; rx = tx; tx = s;
            s = ry; ry = ty; ty = s;
        }
        if (clockwise(tx, ty, rx, ry, lx, ly)) {
            s = rx; rx = lx; lx = s;
            s = ry; ry = ly; ly = s;
        }
        // down from the top to the higher of the other two points, both
        // sides from the top point; then on to the lower, the side that
        // turned there continuing along the third edge
        const o = k * 20;
        if (ry < ly) {
            putTrapezoid(out, o, ty, ry, tx, ty, lx, ly, tx, ty, rx, ry);
            putTrapezoid(out, o + 10, ry, ly, tx, ty, lx, ly, rx, ry, lx, ly);
        } else {
            putTrapezoid(out, o, ty, ly, tx, ty, lx, ly, tx, ty, rx, ry);
            putTrapezoid(out, o + 10, ly, ry, lx, ly, rx, ry, tx, ty, rx, ry);
        }
    }
    return out;
}

function putTrapezoid(out, o, top, bottom, l1x, l1y, l2x, l2y, r1x, r1y, r2x, r2y) {
    out[o] = top;
    out[o + 1] = bottom;
    out[o + 2] = l1x;
    out[o + 3] = l1y;
    out[o + 4] = l2x;
    out[o + 5] = l2y;
    out[o + 6] = r1x;
    out[o + 7] = r1y;
    out[o + 8] = r2x;
    out[o + 9] = r2y;
}

/**
 * pixman_add_triangles: Add-combine triangles — six 16.16 integers each,
 * three points — into the mask, offset by (xOff, yOff) whole pixels.
 */
function addTriangles(mask, xOff, yOff, triangles) {
    addTrapezoids(mask, xOff, yOff, trianglesToTrapezoids(triangles));
}

/**
 * The triangles of a TriStrip request's points (flat 16.16 x, y pairs):
 * each point after the second with the two before it.
 */
function stripToTriangles(points) {
    const n = Math.floor(points.length / 2);
    const out = new Int32Array(n >= 3 ? (n - 2) * 6 : 0);
    for (let k = 0; k + 2 < n; k++)
        for (let j = 0; j < 6; j++)
            out[k * 6 + j] = points[k * 2 + j];
    return out;
}

/**
 * The triangles of a TriFan request's points (flat 16.16 x, y pairs): the
 * first point with each pair of consecutive points after it.
 */
function fanToTriangles(points) {
    const n = Math.floor(points.length / 2);
    const out = new Int32Array(n >= 3 ? (n - 2) * 6 : 0);
    for (let k = 0; k + 2 < n; k++) {
        out[k * 6] = points[0];
        out[k * 6 + 1] = points[1];
        for (let j = 0; j < 4; j++)
            out[k * 6 + 2 + j] = points[k * 2 + 2 + j];
    }
    return out;
}

/**
 * The whole-pixel box pixman_composite_trapezoids sizes its mask to, for an
 * operator a transparent source has no effect with: from each trapezoid's
 * top to its bottom, and across the x of its four line points (not of its
 * corners). `{ x1, y1, x2, y2 }`, exclusive at x2 and y2, or null when no
 * trapezoid is drawn.
 */
function trapezoidExtents(trapezoids) {
    let x1 = 0x7fffffff;
    let y1 = 0x7fffffff;
    let x2 = -0x80000000;
    let y2 = -0x80000000;
    for (let i = 0; i + 9 < trapezoids.length; i += 10) {
        const top = trapezoids[i] | 0;
        const bottom = trapezoids[i + 1] | 0;
        if ((trapezoids[i + 3] | 0) === (trapezoids[i + 5] | 0) ||
            (trapezoids[i + 7] | 0) === (trapezoids[i + 9] | 0) || !(bottom > top))
            continue;
        if (top >> 16 < y1)
            y1 = top >> 16;
        if (ceilInt(bottom) > y2)
            y2 = ceilInt(bottom);
        for (const k of [2, 4, 6, 8]) {
            const x = trapezoids[i + k] | 0;
            if (x >> 16 < x1)
                x1 = x >> 16;
            if (ceilInt(x) > x2)
                x2 = ceilInt(x);
        }
    }
    if (x1 >= x2 || y1 >= y2)
        return null;
    return { x1, y1, x2, y2 };
}

module.exports = {
    addTraps,
    addTrapezoids,
    addTriangles,
    trianglesToTrapezoids,
    stripToTriangles,
    fanToTriangles,
    trapezoidExtents
};
