const { describe, it, before, after } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('SHAPE extension', () => {
    let display;
    let X;
    let shape;
    let root;
    let wid1;
    let wid2;

    before((t, done) => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            X.require('shape', (err, ext) => {
                assert.ifError(err);
                shape = ext;
                wid1 = X.AllocID();
                X.CreateWindow(wid1, root, 0, 0, 100, 100);
                wid2 = X.AllocID();
                X.CreateWindow(wid2, root, 0, 0, 100, 100);
                done();
            });
        });
        client.on('error', done);
    });

    after((t, done) => {
        X.DestroyWindow(wid1);
        X.DestroyWindow(wid2);
        X.terminate();
        X.on('end', done);
    });

    // sort by y then x so we can compare regardless of server-side ordering
    const sortRects = rects =>
        rects.slice().sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));

    const shapeRects = [[0, 0, 10, 10], [20, 20, 10, 10]];

    it('Rectangles + GetRectangles should round-trip a bounding shape', (t, done) => {
        shape.Rectangles(shape.Op.Set, shape.Kind.Bounding, wid1, 0, 0, shapeRects);
        shape.GetRectangles(wid1, shape.Kind.Bounding, (err, res) => {
            assert.ifError(err);
            assert.ok(res.ordering >= 0 && res.ordering <= 3);
            assert.deepStrictEqual(sortRects(res.rectangles), sortRects(shapeRects));
            done();
        });
    });

    it('QueryExtents should report the bounding shape extents', (t, done) => {
        shape.QueryExtents(wid1, (err, extents) => {
            assert.ifError(err);
            assert.strictEqual(extents.boundingShaped, true);
            assert.strictEqual(extents.clipShaped, false);
            assert.deepStrictEqual(extents.bounding, { x: 0, y: 0, width: 30, height: 30 });
            // clip shape not set: extents cover the whole 100x100 window
            assert.deepStrictEqual(extents.clip, { x: 0, y: 0, width: 100, height: 100 });
            done();
        });
    });

    it('Combine should copy the shape from one window to another', (t, done) => {
        shape.Combine(shape.Op.Set, shape.Kind.Bounding, shape.Kind.Bounding,
            wid2, 0, 0, wid1);
        shape.GetRectangles(wid2, shape.Kind.Bounding, (err, res) => {
            assert.ifError(err);
            assert.deepStrictEqual(sortRects(res.rectangles), sortRects(shapeRects));
            done();
        });
    });

    it('Offset should translate the shape', (t, done) => {
        shape.Offset(shape.Kind.Bounding, wid1, 5, 7);
        shape.QueryExtents(wid1, (err, extents) => {
            assert.ifError(err);
            assert.deepStrictEqual(extents.bounding, { x: 5, y: 7, width: 30, height: 30 });
            shape.GetRectangles(wid1, shape.Kind.Bounding, (err, res) => {
                assert.ifError(err);
                assert.deepStrictEqual(sortRects(res.rectangles), sortRects(shapeRects.map(r => [r[0] + 5, r[1] + 7, r[2], r[3]])));
                done();
            });
        });
    });
});
