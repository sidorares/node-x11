---
title: Windows & drawing
sidebar_position: 2
---

# Windows & drawing

## Creating a window

`CreateWindow` takes the new window id, the parent window, geometry, and a
few optional wire fields. Only the first six arguments are usually needed —
border width, depth, class and visual all default to "inherit from parent"
(`CopyFromParent`):

```js
const x11 = require('x11');

x11.createClient((err, display) => {
  const X = display.client;
  const wid = X.AllocID();
  X.CreateWindow(wid, display.screen[0].root, 100, 100, 400, 300);
  X.MapWindow(wid);
  X.on('error', err => { console.log(err); });
});
```

The full signature is
`CreateWindow(wid, parent, x, y, width, height, borderWidth, depth, class, visual, values)`.
The trailing `values` object sets window attributes at creation time — the
same set `ChangeWindowAttributes` accepts — for example:

```js
X.CreateWindow(wid, root, 0, 0, 500, 500, 0, 0, 0, 0, {
  backgroundPixel: display.screen[0].white_pixel,
  eventMask: x11.eventMask.Exposure | x11.eventMask.ButtonPress,
});
```

A window becomes visible only after `X.MapWindow(wid)`.

## Graphics contexts

All core drawing requests take a graphics context (GC) that carries pen
state: foreground/background pixels, line width, font, raster operation and
so on. Create one with `CreateGC(gc, drawable, values)`:

```js
const gc = X.AllocID();
X.CreateGC(gc, wid, {
  foreground: display.screen[0].black_pixel,
  background: display.screen[0].white_pixel,
});
```

GCs can be mutated later with `ChangeGC(gc, values)` and freed with
`FreeGC(gc)`.

## Drawing requests

Core drawing requests target any drawable (a window or a pixmap):

```js
X.on('event', ev => {
  if (ev.name === 'Expose') {
    X.PolyFillRectangle(wid, gc, [0, 0, 500, 500]); // x, y, w, h
    X.PolyLine(0, wid, gc, [10, 10, 100, 100, 10, 100]); // coordMode, points
    X.PolyText8(wid, gc, 50, 50, ['Hello, Node.JS!']);
  }
});
```

Draw from an `Expose` handler — the server does not preserve window contents
for you, and `Expose` tells you when (part of) the window needs repainting.

Pixmaps are off-screen drawables, useful for double buffering:

```js
const pixmap = X.AllocID();
X.CreatePixmap(pixmap, wid, depth, width, height);
// ... draw into the pixmap ...
X.CopyArea(pixmap, wid, gc, 0, 0, 0, 0, width, height);
```

The complete list of drawing requests — `PolyPoint`, `PolySegment`,
`PolyArc`, `FillPoly`, `PutImage`, `GetImage`, `CopyPlane` and friends — is
in the [core requests reference](../reference/core-requests.md).

## Anti-aliased drawing and gradients

The core protocol only does flat 1-bit-coverage drawing. For anti-aliasing,
alpha blending and gradients, load the [RENDER](../reference/ext/render.md)
extension. Abridged from `examples/simple/gradients.js`:

```js
X.require('render', (err, Render) => {
  const win = X.AllocID();
  X.CreateWindow(win, display.screen[0].root, 0, 0, 500, 500, 0, 0, 0, 0, {
    backgroundPixel: display.screen[0].white_pixel,
    eventMask: x11.eventMask.Exposure,
  });
  X.MapWindow(win);

  // a Picture wraps a drawable for use with RENDER
  const picture = X.AllocID();
  Render.CreatePicture(picture, win, Render.rgb24, { polyEdge: 1, polyMode: 0 });

  // gradients are Pictures too
  const gradient = X.AllocID();
  Render.LinearGradient(gradient, [0, 0], [1000, 100], [
    [0,    [0, 0, 0, 0x3000]],           // stop, [r, g, b, a] as 16-bit
    [0.25, [0xffff, 0, 0x0fff, 0x3000]],
    [1,    [0xffff, 0xffff, 0, 0x8000]],
  ]);

  X.on('event', () => {
    // composite the gradient onto the window (3 = PictOp Over)
    Render.Composite(3, gradient, 0, picture, 0, 0, 0, 0, 0, 0, 500, 500);
  });
});
```

`Render` also provides `RadialGradient`, `ConicalGradient`, `Triangles`,
`FillRectangles` and glyph rendering — see the
[RENDER reference](../reference/ext/render.md).
