# RENDER extension

Client-side compositing: alpha-blended composition of "pictures" (drawables
plus a pixel format), solid fills, gradients, geometric rasterization
(triangles, trapezoids) and anti-aliased glyph rendering. This is the
foundation modern toolkits draw with instead of the core protocol.

- Module: `X.require('render', cb)` (X name `RENDER`)
- Source: [`lib/ext/render.js`](../../lib/ext/render.js) ·
  Tests: [`test/render.js`](../../test/render.js)
- Spec: [renderproto.txt](http://www.x.org/releases/X11R7.6/doc/renderproto/renderproto.txt)

```js
X.require('render', (err, Render) => {
    const pixmap = X.AllocID();
    X.CreatePixmap(pixmap, root, 24, 100, 100);
    const pic = X.AllocID();
    Render.CreatePicture(pic, pixmap, Render.rgb24);
    const grad = X.AllocID();
    Render.LinearGradient(grad, [0, 0], [100, 0],
        [[0, [1, 0, 0, 1]], [1, [0, 0, 1, 1]]]);       // red -> blue
    Render.Composite(Render.PictOp.Src, grad, 0, pic,
        0, 0, 0, 0, 0, 0, 100, 100);
});
```

While requiring, the module calls `QueryPictFormat`, keeps the whole reply as
`Render.pictFormats`, and scans it for the standard formats, exposing their
PICTFORMAT ids as properties:

- `Render.mono1` — 1-bit alpha (a1)
- `Render.rgb24` — 24-bit TrueColor without alpha (x8r8g8b8)
- `Render.rgba32` — 32-bit TrueColor with alpha (a8r8g8b8)
- `Render.a8` — 8-bit alpha-only

Those four cover the visuals a client picks for itself; for a visual chosen by
someone else, see `findVisualFormat` below.

Colors are given as `[r, g, b, a]` arrays of floats in 0..1 (clamped, scaled
to 16 bits per channel). Coordinates and matrix/filter values are JS numbers
converted to 16.16 FIXED (truncated to 1/65536 units) on the wire.

Two things about colors are easy to get wrong, and both fail quietly:

- **The range is 0..1, not 0..0xffff.** The client scales to 16 bits for you.
  A value above 1 is clamped, so a stop list written in 16-bit values
  (`[0xffff, 0, 0x3000, 0x8000]`) does not come out translucent — every
  component saturates and the stop is opaque. The client warns once per
  connection when this happens; set `Render.strictColors = true` to throw
  instead.
- **Colors are premultiplied by alpha**, as everywhere in RENDER. Each of
  `r`, `g`, `b` must be `<= a`. White at half alpha is `[0.5, 0.5, 0.5, 0.5]`,
  not `[1, 1, 1, 0.5]`, and a fully transparent stop is `[0, 0, 0, 0]`
  whatever color you were fading from. Out-of-gamut values are not rejected —
  they composite to something brighter than the alpha allows. Writing
  `const rgba = (r, g, b, a) => [r * a, g * a, b * a, a]` and calling that is
  the readable way to keep it straight; the examples do.

## Visual to format lookup

### findVisualFormat(visual)
Returns the PICTFORMAT id RENDER uses for `visual`, or `undefined` if RENDER
describes no format for it. Synchronous: it answers out of the screens section
of the `QueryPictFormat` reply cached while requiring the extension, so no
round trip and no callback. Visual ids are unique across screens, so the
screen the visual belongs to does not have to be named.

The case for it is a visual the client did not choose — a compositing manager
wrapping a redirected window's pixmap gets the window's visual id from
`GetWindowAttributes`, and the format that describes it is whatever the server
says, not what its depth suggests (depth 32 alone does not tell RGBA from
BGRA, and a 565 visual matches none of the standard formats):

```js
X.GetWindowAttributes(win, (err, attrs) => {
    const pic = X.AllocID();
    Render.CreatePicture(pic, pixmap, Render.findVisualFormat(attrs.visual));
});
```

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
`cb(err, [major, minor])`. Not called automatically — the extension object
carries no version fields unless you call this yourself.

### QueryPictFormat(cb) / QueryPictFormats(cb)
`cb(err, {formats, screens, subpixels})`. `QueryPictFormats` is a
protocol-name alias. Called automatically by `X.require`, which keeps the
reply as `Render.pictFormats`.

`formats` lists every picture format the server supports. Each entry is a
12-element array that also carries the same fields under names — `f[2]` and
`f.depth` are one field, not two, so old positional code keeps working:

```
[id, type, depth,
 redShift, redMask, greenShift, greenMask,
 blueShift, blueMask, alphaShift, alphaMask, colormap]
```

`type` is `Render.PictType.Direct` or `.Indexed`; `colormap` is a colormap id
or 0 (None). Shifts and masks describe the channel layout of a direct format:
the red channel of `x8r8g8b8` is `redShift: 16, redMask: 255`. Note the masks
are the mask *value*, not its width.

`screens` has one entry per screen, in the order of `display.screen`:

```js
{ fallback,                              // PICTFORMAT for drawables with no
  depths: [                              //   matching visual (e.g. pixmaps)
    { depth, visuals: [ { visual, format } ] }
  ] }
```

This is the mapping from a visual id to the format that describes it — use
`findVisualFormat` rather than walking it by hand. A visual the server cannot
composite (a rarely-supported depth) has no entry.

`subpixels` is one `Render.Subpixel` value per screen, the physical subpixel
order the screen reports for LCD glyph anti-aliasing. Servers older than
RENDER 0.6 send none, so the array can be shorter than `screens`.

### QueryPictIndexValues(pictformat, cb)
`cb(err, values)` — array of `{pixel, red, green, blue, alpha}`. Only valid
for indexed pictformats; on TrueColor-only servers (e.g. Xvfb) the server
answers with a Match error.

### CreatePicture(pid, drawable, pictformat, values)
Creates picture `pid` over `drawable` with the given pictformat. Optional
`values` object accepts: `repeat` (`Render.Repeat`), `alphaMap` (picture),
`alphaXOrigin`, `alphaYOrigin`, `clipXOrigin`, `clipYOrigin`, `clipMask`
(pixmap or 0), `graphicsExposures`, `subwindowMode`, `polyEdge`
(`Render.PolyEdge`), `polyMode` (`Render.PolyMode`), `dither` (atom),
`componentAlpha`. No reply.

### ChangePicture(pid, values)
Changes picture attributes; same `values` keys as `CreatePicture`, and any
key that is not `undefined` is sent (so 0 works, e.g. `{clipMask: 0}` resets
the clip). No reply.

### SetPictureClipRectangles(pid, clipXOrigin, clipYOrigin, rects)
Sets the clip list; `rects` is a flat array `[x1, y1, w1, h1, x2, y2, ...]`.
No reply.

### FreePicture(pid)
No reply.

### Composite(op, src, mask, dst, srcX, srcY, maskX, maskY, dstX, dstY, width, height)
The central operation: composites `src` (optionally through `mask`, 0 =
none) into `dst` with operator `op` (`Render.PictOp`). No reply.

### Trapezoids(op, src, srcX, srcY, dst, maskFormat, trapz)
Rasterizes trapezoids; `trapz` is a flat list of 10 values per trapezoid:
`top, bottom, leftX1, leftY1, leftX2, leftY2, rightX1, rightY1, rightX2,
rightY2` (floats, converted to FIXED). Deprecated by the Render spec in
favor of `Triangles`/`AddTraps`, but functional. No reply.

### Triangles(op, src, srcX, srcY, dst, maskFormat, tris)
Rasterizes triangles; `tris` is a flat array of vertex coordinates
`[x1, y1, x2, y2, x3, y3, ...]` (6 numbers per triangle, floats).
`maskFormat` is a pictformat or 0. No reply.

### TriStrip(op, src, srcX, srcY, dst, maskFormat, points)
Triangle strip; `points` is a flat array `[x1, y1, x2, y2, ...]`, each point
after the second adds a triangle. No reply.

### TriFan(op, src, srcX, srcY, dst, maskFormat, points)
Triangle fan; same `points` layout as `TriStrip`, first point shared by all
triangles. No reply.

### CreateGlyphSet(gsid, format)
Creates glyph set `gsid` whose glyphs use pictformat `format` (typically
`Render.a8` for anti-aliased or `Render.mono1` for bitmap glyphs). No reply.

### ReferenceGlyphSet(gsid, existing)
Makes `gsid` a new reference to the `existing` glyph set. No reply.

### FreeGlyphSet(gsid)
No reply.

### AddGlyphs(gsid, glyphs)
Uploads glyph images. Each glyph is
`{id, width, height, x, y, offX, offY, image}` where `image` is a Buffer of
`width * height` bytes (for a8), `x`/`y` place the origin relative to the
bitmap, and `offX`/`offY` (pen advance) are given in 1/64 pixel units —
divided by 64 before sending. Rows are re-padded to a 4-byte stride
automatically. No reply. Caveats: the passed glyph objects are mutated
(image/width/offX/offY rewritten), and the request always uses BIG-REQUESTS
length encoding, so it requires the default auto-enabled
[ext/big-requests.md](big-requests.md).

### AddGlyphsFromPicture(gsid, src, glyphs)
Copies glyphs from picture `src`; glyph entries additionally carry
`srcX`/`srcY`. No reply. As far as we know no X server implements this
request (expect a Bad Implementation error).

### FreeGlyphs(gsid, glyphIds)
Removes the glyphs with the given ids from the set. No reply. Freed glyphs
are silently skipped by later `CompositeGlyphs`.

### CompositeGlyphs8/16/32(op, src, dst, maskFormat, gsid, srcX, srcY, glyphs)
Draws glyph runs from glyph set `gsid` into `dst` (also callable as
`CompositeGlyphs(glyphBits, op, ...)` with `glyphBits` 8/16/32 selecting the
glyph index width). `glyphs` is an array whose entries are:

- `'string'` — glyph indices are the char codes, drawn at the current pen
  position (0,0 delta);
- `[dx, dy, 'string']` — pen moves by `dx`,`dy` before drawing;
- a number — switches to that glyph set for subsequent entries.

Strings are limited to 254 glyphs per entry (longer strings are not split
automatically). No reply.

### FillRectangles(op, pid, color, rects)
Fills rectangles with a solid `color` (`[r, g, b, a]` floats); `rects` is a
flat array `[x1, y1, w1, h1, ...]`. No reply.

### CreateCursor(cid, source, x, y)
Creates cursor `cid` from picture `source` — which must be an ARGB32
(`Render.rgba32`) picture — with hotspot `x`,`y`. No reply.

### SetPictureTransform(pid, matrix)
Sets the projective transform applied when `pid` is used as a source;
`matrix` is an array of exactly 9 numbers (3x3 row-major). Throws on wrong
length or non-number elements. No reply.

### QueryFilters(cb)
`cb(err, [aliases, filters])` — `filters` is an array of filter name
strings, `aliases` an array of CARD16 indices mapping each filter to the one
it aliases (0xffff = no alias). Always queries the first screen's root
drawable.

### SetPictureFilter(pid, name, filterParams)
Sets the source filter. Known names are validated client-side:
`'nearest'`/`'bilinear'`/`'fast'`/`'good'`/`'best'` (no parameters),
`'convolution'` (flat array `[w, h, elem1, ..., elemWxH]`), `'binomial'` and
`'gaussian'` (exactly 1 number). Any other name throws, so server-specific
filters reported by `QueryFilters` beyond this list cannot be set. No reply.

### CreateAnimCursor(cid, cursors)
Creates an animated cursor; `cursors` is an array of `[cursor, delayMs]`
pairs (or `{cursor, delay}` objects). No reply.

### AddTraps(pic, offX, offY, trapList)
Adds trapezoids to an alpha picture; `trapList` is a flat array of FIXED
values (6 per trap: top `l, r, y` then bottom `l, r, y`), offset by
`offX`,`offY`. No reply.

### CreateSolidFill(pid, r, g, b, a)
Creates a solid-fill source picture; channels are floats 0..1, premultiplied
by `a`. No reply.

### strictColors
Not a request — a flag on the extension object, default `false`. While false,
a colour component outside 0..1 (or `NaN`) is clamped and warned about once per
connection. Set it to `true` and the same component throws instead, which is
useful in tests and when porting code written against a client that took raw
16-bit values.

```js
Render.strictColors = true;
Render.FillRectangles(op, pic, [0xffff, 0, 0, 0xffff], rects); // throws
```

### LinearGradient(pid, p1, p2, stops) / CreateLinearGradient(...)
Creates a linear gradient source from point `p1` to `p2` (`[x, y]` arrays).
`stops` is an array of `[offset, [r, g, b, a]]` pairs, offsets 0..1
ascending. No reply. `CreateLinearGradient` is a protocol-name alias.

### RadialGradient(pid, p1, p2, r1, r2, stops) / CreateRadialGradient(...)
Radial gradient between the circle at `p1` with radius `r1` and the circle
at `p2` with radius `r2`; same `stops` format. No reply.

### ConicalGradient(pid, center, angle, stops) / CreateConicalGradient(...)
Conical gradient around `center` (`[x, y]`) starting at `angle` degrees;
same `stops` format. No reply.

## Events / errors

No events. Five extension errors get descriptive messages via registered
error parsers: PictFormat, Picture, PictOp, GlyphSet and Glyph ("...argument
does not name a defined ...").

## Notes

- Standard-format discovery happens once at require time; if a server lacks
  one of the standard formats the corresponding property (`mono1`, `rgb24`,
  `rgba32`, `a8`) is simply `undefined`.
- Enums attached to the extension object:
  - `Render.PictOp` — compositing operators: the PictOpClear..Saturate range
    (0..13), Disjoint\* (0x10..0x1b), Conjoint\* (0x20..0x2b) and the 0.11
    blend modes Multiply..HSLLuminosity (0x30..0x3e).
  - `Render.PolyEdge = {Sharp: 0, Smooth: 1}`,
    `Render.PolyMode = {Precise: 0, Imprecise: 1}`
  - `Render.PictType = {Indexed: 0, Direct: 1}`
  - `Render.Repeat = {None: 0, Normal: 1, Pad: 2, Reflect: 3}`
  - `Render.Subpixel = {Unknown: 0, HorizontalRGB: 1, HorizontalBGR: 2,
    VerticalRGB: 3, VerticalBGR: 4, None: 5}`
  - `Render.Filters = {Nearest: 'nearest', Bilinear: 'bilinear',
    Convolution: 'convolution', Fast: 'fast', Good: 'good', Best: 'best'}`
- FIXED conversion truncates toward zero (`parseInt(f * 65536)`), so tiny
  negative values round up.
