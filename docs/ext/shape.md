# SHAPE extension

Gives windows non-rectangular shapes. A window has three shapes: `Bounding`
(the visible outline), `Clip` (where the window may draw) and `Input` (where
it receives pointer events); each can be set from rectangles, a bitmap, or
another window's shape.

- Module: `X.require('shape', cb)` (X name `SHAPE`, version 1.1)
- Source: [`lib/ext/shape.js`](../../lib/ext/shape.js) ·
  Tests: [`test/shape.js`](../../test/shape.js)
- Spec: [shape.pdf](http://www.x.org/releases/X11R7.6/doc/xextproto/shape.pdf)

```js
X.require('shape', (err, Shape) => {
    // two 10x10 squares as the visible outline of wid
    Shape.Rectangles(Shape.Op.Set, Shape.Kind.Bounding, wid, 0, 0,
        [[0, 0, 10, 10], [20, 20, 10, 10]]);
    Shape.GetRectangles(wid, Shape.Kind.Bounding, (err, res) => {
        // res.ordering, res.rectangles -> [[x, y, width, height], ...]
    });
});
```

Unlike most extensions in this library, the version is *not* negotiated while
requiring: `Shape.major` / `Shape.minor` are undefined; call `QueryVersion`
yourself if you need the server's version.

Rectangles are `[x, y, width, height]` arrays (not objects — compare
[ext/fixes.md](fixes.md)).

## Requests

### QueryVersion(cb)
Opcode 0. `cb(err, [major, minor])` — the SHAPE version the server supports.
Takes no client version arguments.

### Rectangles(op, kind, window, x, y, rectangles, [ordering])
Opcode 1. Combines the union of `rectangles` (array of
`[x, y, width, height]`), offset by `x`/`y` from the window origin, with the
`kind` shape of `window` using operation `op` (see the enums under Notes).
`ordering` is a hint from `Shape.Ordering` describing how the rectangles are
sorted; defaults to `Shape.Ordering.Unsorted`. No reply.

### Mask(op, kind, window, x, y, bitmap)
Opcode 2. Like `Rectangles`, but takes the set bits of `bitmap` (a depth-1
pixmap XID, or `0` for `None` = remove the shape) as the source region.
No reply.

### Combine(op, destKind, srcKind, destWindow, x, y, srcWindow)
Opcode 3. Combines the `srcKind` shape of `srcWindow`, offset by `x`/`y`,
into the `destKind` shape of `destWindow` using `op`. No reply.

### Offset(kind, window, x, y)
Opcode 4. Moves the `kind` shape of `window` by the signed offsets `x`, `y`.
No reply.

### QueryExtents(window, cb)
Opcode 5. `cb(err, extents)` — `{boundingShaped, clipShaped, bounding,
clip}`: the two booleans tell whether a bounding/clip shape is set, and
`bounding`/`clip` are `{x, y, width, height}` extents rectangles (when no
shape is set, the full window geometry including/excluding the border).

### SelectInput(window, enable)
Opcode 6. Enables (`enable` = 1) or disables (0) `ShapeNotify` delivery for
`window` to this client. No reply.

### InputSelected(window, cb)
Opcode 7. `cb(err, enabled)` — `1` when this client has `ShapeNotify`
delivery selected on `window`, else `0`.

### GetRectangles(window, kind, cb)
Opcode 8. `cb(err, res)` — `{ordering, rectangles}`: the `kind` shape of
`window` as an array of `[x, y, width, height]` rectangles, and the
`Shape.Ordering` value the server reports for the list. When no such shape
is set, one rectangle covering the whole window is returned.

## Events

### ShapeNotify
Delivered after `SelectInput(window, 1)` whenever a shape of the window
changes. Parsed fields:

- `type` — event code
- `kind` — which shape changed (`Shape.Kind`)
- `seq` — sequence number
- `window` — the shaped window
- `x`, `y`, `width`, `height` — extents of the new shape
- `time` — server timestamp
- `shaped` — `1` when a shape is now set, `0` when it was removed
- `name` — `'ShapeNotify'`

## Notes

- Enums:
  `Shape.Kind = {Bounding: 0, Clip: 1, Input: 2}`,
  `Shape.Op = {Set: 0, Union: 1, Intersect: 2, Subtract: 3, Invert: 4}`,
  `Shape.Ordering = {Unsorted: 0, YSorted: 1, YXSorted: 2, YXBanded: 3}`,
  `Shape.events = {ShapeNotify: 0}`.
- The server may re-band rectangles: `GetRectangles` can return the same
  region as different (typically YXBanded) rectangles in a different order
  than they were set.
- `Input` shapes require SHAPE 1.1 (any current server). XFIXES regions can
  also be applied as window shapes via `Fixes.SetWindowShapeRegion`
  ([ext/fixes.md](fixes.md)).
