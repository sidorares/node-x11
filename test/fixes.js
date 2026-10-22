const { describe, it, before, after, beforeEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('XFIXES extension', () => {

    let display;
    let X;
    let F;
    let root;
    let xErrors;

    before((t, done) => {
        const client = x11.createClient((err, dpy) => {
            if (err)
                return done(err);
            display = dpy;
            X = display.client;
            root = display.screen[0].root;
            xErrors = [];
            X.on('error', e => xErrors.push(e));
            X.require('fixes', (err, ext) => {
                assert.ifError(err);
                F = ext;
                done();
            });
        });
        client.on('error', done);
    });

    after((t, done) => {
        X.terminate();
        X.on('end', done);
        X = null;
        display = null;
    });

    // Any request with a reply acts as a barrier: once it completes, errors
    // caused by earlier no-reply requests have already been delivered.
    const sync = cb => {
        F.QueryVersion(5, 0, err => {
            assert.ifError(err);
            cb();
        });
    };

    const assertNoErrors = cb => {
        sync(() => {
            assert.strictEqual(xErrors.length, 0);
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
        assert.ok(F.major >= 5);
    });

    it('SetRegion replaces the contents of a region', (t, done) => {
        const region = createRegion([{ x: 0, y: 0, width: 100, height: 100 }]);
        F.SetRegion(region, [{ x: 1, y: 2, width: 3, height: 4 }]);
        F.FetchRegion(region, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.extents, { x: 1, y: 2, width: 3, height: 4 });
            assert.deepStrictEqual(reg.rectangles, [{ x: 1, y: 2, width: 3, height: 4 }]);
            F.DestroyRegion(region);
            done();
        });
    });

    it('CopyRegion duplicates a region', (t, done) => {
        const src = createRegion([{ x: 7, y: 8, width: 9, height: 10 }]);
        const dst = createRegion([]);
        F.CopyRegion(src, dst);
        F.FetchRegion(dst, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 7, y: 8, width: 9, height: 10 }]);
            F.DestroyRegion(src);
            F.DestroyRegion(dst);
            done();
        });
    });

    it('IntersectRegion computes the overlap', (t, done) => {
        const r1 = createRegion([{ x: 0, y: 0, width: 10, height: 10 }]);
        const r2 = createRegion([{ x: 5, y: 5, width: 10, height: 10 }]);
        const dst = createRegion([]);
        F.IntersectRegion(r1, r2, dst);
        F.FetchRegion(dst, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 5, y: 5, width: 5, height: 5 }]);
            [r1, r2, dst].forEach(r => F.DestroyRegion(r));
            done();
        });
    });

    it('SubtractRegion computes the difference', (t, done) => {
        const r1 = createRegion([{ x: 0, y: 0, width: 10, height: 10 }]);
        const r2 = createRegion([{ x: 0, y: 5, width: 10, height: 10 }]);
        const dst = createRegion([]);
        F.SubtractRegion(r1, r2, dst);
        F.FetchRegion(dst, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 0, y: 0, width: 10, height: 5 }]);
            [r1, r2, dst].forEach(r => F.DestroyRegion(r));
            done();
        });
    });

    it('InvertRegion inverts within bounds', (t, done) => {
        const src = createRegion([{ x: 0, y: 0, width: 10, height: 20 }]);
        const dst = createRegion([]);
        F.InvertRegion(src, { x: 0, y: 0, width: 20, height: 20 }, dst);
        F.FetchRegion(dst, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 10, y: 0, width: 10, height: 20 }]);
            F.DestroyRegion(src);
            F.DestroyRegion(dst);
            done();
        });
    });

    it('ExpandRegion grows every rectangle', (t, done) => {
        const region = createRegion([{ x: 10, y: 10, width: 5, height: 5 }]);
        F.ExpandRegion(region, region, 1, 2, 3, 4);
        F.FetchRegion(region, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.extents, { x: 9, y: 7, width: 8, height: 12 });
            F.DestroyRegion(region);
            done();
        });
    });

    it('RegionExtents reduces a region to its bounding box', (t, done) => {
        const src = createRegion([
            { x: 0, y: 0, width: 5, height: 5 },
            { x: 20, y: 20, width: 5, height: 5 }
        ]);
        const dst = createRegion([]);
        F.RegionExtents(src, dst);
        F.FetchRegion(dst, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 0, y: 0, width: 25, height: 25 }]);
            F.DestroyRegion(src);
            F.DestroyRegion(dst);
            done();
        });
    });

    it('CreateRegionFromBitmap picks up the set bits of a depth-1 pixmap', (t, done) => {
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
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 2, y: 3, width: 4, height: 5 }]);
            F.DestroyRegion(region);
            X.FreeGC(gc);
            X.FreePixmap(pix);
            done();
        });
    });

    it('SetGCClipRegion / CreateRegionFromGC round-trip', (t, done) => {
        const gc = X.AllocID();
        X.CreateGC(gc, root);
        const clip = createRegion([{ x: 2, y: 3, width: 4, height: 5 }]);
        F.SetGCClipRegion(gc, clip, 0, 0);
        const region = X.AllocID();
        F.CreateRegionFromGC(region, gc);
        F.FetchRegion(region, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 2, y: 3, width: 4, height: 5 }]);
            F.SetGCClipRegion(gc, 0, 0, 0); // None: remove the clip again
            F.DestroyRegion(region);
            F.DestroyRegion(clip);
            X.FreeGC(gc);
            assertNoErrors(done);
        });
    });

    it('SetWindowShapeRegion / CreateRegionFromWindow round-trip', (t, done) => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 32, 32);
        const shape = createRegion([{ x: 0, y: 0, width: 8, height: 8 }]);
        F.SetWindowShapeRegion(wid, F.WindowRegionKind.Bounding, 0, 0, shape);
        const region = X.AllocID();
        F.CreateRegionFromWindow(region, wid, F.WindowRegionKind.Bounding);
        F.FetchRegion(region, (err, reg) => {
            assert.ifError(err);
            assert.deepStrictEqual(reg.rectangles, [{ x: 0, y: 0, width: 8, height: 8 }]);
            F.SetWindowShapeRegion(wid, F.WindowRegionKind.Bounding, 0, 0, 0); // None
            F.DestroyRegion(region);
            F.DestroyRegion(shape);
            X.DestroyWindow(wid);
            assertNoErrors(done);
        });
    });

    it('SetPictureClipRegion / CreateRegionFromPicture round-trip', (t, done) => {
        X.require('render', (err, Render) => {
            assert.ifError(err);
            const wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, 32, 32);
            const pict = X.AllocID();
            Render.CreatePicture(pict, wid, Render.rgb24);
            const clip = createRegion([{ x: 1, y: 1, width: 6, height: 7 }]);
            F.SetPictureClipRegion(pict, clip, 0, 0);
            const region = X.AllocID();
            F.CreateRegionFromPicture(region, pict);
            F.FetchRegion(region, (err, reg) => {
                assert.ifError(err);
                assert.deepStrictEqual(reg.rectangles, [{ x: 1, y: 1, width: 6, height: 7 }]);
                F.DestroyRegion(region);
                F.DestroyRegion(clip);
                Render.FreePicture(pict);
                X.DestroyWindow(wid);
                done();
            });
        });
    });

    it('SetCursorName / GetCursorName round-trip', (t, done) => {
        const cid = createGlyphCursor(68);
        F.SetCursorName(cid, 'node-x11-test-cursor');
        F.GetCursorName(cid, (err, res) => {
            assert.ifError(err);
            assert.strictEqual(res.name, 'node-x11-test-cursor');
            assert.ok(res.atom > 0);
            X.FreeCursor(cid);
            done();
        });
    });

    it('GetCursorImage returns the current cursor image', (t, done) => {
        F.GetCursorImage((err, img) => {
            assert.ifError(err);
            assert.ok(img.width > 0);
            assert.ok(img.height > 0);
            assert.strictEqual(img.cursorImage.length, img.width * img.height * 4);
            done();
        });
    });

    it('GetCursorImageAndName reports the displayed cursor name; CursorNotify fires', (t, done) => {
        const cid = createGlyphCursor(58);
        F.SetCursorName(cid, 'node-x11-displayed-cursor');
        let sawCursorNotify = false;
        const listener = ev => {
            if (ev.name === 'CursorNotify') {
                assert.strictEqual(ev.subtype, F.CursorNotify.DisplayCursor);
                sawCursorNotify = true;
            }
        };
        X.on('event', listener);
        F.SelectCursorInput(root, F.CursorNotifyMask.DisplayCursor);
        X.ChangeWindowAttributes(root, { cursor: cid });
        F.GetCursorImageAndName((err, img) => {
            assert.ifError(err);
            assert.strictEqual(img.cursorName, 'node-x11-displayed-cursor');
            assert.ok(img.cursorAtom > 0);
            assert.strictEqual(img.cursorImage.length, img.width * img.height * 4);
            assert.strictEqual(sawCursorNotify, true);
            // restore global state: default cursor, no cursor input events
            F.SelectCursorInput(root, 0);
            X.ChangeWindowAttributes(root, { cursor: 0 });
            X.removeListener('event', listener);
            X.FreeCursor(cid);
            assertNoErrors(done);
        });
    });

    it('ChangeCursor and ChangeCursorByName update cursor contents', (t, done) => {
        const named = createGlyphCursor(68);
        const src1 = createGlyphCursor(58);
        const src2 = createGlyphCursor(130);
        F.SetCursorName(named, 'node-x11-change-target');
        F.ChangeCursor(src1, named);
        F.ChangeCursorByName(src2, 'node-x11-change-target');
        [named, src1, src2].forEach(c => X.FreeCursor(c));
        assertNoErrors(done);
    });

    it('HideCursor / ShowCursor are accepted', (t, done) => {
        F.HideCursor(root);
        F.ShowCursor(root);
        assertNoErrors(done);
    });

    it('CreatePointerBarrier / DeletePointerBarrier are accepted', (t, done) => {
        const barrier = X.AllocID();
        F.CreatePointerBarrier(barrier, root, 20, 0, 20, 100, F.BarrierDirections.PositiveX);
        F.DeletePointerBarrier(barrier);
        assertNoErrors(done);
    });

    it('SelectSelectionInput delivers SelectionNotify on SetSelectionOwner', (t, done) => {
        const wid = X.AllocID();
        X.CreateWindow(wid, root, 0, 0, 1, 1);
        X.InternAtom(false, 'NODE_X11_FIXES_TEST_SELECTION', (err, selAtom) => {
            assert.ifError(err);
            const listener = ev => {
                if (ev.name !== 'SelectionNotify')
                    return;
                assert.strictEqual(ev.subtype, F.SelectionEvent.SetSelectionOwner);
                assert.strictEqual(ev.window, wid);
                assert.strictEqual(ev.owner, wid);
                assert.strictEqual(ev.selection, selAtom);
                assert.ok(ev.timestamp > 0);
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

    it('ChangeSaveSet accepts a window of another client', (t, done) => {
        const client2 = x11.createClient((err, dpy2) => {
            assert.ifError(err);
            const X2 = dpy2.client;
            const wid2 = X2.AllocID();
            X2.CreateWindow(wid2, dpy2.screen[0].root, 0, 0, 1, 1);
            X2.GetGeometry(wid2, err => {   // sync client2 so wid2 exists server-side
                assert.ifError(err);
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
