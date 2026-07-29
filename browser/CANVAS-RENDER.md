# Canvas-backed RENDER in the browser — findings

An investigation, not a shipped feature. The question: in the browser
build, can the JS X server implement RENDER by calling canvas 2D methods
instead of compositing pixels itself? A lot of RENDER maps onto canvas
almost exactly, so the mapping is not the hard part — the pixel storage is.

**Short answer: yes, and it is worth doing, but not as a drop-in for the
RENDER extension. It is a pixel-storage backend, all or nothing.** The
measurements below say where the win actually is, and it is not where the
software compositor was just optimised.

## What the numbers say

Megapixels per second for the same six spans. "software" is
`scripts/bench-render.js` before and after the fast-path work; "canvas 2D"
is the equivalent canvas calls, measured in headless Chrome with SwiftShader
(software rasterisation — a GPU-backed canvas would be faster still for
fills, and *slower* for readback).

| span | software, before | software, now | canvas 2D |
| --- | ---: | ---: | ---: |
| FillRectangles Src (opaque) | 49 | **8310** | 3933 |
| FillRectangles Over (alpha) | 48.7 | 65 | **7916** |
| Composite Src, untransformed | 27.7 | 793 | 842 |
| Composite Over, untransformed | 18 | 79.8 | **1552** |
| Composite Over, linear gradient | 15.7 | 17 | **365** |
| FillRectangles Src, 2 clip rects | 27.7 | 4420 | 5188 |
| `getImageData` of the region | — | — | 888 |

Three things fall out of this:

1. **Where the span reduces to a memset or a memcpy, JavaScript is already
   at the ceiling.** The optimised opaque fill beats canvas; the
   untransformed Src blit and the clipped fill tie it. Canvas has nothing
   to offer there any more.
2. **Everything that still blends per pixel is 20–120x off.** Alpha
   compositing and gradients are where a canvas backend would earn its
   keep, and they are what a real UI is made of — translucent panels, hover
   tints, gradient chrome. That gap is not going to close in JavaScript:
   those spans are irreducibly per-pixel, and canvas gets them from
   vectorised (or GPU) code the language cannot reach.
3. **Readback is affordable, which was the surprise.** 888 Mpx/s means
   pulling a whole 640x480 screen back out of a canvas costs about 0.35 ms.
   The assumption that a canvas backend would be sunk by `getImageData` on
   every frame does not survive the measurement. (On a GPU-backed canvas it
   would be worse; `willReadFrequently` exists for exactly this.)

## The mapping, which is the easy part

RENDER's operators are Porter-Duff, and so is `globalCompositeOperation`.
Thirteen of the fourteen are exact:

| PictOp | canvas | | PictOp | canvas |
| --- | --- | --- | --- | --- |
| Clear | `clearRect` | | OutReverse | `destination-out` |
| Src | `copy` | | Atop | `source-atop` |
| Dst | *(no-op)* | | AtopReverse | `destination-atop` |
| Over | `source-over` | | Xor | `xor` |
| OverReverse | `destination-over` | | Add | `lighter` |
| In | `source-in` | | Saturate | **none** |
| InReverse | `destination-in` | | | |
| Out | `source-out` | | | |

The rest lines up nearly as well:

| RENDER | canvas |
| --- | --- |
| `CreateLinearGradient` | `createLinearGradient` + `addColorStop` |
| `CreateRadialGradient` | `createRadialGradient` — the two-circle form the server already implements |
| `CreateConicalGradient` | `createConicGradient` |
| `FillRectangles` | `fillStyle` + `fillRect` |
| `Composite` | `drawImage` with source and destination rects |
| `SetPictureClipRectangles` | `beginPath` + `rect` xN + `clip` |
| `Trapezoids` / `Triangles` / `TriStrip` / `TriFan` | a path `fill`, antialiased |
| `CompositeGlyphs` | `drawImage` per glyph, or one atlas draw |
| repeat Normal | `createPattern(img, 'repeat')` |
| filter nearest / bilinear | `imageSmoothingEnabled` false / true |

And what does not map:

- **Saturate** has no canvas operator. Falls back to the software loop.
- **Projective transforms.** `SetPictureTransform` takes a full 3x3;
  `setTransform` is affine. A perspective matrix has to fall back.
- **Repeat Pad and Reflect.** `createPattern` has no equivalent.
- **Convolution filters.** No canvas equivalent worth the trouble.
- **Exact antialiasing.** The server's trapezoid coverage is four
  sub-bands per row with analytic horizontal coverage; canvas AA is
  implementation-defined. Output would be close but not identical, so the
  pixel-exact tests in `test/xserver/render.js` cannot be run against a
  canvas backend unchanged.

## Why it cannot be a drop-in extension

The blocker is not RENDER, it is everything around it.

The server stores pixels as `Uint32Array` rasters (`lib/xserver/raster.js`),
and **core drawing, `compose()`, `GetImage`, `PutImage`, `CopyArea` and the
GLX emulator's `notifySwap` all read and write those arrays directly**. A
canvas-backed Picture would have to synchronise with the array at every
boundary, and a per-operation round trip would cost more than it saves —
0.35 ms is cheap once a frame and ruinous once per composite.

There is a second, quieter problem: **canvas ImageData is straight alpha,
RENDER is premultiplied.** Canvas stores premultiplied internally and
un-premultiplies on `getImageData`, so a hybrid that moves pixels back and
forth loses low-alpha precision on every trip. Both problems point the same
way — the backend has to own the pixels end to end.

## The shape that would work

Make the *raster* pluggable rather than the extension:

```
Raster (Uint32Array)          <- node, and the default everywhere
CanvasRaster (OffscreenCanvas) <- browser opt-in
```

- `raster.js` grows a small interface — the ops in the "Raster contract"
  section of `lib/xserver/DESIGN.md` — and the browser build supplies a
  canvas-backed implementation of it.
- Every drawable (window, pixmap) allocates through the server's backend, so
  a Picture's target is a canvas from the start and RENDER can issue canvas
  calls without asking anyone's permission.
- `compose()` becomes `drawImage` per mapped window instead of a manual
  copy loop, and `CanvasPresenter` disappears: the root raster *is* the
  canvas already on the page, so the Uint32→RGBA conversion and the
  `putImageData` both go away.
- `GetImage` and `PutImage` are then the only readback points, which is
  where a round trip is genuinely unavoidable and also rare.
- Anything a canvas cannot express (Saturate, projective transforms, Pad and
  Reflect repeat, convolution) falls back by reading the region once,
  running the existing software loop, and writing it back. The general loop
  in `extensions/render.js` stays exactly as it is and becomes the
  correctness reference.

## Recommendation

Worth doing, and worth doing after the software fast paths rather than
instead of them — the fast paths are what makes the fallback path
acceptable, and they already close the gap on the two spans where canvas
had nothing to offer.

The order that keeps each step useful on its own:

1. Extract the raster interface in `raster.js` and route drawable
   allocation through the server, with the existing `Uint32Array` raster as
   the only implementation. No behaviour change; the whole test suite is the
   check.
2. Add `browser/canvas-raster.js` implementing that interface over
   `OffscreenCanvas`, opt-in per server, with the software loop as the
   documented fallback for the five unmappable cases.
3. Move `compose()` and the presenter onto it, which is where the frame-time
   win actually lands for a browser playground.

Step 1 is the one that needs care; steps 2 and 3 are mostly the mapping
table above. The correctness story has to change with it: the pixel-exact
RENDER tests stay on the software backend, and the canvas backend gets
tolerance-based tests plus the fast-path equivalence approach already used
in `test/xserver/render-fastpath.js`.
