# XFIXES extension

A grab bag of protocol fixes: server-side region objects and region
arithmetic, cursor image/name access and cursor change notification,
selection owner tracking, save-set extensions, show/hide cursor, and pointer
barriers. Regions created here are used by DAMAGE
([ext/damage.md](damage.md)), Composite ([ext/composite.md](composite.md)),
and RENDER ([ext/render.md](render.md)).

- Module: `X.require('fixes', cb)` (X name `XFIXES`, version 5.0)
- Source: [`lib/ext/fixes.js`](../../lib/ext/fixes.js) ·
  Tests: [`test/fixes.js`](../../test/fixes.js)
- Spec: [fixesproto.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/fixesproto/fixesproto.txt)

```js
X.require('fixes', (err, Fixes) => {
    const region = X.AllocID();
    Fixes.CreateRegion(region, [{ x: 10, y: 10, width: 40, height: 20 }]);
    Fixes.FetchRegion(region, (err, reg) => {
        // reg.extents   -> { x: 10, y: 10, width: 40, height: 20 }
        // reg.rectangles -> [{ x: 10, y: 10, width: 40, height: 20 }]
        Fixes.DestroyRegion(region);
    });
});
```

The version is negotiated automatically while requiring (the module asks for
5.0); it is available as `Fixes.major` / `Fixes.minor`.

Rectangles are passed and returned as `{x, y, width, height}` objects
(`x`/`y` signed, `width`/`height` unsigned). Region arguments are XIDs from
`X.AllocID()`; `0` means `None` where noted.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Opcode 0. Negotiates the protocol version. `cb(err, [major, minor])` — the
version the server will speak. Called automatically by `X.require` with 5.0.

### ChangeSaveSet(window, mode, target, map)
Opcode 1. Extended save-set control for `window` (a window of another
client). `mode` from `Fixes.SaveSetMode` (`Insert: 0`, `Delete: 1`), `target`
from `Fixes.SaveSetTarget` (`Nearest: 0`, `Root: 1`) — where the window is
reparented when this client dies, `map` from `Fixes.SaveSetMap` (`Map: 0`,
`Unmap: 1`). No reply.

### SelectSelectionInput(window, selection, eventMask)
Opcode 2. Selects `SelectionNotify` event delivery to `window` for the
`selection` atom. `eventMask` is a bitwise OR of `Fixes.SelectionEventMask`
(`SetSelectionOwner: 1`, `SelectionWindowDestroy: 2`,
`SelectionClientClose: 4`); `0` deselects. No reply.

### SelectCursorInput(window, eventMask)
Opcode 3. Selects `CursorNotify` event delivery to `window`. `eventMask` is
`Fixes.CursorNotifyMask.DisplayCursor` (1) or `0` to deselect. No reply.

### GetCursorImage(cb)
Opcode 4. `cb(err, image)` — the image of the cursor currently displayed:
`{x, y, width, height, xhot, yhot, cursorSerial, cursorImage}` where `x`/`y`
is the pointer position, `xhot`/`yhot` the hotspot, and `cursorImage` a
Buffer of `width * height` packed ARGB32 pixels with premultiplied alpha.

### CreateRegion(region, rects)
Opcode 5. Creates `region` (a client-allocated XID) as the union of `rects`,
an array of `{x, y, width, height}` (may be empty). No reply.

### CreateRegionFromBitmap(region, bitmap)
Opcode 6. Creates `region` containing the set bits of `bitmap`, a depth-1
pixmap. No reply.

### CreateRegionFromWindow(region, wid, kind)
Opcode 7. Creates `region` from the shape of window `wid`; `kind` from
`Fixes.WindowRegionKind` (`Bounding: 0`, `Clip: 1`). The region is a copy —
later shape changes do not affect it. No reply.

### CreateRegionFromGC(region, gc)
Opcode 8. Creates `region` from the clip list of `gc` (a copy). No reply.

### CreateRegionFromPicture(region, picture)
Opcode 9. Creates `region` from the clip list of a RENDER `picture`
(a copy; see [ext/render.md](render.md)). No reply.

### DestroyRegion(region)
Opcode 10. Destroys `region`. No reply.

### SetRegion(region, rects)
Opcode 11. Replaces the contents of `region` with the union of `rects`
(array of `{x, y, width, height}`). No reply.

### CopyRegion(src, dst)
Opcode 12. Replaces the contents of region `dst` with region `src`.
No reply.

### UnionRegion(src1, src2, dst)
Opcode 13. `dst = src1 ∪ src2`. All three are existing regions; `dst` may be
one of the sources. No reply.

### IntersectRegion(src1, src2, dst)
Opcode 14. `dst = src1 ∩ src2`. No reply.

### SubtractRegion(src1, src2, dst)
Opcode 15. `dst = src1 - src2`. No reply.

### InvertRegion(src, bounds, dst)
Opcode 16. `dst = bounds - src`, where `bounds` is a single
`{x, y, width, height}` rectangle. No reply.

### TranslateRegion(region, dx, dy)
Opcode 17. Moves `region` in place by the signed offsets `dx`, `dy`.
No reply.

### RegionExtents(src, dst)
Opcode 18. Replaces `dst` with the bounding box of `src`. No reply.

### FetchRegion(region, cb)
Opcode 19. `cb(err, reg)` — the contents of `region` as
`{extents, rectangles}`: `extents` is the bounding `{x, y, width, height}`
rectangle and `rectangles` an array of `{x, y, width, height}` covering the
region (YX-banded).

### SetGCClipRegion(gc, region, xOrigin, yOrigin)
Opcode 20. Sets the clip list of `gc` to `region` (a copy) with the given
clip origin. `region` `0` = `None` removes clipping. No reply.

### SetWindowShapeRegion(dest, destKind, xOffset, yOffset, region)
Opcode 21. Sets the shape of window `dest` to `region` (a copy) offset by
`xOffset`/`yOffset`. `destKind` from `Fixes.WindowRegionKind`; the SHAPE
extension's `Input` kind (2, [ext/shape.md](shape.md)) is also accepted by
servers with SHAPE 1.1. `region` `0` = `None` removes the shape. No reply.

### SetPictureClipRegion(picture, region, xOrigin, yOrigin)
Opcode 22. Sets the clip list of RENDER `picture` to `region` (a copy) with
the given clip origin. `region` `0` = `None`. No reply.

### SetCursorName(cursor, name)
Opcode 23. Labels `cursor` with `name` (a latin1 string; the server interns
it as an atom). No reply.

### GetCursorName(cursor, cb)
Opcode 24. `cb(err, {atom, name})` — the atom and string name of `cursor`
(`atom` 0 and empty `name` when unnamed).

### GetCursorImageAndName(cb)
Opcode 25. `cb(err, image)` — like `GetCursorImage` plus `cursorAtom` and
`cursorName` (string) of the displayed cursor.

### ChangeCursor(src, dst)
Opcode 26. Makes every use of cursor `dst` show the contents of cursor
`src`, then makes `dst` an alias for `src`. No reply.

### ChangeCursorByName(src, name)
Opcode 27. Like `ChangeCursor` for every cursor whose name matches the
latin1 string `name`. No reply.

### ExpandRegion(src, dst, left, right, top, bottom)
Opcode 28. Replaces `dst` with `src` where every rectangle is grown by the
given amounts in each direction. No reply.

### HideCursor(window)
Opcode 29. Hides the cursor while the pointer is inside `window` (or a
subwindow). Reference-counted per client; pair with `ShowCursor`. No reply.

### ShowCursor(window)
Opcode 30. Undoes one `HideCursor` on `window`. No reply.

### CreatePointerBarrier(barrier, window, x1, y1, x2, y2, directions, devices)
Opcode 31 (XFIXES 5.0). Creates pointer barrier `barrier` (a
client-allocated XID) on the screen of `window` along the line
(`x1`,`y1`)-(`x2`,`y2`) — the line must be axis-aligned. `directions` is a
bitwise OR of `Fixes.BarrierDirections` (`PositiveX: 1`, `PositiveY: 2`,
`NegativeX: 4`, `NegativeY: 8`) naming movement directions allowed *through*
the barrier; `0` blocks both. `devices` is an optional array of XInput2
device ids the barrier applies to (empty or omitted = all master pointers).
No reply.

### DeletePointerBarrier(barrier)
Opcode 32 (XFIXES 5.0). Destroys `barrier`. No reply.

## Events

### SelectionNotify
Delivered after `SelectSelectionInput` when selection ownership changes.
Fields: `type`, `seq`, `subtype` (`Fixes.SelectionEvent`:
`SetSelectionOwner: 0`, `SelectionWindowDestroy: 1`,
`SelectionClientClose: 2`), `window` (the selecting window), `owner` (new
owner window, 0 = None), `selection` (atom), `timestamp`,
`selectionTimestamp` (last-change time of the selection), `name`
(`'SelectionNotify'`).

### CursorNotify
Delivered after `SelectCursorInput` when the displayed cursor changes.
Fields: `type`, `seq`, `subtype` (`Fixes.CursorNotify.DisplayCursor` = 0),
`window`, `cursorSerial` (matches `cursorSerial` of `GetCursorImage`),
`timestamp`, `cursorName` (the name *atom*, not a string; 0 if unnamed),
`name` (`'CursorNotify'`).

## Notes

- Enums on the extension object: `SaveSetMode`, `SaveSetTarget`,
  `SaveSetMap`, `SelectionEvent`, `SelectionEventMask`, `CursorNotify`,
  `CursorNotifyMask`, `WindowRegionKind`, `BarrierDirections`, and
  `events = {SelectionNotify: 0, CursorNotify: 1}`.
- XFIXES 5 is implemented completely (opcodes 0–32), including the pointer
  barrier requests. XFIXES 6 (`SetClientDisconnectMode`,
  `GetClientDisconnectMode`) is not implemented.
- Region-returning requests never allocate ids server-side: the client picks
  every region XID with `X.AllocID()`, including destination regions of the
  arithmetic requests (create them first, e.g. `CreateRegion(dst, [])`).
- Rectangle format differs from the SHAPE extension: XFIXES uses
  `{x, y, width, height}` objects, SHAPE uses `[x, y, width, height]`
  arrays.
