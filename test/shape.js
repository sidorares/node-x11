const x11 = require('../lib');
const should = require('should');

describe('SHAPE extension', () => {
    let display;
    let X;
    let shape;
    let root;
    let wid1;
    let wid2;

    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            X.require('shape', (err, ext) => {
                should.not.exist(err);
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

    after(done => {
        X.DestroyWindow(wid1);
        X.DestroyWindow(wid2);
        X.terminate();
        X.on('end', done);
    });

    // sort by y then x so we can compare regardless of server-side ordering
    const sortRects = rects =>
        rects.slice().sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));

    const shapeRects = [[0, 0, 10, 10], [20, 20, 10, 10]];

    it('Rectangles + GetRectangles should round-trip a bounding shape', done => {
        shape.Rectangles(shape.Op.Set, shape.Kind.Bounding, wid1, 0, 0, shapeRects);
        shape.GetRectangles(wid1, shape.Kind.Bounding, (err, res) => {
            should.not.exist(err);
            res.ordering.should.be.within(0, 3);
            sortRects(res.rectangles).should.eql(sortRects(shapeRects));
            done();
        });
    });

    it('QueryExtents should report the bounding shape extents', done => {
        shape.QueryExtents(wid1, (err, extents) => {
            should.not.exist(err);
            extents.boundingShaped.should.equal(true);
            extents.clipShaped.should.equal(false);
            extents.bounding.should.eql({ x: 0, y: 0, width: 30, height: 30 });
            // clip shape not set: extents cover the whole 100x100 window
            extents.clip.should.eql({ x: 0, y: 0, width: 100, height: 100 });
            done();
        });
    });

    it('Combine should copy the shape from one window to another', done => {
        shape.Combine(shape.Op.Set, shape.Kind.Bounding, shape.Kind.Bounding,
            wid2, 0, 0, wid1);
        shape.GetRectangles(wid2, shape.Kind.Bounding, (err, res) => {
            should.not.exist(err);
            sortRects(res.rectangles).should.eql(sortRects(shapeRects));
            done();
        });
    });

    it('Offset should translate the shape', done => {
        shape.Offset(shape.Kind.Bounding, wid1, 5, 7);
        shape.QueryExtents(wid1, (err, extents) => {
            should.not.exist(err);
            extents.bounding.should.eql({ x: 5, y: 7, width: 30, height: 30 });
            shape.GetRectangles(wid1, shape.Kind.Bounding, (err, res) => {
                should.not.exist(err);
                sortRects(res.rectangles).should.eql(
                    sortRects(shapeRects.map(r => [r[0] + 5, r[1] + 7, r[2], r[3]])));
                done();
            });
        });
    });
});
