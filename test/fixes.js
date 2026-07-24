const x11 = require('../lib');
const should = require('should');

describe('XFIXES extension', () => {

    let display;
    let X;
    let F;
    let root;
    let xErrors;

    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            xErrors = [];
            X.on('error', e => xErrors.push(e));
            X.require('fixes', (err, ext) => {
                should.not.exist(err);
                F = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after(done => {
        X.terminate();
        X.on('end', done);
        X = null;
        display = null;
    });

    // Any request with a reply acts as a barrier: once it completes, errors
    // caused by earlier no-reply requests have already been delivered.
    const sync = cb => {
        F.QueryVersion(5, 0, err => {
            should.not.exist(err);
            cb();
        });
    };

    const assertNoErrors = cb => {
        sync(() => {
            xErrors.should.be.empty();
            cb();
        });
    };

    const createRegion = rects => {
        const region = X.AllocID();
        F.CreateRegion(region, rects);
        return region;
    };

    const white = { R: 0xffff, G: 0xffff, B: 0xffff };
    const black = { R: 0, G: 0, B: 0 };

    const createGlyphCursor = (sourceChar) => {
        const fid = X.AllocID();
        X.OpenFont(fid, 'cursor');
        const cid = X.AllocID();
        X.CreateGlyphCursor(cid, fid, fid, sourceChar, sourceChar + 1, black, white);
        X.CloseFont(fid);
        return cid;
    };

    beforeEach(() => {
        xErrors = [];
    });

    it('negotiates at least version 5', () => {
        F.major.should.be.aboveOrEqual(5);
    });

    it('SetRegion replaces the contents of a region', done => {
        const region = createRegion([{ x: 0, y: 0, width: 100, height: 100 }]);
        F.SetRegion(region, [{ x: 1, y: 2, width: 3, height: 4 }]);
        F.FetchRegion(region, (err, reg) => {
            should.not.exist(err);
            reg.extents.should.eql({ x: 1, y: 2, width: 3, height: 4 });
            reg.rectangles.should.eql([{ x: 1, y: 2, width: 3, height: 4 }]);
            F.DestroyRegion(region);
            done();
        });
    });

    it('CopyRegion duplicates a region', done => {
        const src = createRegion([{ x: 7, y: 8, width: 9, height: 10 }]);
        const dst = createRegion([]);
        F.CopyRegion(src, dst);
        F.FetchRegion(dst, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 7, y: 8, width: 9, height: 10 }]);
            F.DestroyRegion(src);
            F.DestroyRegion(dst);
            done();
        });
    });

    it('IntersectRegion computes the overlap', done => {
        const r1 = createRegion([{ x: 0, y: 0, width: 10, height: 10 }]);
        const r2 = createRegion([{ x: 5, y: 5, width: 10, height: 10 }]);
        const dst = createRegion([]);
        F.IntersectRegion(r1, r2, dst);
        F.FetchRegion(dst, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 5, y: 5, width: 5, height: 5 }]);
            [r1, r2, dst].forEach(r => F.DestroyRegion(r));
            done();
        });
    });

    it('SubtractRegion computes the difference', done => {
        const r1 = createRegion([{ x: 0, y: 0, width: 10, height: 10 }]);
        const r2 = createRegion([{ x: 0, y: 5, width: 10, height: 10 }]);
        const dst = createRegion([]);
        F.SubtractRegion(r1, r2, dst);
        F.FetchRegion(dst, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 0, y: 0, width: 10, height: 5 }]);
            [r1, r2, dst].forEach(r => F.DestroyRegion(r));
            done();
        });
    });

    it('InvertRegion inverts within bounds', done => {
        const src = createRegion([{ x: 0, y: 0, width: 10, height: 20 }]);
        const dst = createRegion([]);
        F.InvertRegion(src, { x: 0, y: 0, width: 20, height: 20 }, dst);
        F.FetchRegion(dst, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 10, y: 0, width: 10, height: 20 }]);
            F.DestroyRegion(src);
            F.DestroyRegion(dst);
            done();
        });
    });

    it('ExpandRegion grows every rectangle', done => {
        const region = createRegion([{ x: 10, y: 10, width: 5, height: 5 }]);
        F.ExpandRegion(region, region, 1, 2, 3, 4);
        F.FetchRegion(region, (err, reg) => {
            should.not.exist(err);
            reg.extents.should.eql({ x: 9, y: 7, width: 8, height: 12 });
            F.DestroyRegion(region);
            done();
        });
    });

    it('RegionExtents reduces a region to its bounding box', done => {
        const src = createRegion([
            { x: 0, y: 0, width: 5, height: 5 },
            { x: 20, y: 20, width: 5, height: 5 }
        ]);
        const dst = createRegion([]);
        F.RegionExtents(src, dst);
        F.FetchRegion(dst, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 0, y: 0, width: 25, height: 25 }]);
            F.DestroyRegion(src);
            F.DestroyRegion(dst);
            done();
        });
    });

    it('CreateRegionFromBitmap picks up the set bits of a depth-1 pixmap', done => {
        const pix = X.AllocID();
        X.CreatePixmap(pix, root, 1, 16, 16);
        const gc = X.AllocID();
        X.CreateGC(gc, pix, { foreground: 0 });
        X.PolyFillRectangle(pix, gc, [0, 0, 16, 16]); // deterministic: clear all bits
        X.ChangeGC(gc, { foreground: 1 });
        X.PolyFillRectangle(pix, gc, [2, 3, 4, 5]);
        const region = X.AllocID();
        F.CreateRegionFromBitmap(region, pix);
        F.FetchRegion(region, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 2, y: 3, width: 4, height: 5 }]);
            F.DestroyRegion(region);
            X.FreeGC(gc);
            X.FreePixmap(pix);
            done();
        });
    });

    it('SetGCClipRegion / CreateRegionFromGC round-trip', done => {
        const gc = X.AllocID();
        X.CreateGC(gc, root);
        const clip = createRegion([{ x: 2, y: 3, width: 4, height: 5 }]);
        F.SetGCClipRegion(gc, clip, 0, 0);
        const region = X.AllocID();
        F.CreateRegionFromGC(region, gc);
        F.FetchRegion(region, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 2, y: 3, width: 4, height: 5 }]);
            F.SetGCClipRegion(gc, 0, 0, 0); // None: remove the clip again
            F.DestroyRegion(region);
            F.DestroyRegion(clip);
            X.FreeGC(gc);
            assertNoErrors(done);
        });
    });

    it('SetWindowShapeRegion / CreateRegionFromWindow round-trip', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 32, 32);
        const shape = createRegion([{ x: 0, y: 0, width: 8, height: 8 }]);
        F.SetWindowShapeRegion(wid, F.WindowRegionKind.Bounding, 0, 0, shape);
        const region = X.AllocID();
        F.CreateRegionFromWindow(region, wid, F.WindowRegionKind.Bounding);
        F.FetchRegion(region, (err, reg) => {
            should.not.exist(err);
            reg.rectangles.should.eql([{ x: 0, y: 0, width: 8, height: 8 }]);
            F.SetWindowShapeRegion(wid, F.WindowRegionKind.Bounding, 0, 0, 0); // None
            F.DestroyRegion(region);
            F.DestroyRegion(shape);
            X.DestroyWindow(wid);
            assertNoErrors(done);
        });
    });

    it('SetPictureClipRegion / CreateRegionFromPicture round-trip', done => {
        X.require('render', (err, Render) => {
            should.not.exist(err);
            const wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, 32, 32);
            const pict = X.AllocID();
            Render.CreatePicture(pict, wid, Render.rgb24);
            const clip = createRegion([{ x: 1, y: 1, width: 6, height: 7 }]);
            F.SetPictureClipRegion(pict, clip, 0, 0);
            const region = X.AllocID();
            F.CreateRegionFromPicture(region, pict);
            F.FetchRegion(region, (err, reg) => {
                should.not.exist(err);
                reg.rectangles.should.eql([{ x: 1, y: 1, width: 6, height: 7 }]);
                F.DestroyRegion(region);
                F.DestroyRegion(clip);
                Render.FreePicture(pict);
                X.DestroyWindow(wid);
                done();
            });
        });
    });

    it('SetCursorName / GetCursorName round-trip', done => {
        const cid = createGlyphCursor(68);
        F.SetCursorName(cid, 'node-x11-test-cursor');
        F.GetCursorName(cid, (err, res) => {
            should.not.exist(err);
            res.name.should.equal('node-x11-test-cursor');
            res.atom.should.be.above(0);
            X.FreeCursor(cid);
            done();
        });
    });

    it('GetCursorImage returns the current cursor image', done => {
        F.GetCursorImage((err, img) => {
            should.not.exist(err);
            img.width.should.be.above(0);
            img.height.should.be.above(0);
            img.cursorImage.length.should.equal(img.width * img.height * 4);
            done();
        });
    });

    it('GetCursorImageAndName reports the displayed cursor name; CursorNotify fires', done => {
        const cid = createGlyphCursor(58);
        F.SetCursorName(cid, 'node-x11-displayed-cursor');
        let sawCursorNotify = false;
        const listener = ev => {
            if (ev.name === 'CursorNotify') {
                ev.subtype.should.equal(F.CursorNotify.DisplayCursor);
                sawCursorNotify = true;
            }
        };
        X.on('event', listener);
        F.SelectCursorInput(root, F.CursorNotifyMask.DisplayCursor);
        X.ChangeWindowAttributes(root, { cursor: cid });
        F.GetCursorImageAndName((err, img) => {
            should.not.exist(err);
            img.cursorName.should.equal('node-x11-displayed-cursor');
            img.cursorAtom.should.be.above(0);
            img.cursorImage.length.should.equal(img.width * img.height * 4);
            sawCursorNotify.should.be.true();
            // restore global state: default cursor, no cursor input events
            F.SelectCursorInput(root, 0);
            X.ChangeWindowAttributes(root, { cursor: 0 });
            X.removeListener('event', listener);
            X.FreeCursor(cid);
            assertNoErrors(done);
        });
    });

    it('ChangeCursor and ChangeCursorByName update cursor contents', done => {
        const named = createGlyphCursor(68);
        const src1 = createGlyphCursor(58);
        const src2 = createGlyphCursor(130);
        F.SetCursorName(named, 'node-x11-change-target');
        F.ChangeCursor(src1, named);
        F.ChangeCursorByName(src2, 'node-x11-change-target');
        [named, src1, src2].forEach(c => X.FreeCursor(c));
        assertNoErrors(done);
    });

    it('HideCursor / ShowCursor are accepted', done => {
        F.HideCursor(root);
        F.ShowCursor(root);
        assertNoErrors(done);
    });

    it('CreatePointerBarrier / DeletePointerBarrier are accepted', done => {
        const barrier = X.AllocID();
        F.CreatePointerBarrier(barrier, root, 20, 0, 20, 100, F.BarrierDirections.PositiveX);
        F.DeletePointerBarrier(barrier);
        assertNoErrors(done);
    });

    it('SelectSelectionInput delivers SelectionNotify on SetSelectionOwner', done => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 1, 1);
        X.InternAtom(false, 'NODE_X11_FIXES_TEST_SELECTION', (err, selAtom) => {
            should.not.exist(err);
            const listener = ev => {
                if (ev.name !== 'SelectionNotify')
                    return;
                ev.subtype.should.equal(F.SelectionEvent.SetSelectionOwner);
                ev.window.should.equal(wid);
                ev.owner.should.equal(wid);
                ev.selection.should.equal(selAtom);
                ev.timestamp.should.be.above(0);
                X.removeListener('event', listener);
                F.SelectSelectionInput(wid, selAtom, 0);
                X.SetSelectionOwner(0, selAtom); // release the selection
                X.DestroyWindow(wid);
                assertNoErrors(done);
            };
            X.on('event', listener);
            F.SelectSelectionInput(wid, selAtom, F.SelectionEventMask.SetSelectionOwner);
            X.SetSelectionOwner(wid, selAtom);
        });
    });

    it('ChangeSaveSet accepts a window of another client', done => {
        const client2 = x11.createClient((err, dpy2) => {
            should.not.exist(err);
            const X2 = dpy2.client;
            const wid2 = X2.AllocID();
            X2.CreateWindow(wid2, dpy2.screen[0].root, 0, 0, 1, 1);
            X2.GetGeometry(wid2, err => {   // sync client2 so wid2 exists server-side
                should.not.exist(err);
                F.ChangeSaveSet(wid2, F.SaveSetMode.Insert, F.SaveSetTarget.Root, F.SaveSetMap.Unmap);
                F.ChangeSaveSet(wid2, F.SaveSetMode.Delete, F.SaveSetTarget.Root, F.SaveSetMap.Unmap);
                assertNoErrors(() => {
                    X2.terminate();
                    X2.on('end', done);
                });
            });
        });
        client2.on('error', done);
    });
});
