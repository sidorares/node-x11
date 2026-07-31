# Core protocol requests

Reference for all 120 requests of the X11 core protocol as implemented on the
client object (`X = display.client`, see [README.md](README.md) for connecting
and the general calling convention). Requests with a reply take a trailing
`cb(err, result)`; requests without one state "No reply." — they can be fired
and forgotten, or given a trailing `cb(err)` invoked exactly once: `null` on
success (confirmed via a sync round trip when necessary) or the X error the
request caused. Without a callback, errors are emitted as `'error'` on the
client with `err.seq` identifying the failing request. Source:
[`lib/corereqs.js`](../lib/corereqs.js); reply unpackers partly in
[`lib/generated/core-replies.js`](../lib/generated/core-replies.js). Tests:
[`test/core-*.js`](../test).

Unless noted otherwise, `wid`/`drawable`/`gc`/... arguments are X resource ids
(allocate with `X.AllocID()`), `time` arguments default to `0` (CurrentTime),
and coordinates are signed 16-bit pixels.

At connect time the client automatically performs the BIG-REQUESTS handshake
(unless `createClient({disableBigRequests: true}, …)`); the negotiated limit
is available as `display.max_request_length` (in 4-byte units). `PutImage` is
always encoded as a big request and therefore requires this handshake.

## Windows

### CreateWindow(wid, parent, x, y, width, height, borderWidth, depth, _class, visual, values)
Opcode 1. No reply. Creates (but does not map) a window. Arguments after
`height` are optional: `borderWidth`, `depth`, `_class` and `visual` default
to `0` (CopyFromParent; `_class` may be `x11.CopyFromParent`/`x11.InputOutput`
/`x11.InputOnly` = 0/1/2), `values` to `{}`. Accepted `values` keys:

| key | type |
|---|---|
| `backgroundPixmap`, `backgroundPixel`, `borderPixmap`, `borderPixel` | CARD32 |
| `bitGravity`, `winGravity` | CARD8 |
| `backingStore` | CARD8 (0 NotUseful, 1 WhenMapped, 2 Always) |
| `backingPlanes`, `backingPixel` | CARD32 |
| `overrideRedirect`, `saveUnder` | BOOL |
| `eventMask`, `doNotPropagateMask` | CARD32 mask (`x11.eventMask` bits) |
| `colormap`, `cursor` | XID |

```js
const wid = X.AllocID();
X.CreateWindow(wid, display.screen[0].root, 0, 0, 400, 300, 0, 0, 0, 0,
    { eventMask: x11.eventMask.Exposure | x11.eventMask.KeyPress });
X.MapWindow(wid);
```

### ChangeWindowAttributes(wid, values)
Opcode 2. No reply. `values` accepts the same keys as `CreateWindow` (the
implementation reuses the CreateWindow value-mask table).

### GetWindowAttributes(wid, cb)
Opcode 3. `cb(err, attrs)` — `{backingStore, visual, klass, bitGravity,
winGravity, backingPlanes, backingPixel, saveUnder, mapIsInstalled, mapState,
overrideRedirect, colormap, allEventMasks, myEventMasks, doNotPropagateMask}`.
`klass`: 1 InputOutput, 2 InputOnly; `mapState`: 0 Unmapped, 1 Unviewable,
2 Viewable.

### DestroyWindow(wid)
Opcode 4. No reply. Destroys the window and all its subwindows.

### DestroySubwindows(wid)
Opcode 5. No reply. Destroys all children of `wid`, bottom to top.

### ChangeSaveSet(isInsert, wid)
Opcode 6. No reply. Adds (`isInsert` truthy) or removes (falsy) another
client's window to/from this client's save-set.

### ReparentWindow(wid, newParentId, x, y)
Opcode 7. No reply. Re-parents `wid` into `newParentId` at `x`, `y`.

### MapWindow(wid)
Opcode 8. No reply.

### MapSubwindows(wid)
Opcode 9. No reply. Maps all children of `wid` in stacking order.

### UnmapWindow(wid)
Opcode 10. No reply.

### UnmapSubwindows(wid)
Opcode 11. No reply.

### ConfigureWindow(wid, options)
Opcode 12. No reply. `options` keys: `x`, `y` (INT16), `width`, `height`,
`borderWidth` (CARD16), `sibling` (window XID), `stackMode` (0 Above,
1 Below, 2 TopIf, 3 BottomIf, 4 Opposite). Convenience wrappers (same
opcode, not counted as separate requests):

- `X.MoveWindow(wid, x, y)`
- `X.ResizeWindow(wid, width, height)`
- `X.MoveResizeWindow(wid, x, y, width, height)`
- `X.RaiseWindow(wid)` / `X.LowerWindow(wid)`

### CirculateWindow(wid, direction)
Opcode 13. No reply. `direction`: 0 RaiseLowest, 1 LowerHighest. Circulates
the children of `wid`; generates CirculateNotify.

### GetGeometry(drawable, cb)
Opcode 14. `cb(err, geom)` — `{depth, windowid, xPos, yPos, width, height,
borderWidth}`. `windowid` is the root window of the drawable's screen.

### QueryTree(wid, cb)
Opcode 15. `cb(err, tree)` — `{root, parent, children}` where `children` is
an array of window ids in bottom-to-top stacking order.

## Properties & atoms

### InternAtom(returnOnlyIfExist, name, cb)
Opcode 16. `cb(err, atom)` — numeric atom id for the string `name`. Results
are cached in `X.atoms` / `X.atom_names` (pre-seeded with the standard
atoms, e.g. `X.atoms.WM_NAME`); a cache hit answers without a server round
trip.

### GetAtomName(atom, cb)
Opcode 17. `cb(err, name)` — atom name as a string. Cached like `InternAtom`.

### ChangeProperty(mode, wid, name, type, format, data)
Opcode 18. No reply. `mode`: 0 Replace, 1 Prepend, 2 Append. `name` and
`type` are atoms, `format` is 8, 16 or 32 (bits per element). `data` may be
a Buffer, an array of bytes, or a string (encoded latin1).

```js
X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'hello');
```

### DeleteProperty(wid, prop)
Opcode 19. No reply. `prop` is the property atom.

### GetProperty(del, wid, name, type, longOffset, longLength, cb)
Opcode 20. `cb(err, prop)` — `{type, format, bytesAfter, data}` with `data` a
Buffer (sliced to the actual value length) and `format` the 8/16/32 bits per
element the property was stored with — the only way to tell a `CARDINAL`
array of bytes from one of words. `longOffset`/`longLength` are in 4-byte
units; `bytesAfter` is non-zero when the value was truncated. A nonexistent
property yields `type` 0, `format` 0 and empty `data`. `del` truthy deletes
the property after reading.

[`examples/xprop.js`](../examples/xprop.js) dumps every property of a window
decoded, which is the fastest way to see what a request actually wrote.

### ListProperties(wid, cb)
Opcode 21. `cb(err, atoms)` — array of property atoms defined on the window.

### RotateProperties(wid, delta, atoms)
Opcode 114. No reply. Rotates the values of the listed property atoms by
`delta` positions.

## Selections

### SetSelectionOwner(owner, selection, time)
Opcode 22. No reply. `owner` is a window id (0 to release), `selection` an
atom; `time` optional (0 = CurrentTime).

### GetSelectionOwner(selection, cb)
Opcode 23. `cb(err, owner)` — owning window id, 0 if none.

### ConvertSelection(requestor, selection, target, property, time)
Opcode 24. No reply. Asks the selection owner to convert `selection` to
`target` and store it in `property` on `requestor`; results arrive as a
SelectionNotify event. `time` optional.

### SendEvent(destination, propagate, eventMask, eventRawData)
Opcode 25. No reply. Sends a synthetic event. `destination` is a window id
or `x11.PointerWindow` (0) / `x11.InputFocus` (1); `eventRawData` must be a
32-byte Buffer in wire format — the `rawData` property of a received event
works directly.

## Grabs & input control

### GrabPointer(wid, ownerEvents, mask, pointerMode, keybMode, confineTo, cursor, time, cb)
Opcode 26. `cb(err, status)` — 0 Success, 1 AlreadyGrabbed, 2 InvalidTime,
3 NotViewable, 4 Frozen. `mask` is a pointer event mask, `pointerMode`/
`keybMode`: 0 Synchronous, 1 Asynchronous; `confineTo` and `cursor` may be 0.

### UngrabPointer(time)
Opcode 27. No reply.

### GrabButton(wid, ownerEvents, mask, pointerMode, keybMode, confineTo, cursor, button, modifiers)
Opcode 28. No reply. Passive grab on `button` (0 = AnyButton) with
`modifiers` (0x8000 = AnyModifier).

### UngrabButton(wid, button, modifiers)
Opcode 29. No reply.

### ChangeActivePointerGrab(cursor, time, mask)
Opcode 30. No reply.

### GrabKeyboard(wid, ownerEvents, time, pointerMode, keybMode, cb)
Opcode 31. `cb(err, status)` — same status values as `GrabPointer`.

### UngrabKeyboard(time)
Opcode 32. No reply.

### GrabKey(wid, ownerEvents, modifiers, key, pointerMode, keybMode)
Opcode 33. No reply. Passive grab on keycode `key` (0 = AnyKey).

### UngrabKey(wid, key, modifiers)
Opcode 34. No reply.

### AllowEvents(mode, time)
Opcode 35. No reply. Releases events frozen by a synchronous grab. `mode`:
0 AsyncPointer, 1 SyncPointer, 2 ReplayPointer, 3 AsyncKeyboard,
4 SyncKeyboard, 5 ReplayKeyboard, 6 AsyncBoth, 7 SyncBoth.

### GrabServer()
Opcode 36. No reply. Disables processing of requests from other clients.

### UngrabServer()
Opcode 37. No reply.

### SetInputFocus(wid, revertTo)
Opcode 42. No reply. `revertTo`: 0 None, 1 PointerRoot, 2 Parent. The
protocol's time field is not exposed — the request is always sent with
CurrentTime.

### GetInputFocus(cb)
Opcode 43. `cb(err, focus)` — `{revertTo, focus}` where `focus` is the focus
window id (or 0 None / 1 PointerRoot). Commonly used as a cheap round-trip
barrier after reply-less requests.

## Pointer & keyboard queries

### QueryPointer(wid, cb)
Opcode 38. `cb(err, ptr)` — `{sameScreen, root, child, rootX, rootY, childX,
childY, keyMask}`. `keyMask` holds the button/modifier state bits.

### GetMotionEvents(wid, start, stop, cb)
Opcode 39. `cb(err, events)` — array of `{time, x, y}` from the server's
motion history between timestamps `start` and `stop` (0 = CurrentTime).

### TranslateCoordinates(srcWid, dstWid, srcX, srcY, cb)
Opcode 40. `cb(err, res)` — `{sameScreen, child, destX, destY}`.

### WarpPointer(srcWin, dstWin, srcX, srcY, srcWidth, srcHeight, dstX, dstY)
Opcode 41. No reply. Moves the pointer to `dstX`, `dstY` relative to
`dstWin` (or relative movement when `dstWin` is 0), subject to the source
rectangle check.

### QueryKeymap(cb)
Opcode 44. `cb(err, keys)` — 32-byte Buffer; bit `keycode & 7` of byte
`keycode >> 3` is set for each currently pressed key.

### ChangeKeyboardMapping(firstKeycode, keysymsPerKeycode, keysyms)
Opcode 100. No reply. `keysyms` is a flat array of
`keycodeCount * keysymsPerKeycode` keysyms; the keycode count is derived
from its length.

### GetKeyboardMapping(startCode, num, cb)
Opcode 101. `cb(err, rows)` — one array of keysyms (CARD32) per keycode,
`num` rows starting at keycode `startCode`.

### ChangeKeyboardControl(values)
Opcode 102. No reply. `values` keys: `keyClickPercent`, `bellPercent`
(INT8), `bellPitch`, `bellDuration` (INT16), `led`, `ledMode`, `key`,
`autoRepeatMode` (CARD8; autoRepeatMode 0 Off, 1 On, 2 Default).

### GetKeyboardControl(cb)
Opcode 103. `cb(err, control)` — `{globalAutoRepeat, ledMask,
keyClickPercent, bellPercent, bellPitch, bellDuration, autoRepeats}`;
`autoRepeats` is a 32-byte Buffer bitmap by keycode.

### Bell(percent)
Opcode 104. No reply. `percent` −100..100 relative to the base bell volume;
optional (defaults to 0).

### ChangePointerControl(accelNumerator, accelDenominator, threshold, doAcceleration, doThreshold)
Opcode 105. No reply. The two booleans select which of
acceleration/threshold to change.

### GetPointerControl(cb)
Opcode 106. `cb(err, control)` — `{accelNumerator, accelDenominator,
threshold}`.

### SetPointerMapping(map, cb)
Opcode 116. `cb(err, status)` — 0 Success, 1 Busy (a mapped button is
pressed). `map` is an array of button numbers, as returned by
`GetPointerMapping`.

### GetPointerMapping(cb)
Opcode 117. `cb(err, map)` — array of button numbers, one per physical
button.

### SetModifierMapping(rows, cb)
Opcode 118. `cb(err, status)` — 0 Success, 1 Busy, 2 Failed. `rows` is an
array of 8 keycode arrays (Shift, Lock, Control, Mod1–Mod5); shorter rows
are zero-padded to the longest.

### GetModifierMapping(cb)
Opcode 119. `cb(err, rows)` — 8 arrays of `keycodesPerModifier` keycodes
(0 entries mean unused slots).

## Drawing & GCs

### CreateGC(cid, drawable, values)
Opcode 55. No reply. Creates a graphics context. Accepted `values` keys
(also used by `ChangeGC` and as `CopyGC` component names):

| key | type |
|---|---|
| `function` | CARD8 raster op (constants in `x11.gcFunction`) |
| `planeMask`, `foreground`, `background` | CARD32 |
| `lineWidth` | CARD16 |
| `lineStyle`, `capStyle`, `joinStyle`, `fillStyle`, `fillRule` | CARD8 |
| `tile`, `stipple` | pixmap XID |
| `tileStippleXOrigin`, `tileStippleYOrigin` | INT16 |
| `font` | font XID |
| `subwindowMode`, `graphicsExposures` | CARD8 |
| `clipXOrigin`, `clipYOrigin` | INT16 |
| `clipMask` | pixmap XID |
| `dashOffset` | CARD16 |
| `dashes`, `arcMode` | CARD8 |

### ChangeGC(cid, values)
Opcode 56. No reply. Same `values` keys as `CreateGC`.

### CopyGC(srcGc, dstGc, components)
Opcode 57. No reply. `components` is either a CARD32 bitmask or an array of
`CreateGC` value names, e.g. `X.CopyGC(a, b, ['foreground', 'font'])`.

### SetDashes(gc, dashOffset, dashes)
Opcode 58. No reply. `dashes` is an array of dash lengths in pixels.

### SetClipRectangles(gc, ordering, clipXOrigin, clipYOrigin, rects)
Opcode 59. No reply. `ordering`: 0 UnSorted, 1 YSorted, 2 YXSorted,
3 YXBanded. `rects` is a flat array `[x, y, width, height, ...]`.

### FreeGC(gc)
Opcode 60. No reply.

### ClearArea(wid, x, y, width, height, exposures)
Opcode 61. No reply. Clears to the window background; `exposures` truthy
generates Expose events for the cleared area.

### CopyArea(srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height)
Opcode 62. No reply. Obscured/out-of-bounds source regions produce
GraphicsExposure (or NoExposure) events when `graphicsExposures` is set on
the GC.

### CopyPlane(srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height, bitPlane)
Opcode 63. No reply. `bitPlane` must have exactly one bit set; source pixels
are mapped through it to the GC foreground/background.

### PolyPoint(coordMode, drawable, gc, points)
Opcode 64. No reply. `coordMode`: 0 Origin, 1 Previous. `points` is a flat
array `[x, y, ...]`. Note that `coordMode` comes first, unlike the
`PolySegment`-style requests below.

### PolyLine(coordMode, drawable, gc, points)
Opcode 65. No reply. Same argument convention as `PolyPoint`.

### PolySegment(drawable, gc, segments)
Opcode 66. No reply. `segments` is a flat array `[x1, y1, x2, y2, ...]`,
four values per segment.

### PolyRectangle(drawable, gc, rects)
Opcode 67. No reply. Outlines only; `rects` flat `[x, y, width, height, ...]`.

### PolyArc(drawable, gc, arcs)
Opcode 68. No reply. `arcs` flat `[x, y, width, height, angle1, angle2, ...]`,
six values per arc, angles in 1/64 degree.

### FillPoly(drawable, gc, shape, coordMode, points)
Opcode 69. No reply. `shape`: 0 Complex, 1 Nonconvex, 2 Convex; `coordMode`:
0 Origin, 1 Previous; `points` flat `[x, y, ...]`.

### PolyFillRectangle(drawable, gc, rects)
Opcode 70. No reply. Filled rectangles, flat `[x, y, width, height, ...]`.

### PolyFillArc(drawable, gc, arcs)
Opcode 71. No reply. Filled arcs, same layout as `PolyArc`.

## Pixmaps & images

### CreatePixmap(pid, drawable, depth, width, height)
Opcode 53. No reply. `drawable` only selects the screen.

### FreePixmap(pixmap)
Opcode 54. No reply.

### PutImage(format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data)
Opcode 72. No reply. `format`: 0 Bitmap, 1 XYPixmap, 2 ZPixmap; `data` is a
Buffer in wire scanline layout. Always encoded as a BIG-REQUESTS packet, so
it only works after the automatic BigReq handshake (i.e. not with
`disableBigRequests`).

### GetImage(format, drawable, x, y, width, height, planeMask, cb)
Opcode 73. `cb(err, image)` — `{depth, visualId, data}` with `data` the raw
pixel Buffer. `visualId` is 0 for pixmaps.

## Colormaps & colors

Color values are 16-bit per channel (0–0xffff). RGB triples for cursors are
objects `{R, G, B}`; colormap requests take separate `red`, `green`, `blue`
arguments.

### CreateColormap(cmid, wid, vid, alloc)
Opcode 78. No reply. `wid` only selects the screen; `vid` is a visual id
supported by it. `alloc`: 0 None, 1 All.

### FreeColormap(cmap)
Opcode 79. No reply.

### CopyColormapAndFree(newCmid, srcCmap)
Opcode 80. No reply. Moves this client's allocations from `srcCmap` into a
new colormap `newCmid` and frees them in the source.

### InstallColormap(cmap)
Opcode 81. No reply.

### UninstallColormap(cmap)
Opcode 82. No reply.

### ListInstalledColormaps(wid, cb)
Opcode 83. `cb(err, cmaps)` — array of installed colormap ids for the screen
of `wid`.

### AllocColor(cmap, red, green, blue, cb)
Opcode 84. Allocates the closest color the colormap supports.
`cb(err, color)` — `{red, green, blue, pixel}` where `red`/`green`/`blue`
are the values actually allocated and `pixel` can be used directly in GC
values or `QueryColors`.

### AllocNamedColor(cmap, name, cb)
Opcode 85. `cb(err, color)` — `{pixel, exactRed, exactGreen, exactBlue,
visualRed, visualGreen, visualBlue}`.

### AllocColorCells(contiguous, cmap, colors, planes, cb)
Opcode 86. `cb(err, cells)` — `{pixels, masks}`, arrays of CARD32. Requires
a writable-class colormap (GrayScale/PseudoColor/DirectColor).

### AllocColorPlanes(contiguous, cmap, colors, reds, greens, blues, cb)
Opcode 87. `cb(err, res)` — `{redMask, greenMask, blueMask, pixels}`.

### FreeColors(cmap, planeMask, pixels)
Opcode 88. No reply. `pixels` is an array of pixel values.

### StoreColors(cmap, items)
Opcode 89. No reply. `items` is an array of `{pixel, red, green, blue,
doMask}`; omitted channels default to 0 and `doMask` (1 red | 2 green |
4 blue) defaults to 7 (all).

### StoreNamedColor(cmap, pixel, name, doMask)
Opcode 90. No reply. `doMask` optional, defaults to 7.

### QueryColors(cmap, pixels, cb)
Opcode 91. `cb(err, colors)` — array of `{red, green, blue}` in the order of
`pixels`.

### LookupColor(cmap, name, cb)
Opcode 92. `cb(err, color)` — `{exactRed, exactGreen, exactBlue, visualRed,
visualGreen, visualBlue}`.

## Fonts & text

Text-drawing requests are grouped here with the font requests; the 16-bit
variants encode JS strings as big-endian CHAR2B via `charCodeAt`, so plain
BMP unicode strings work when the font has the glyphs.

### OpenFont(fid, name)
Opcode 45. No reply. `name` is a core font name/alias, e.g. `'fixed'` or an
XLFD pattern.

### CloseFont(fid)
Opcode 46. No reply.

### QueryFont(fontable, cb)
Opcode 47. `cb(err, font)` — `{minBounds, maxBounds, minCharOrByte2,
maxCharOrByte2, defaultChar, drawDirection, minByte1, maxByte1,
allCharsExist, fontAscent, fontDescent, properties, charInfos}`.
`minBounds`/`maxBounds` and each `charInfos` entry are CHARINFO objects
`{leftSideBearing, rightSideBearing, characterWidth, ascent, descent,
attributes}`; `properties` is an array of `{name, value}` (name is an atom).

### QueryTextExtents(fontable, str, cb)
Opcode 48. `cb(err, extents)` — `{drawDirection, fontAscent, fontDescent,
overallAscent, overallDescent, overallWidth, overallLeft, overallRight}`.
`str` is sent as STRING16.

### ListFonts(pattern, max, cb)
Opcode 49. `cb(err, names)` — array of up to `max` font name strings
matching `pattern` (`*`/`?` wildcards).

### ListFontsWithInfo(pattern, max, cb)
Opcode 50. `cb(err, fonts)` — array of font-info objects: the `QueryFont`
header fields (no `charInfos`) plus `name` and `repliesHint`. On the wire
this is the core protocol's only multi-reply request — the server sends one
reply per font plus a terminator; the library collects the series and
invokes `cb` exactly once with the complete array.

### SetFontPath(paths)
Opcode 51. No reply. `paths` is an array of directory strings; the order
defines search priority.

### GetFontPath(cb)
Opcode 52. `cb(err, paths)` — array of directory strings.

### PolyText8(drawable, gc, x, y, items)
Opcode 74. No reply. `items` is an array of strings (each at most 254
chars); each string becomes one text item with delta 0. Font-shift items
and longer strings are not implemented (throws `Error('not supported yet')`).

### PolyText16(drawable, gc, x, y, items)
Opcode 75. No reply. STRING16 variant of `PolyText8`, same restrictions.

### ImageText8(drawable, gc, x, y, text)
Opcode 76. No reply. Draws `text` (latin1, max 255 chars) filling the
bounding box with the GC background first.

### ImageText16(drawable, gc, x, y, text)
Opcode 77. No reply. STRING16 variant of `ImageText8`.

## Cursors

`foreRGB`/`backRGB` are `{R, G, B}` objects with 16-bit channels.

### CreateCursor(cid, source, mask, foreRGB, backRGB, x, y)
Opcode 93. No reply. `source`/`mask` are depth-1 pixmaps; `x`, `y` is the
hotspot.

### CreateGlyphCursor(cid, sourceFont, maskFont, sourceChar, maskChar, foreRGB, backRGB)
Opcode 94. No reply. Builds a cursor from font glyphs — typically the
standard `'cursor'` font, where glyph N is the shape and N+1 its mask.

```js
const fid = X.AllocID();
X.OpenFont(fid, 'cursor');
const cid = X.AllocID();
X.CreateGlyphCursor(cid, fid, fid, 68, 69,   // XC_left_ptr + mask
    { R: 0, G: 0, B: 0 }, { R: 0xffff, G: 0xffff, B: 0xffff });
X.CloseFont(fid);
```

### FreeCursor(cursor)
Opcode 95. No reply.

### RecolorCursor(cursor, foreRGB, backRGB)
Opcode 96. No reply.

### QueryBestSize(_class, drawable, width, height, cb)
Opcode 97. `cb(err, size)` — `{width, height}`, the best supported size for
`_class`: 0 Cursor, 1 Tile, 2 Stipple.

## Screen saver & host access

### SetScreenSaver(timeout, interval, preferBlanking, allowExposures)
Opcode 107. No reply. `timeout`/`interval` in seconds (−1 restores the
default, 0 disables); `preferBlanking`/`allowExposures`: 0 No, 1 Yes,
2 Default.

### GetScreenSaver(cb)
Opcode 108. `cb(err, saver)` — `{timeout, interval, preferBlanking,
allowExposures}`.

### ChangeHosts(mode, family, address)
Opcode 109. No reply. `mode`: 0 Insert, 1 Delete; `family`: 0 Internet,
1 DECnet, 2 Chaos, 5 ServerInterpreted, 6 InternetV6; `address` a Buffer or
byte array (e.g. `[127, 0, 0, 2]`).

### ListHosts(cb)
Opcode 110. `cb(err, res)` — `{mode, hosts}` where `mode` is 1 when access
control is enabled and `hosts` is an array of `{family, address}` with
`address` a Buffer.

### SetAccessControl(mode)
Opcode 111. No reply. `mode`: 0 Disable, 1 Enable.

### SetCloseDownMode(mode)
Opcode 112. No reply. `mode`: 0 Destroy, 1 RetainPermanent,
2 RetainTemporary.

### KillClient(resource)
Opcode 113. No reply. Terminates the client owning `resource` (or closes
down retained resources for `resource` = 0 AllTemporary). Also available
under the historical alias `X.KillKlient`.

### ForceScreenSaver(activate)
Opcode 115. No reply. Truthy activates the screen saver, falsy resets it.

## Extensions & misc

### QueryExtension(name, cb)
Opcode 98. `cb(err, ext)` — `{present, majorOpcode, firstEvent,
firstError}`. Normally not called directly: `X.require(module, cb)` performs
it (and the extension setup) for you, see [README.md](README.md#extensions).

### ListExtensions(cb)
Opcode 99. `cb(err, names)` — array of extension name strings.

### NoOperation()
Opcode 127. No reply. Does nothing; useful as padding or a keep-alive.
