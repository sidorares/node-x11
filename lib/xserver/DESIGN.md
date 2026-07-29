# JS X server — design

A pure-JavaScript X11 server that runs in node (for tests: driven by this
repo's own client) and in the browser (for the documentation site's live
demos: composited to a `<canvas>`, input from DOM events, GLX backed by
WebGL). Zero runtime dependencies, like the rest of the package.

## Layers

```
transport (net socket | streampair | MessagePort adapter)
        │  duplex stream: write() + 'data'/'end' events
        ▼
server core (this directory)          ← protocol parsing/marshalling,
        │                               resources, windows, events, exts
        ▼
Raster (raster.js)                    ← pure Uint32 pixel ops, no wire formats
        ▼
presentation (node: none/tests read pixels; browser: canvas compositor)
```

## Server core (`server.js`, entry `index.js`)

```js
const { createServer, XServer } = require('x11/lib/xserver');

const server = new XServer({ width: 800, height: 600 });
server.addClientStream(duplexStream);      // one per client connection
server.listen(displayNum);                 // node-only helper (lazy net), TCP 6000+n
// input injection (presentation layer calls these):
server.injectPointerMove(x, y);
server.injectButton(button, isPress);      // button 1-5
server.injectKey(keycode, isPress);        // X keycode (8-255)
// output:
server.on('damage', ({x, y, width, height}) => ...); // root composite changed
server.compose();                          // repaint root raster from window tree
server.root.raster                         // composited screen pixels (Uint32Array)
```

- One screen, TrueColor, `root_depth` 24, masks `0xff0000/0xff00/0xff`,
  32 bpp ZPixmap wire format, LSBFirst image byte order, scanline pad 32.
- Little-endian clients only (reject `B` byte-order handshakes with a
  connection setup failure — every JS runtime we target is LE).
- Resource IDs: allocate per-client `resource_base`/`resource_mask`; validate
  ownership/range; free everything on client disconnect.
- Sequence numbers per client, 16-bit wrap; errors/replies/events carry them
  per protocol.
- Windows keep a backing `Raster` each (simplifies Expose handling: we still
  send Expose events on map/resize per protocol, but contents survive).
  Pixmaps are plain rasters.
- `compose()` walks the mapped window tree painting backing rasters into the
  root raster (border color as 1px frame if border-width > 0), accumulates a
  damage rect, emits `'damage'`.
- Event delivery: per-window per-client event masks (`SelectInput` via
  CreateWindow/ChangeWindowAttributes), device event propagation up the
  ancestor chain, pointer/keyboard grabs (basic active grabs), focus (basic).
- Substructure redirect: a client holding `SubstructureRedirect` on a parent
  receives `MapRequest`/`ConfigureRequest`/`CirculateRequest` instead of the
  request taking effect, which is what lets a window manager run against this
  server headlessly. Redirection is skipped for override-redirect windows,
  for requests from the redirecting client itself, and for requests that
  would not change state (mapping an already-mapped window). Only one client
  at a time may select `SubstructureRedirect`/`ResizeRedirect` on a window —
  a second selector gets `BadAccess`, the way a WM discovers that another one
  is already running. `ChangeSaveSet` is still accepted-but-untracked, so a
  window manager exiting while it holds reparented clients is not modelled.
- Errors: correct error codes (BadWindow, BadValue, BadMatch, BadAtom,
  BadDrawable, BadAccess, BadAlloc, BadGC, BadIDChoice, BadName, BadLength,
  BadImplementation) with major/minor opcode fields.
- Unimplemented requests: reply with `BadImplementation` errors (or no-op
  where the protocol allows) — never crash, never desync framing. **Always
  consume the full request length before continuing.**

## Extension framework

```js
server.registerExtension(name, {
  eventsCount, errorsCount,
  init(server) {},                    // assigned major opcode
  handleRequest(client, minor, body)  // body = Buffer after 4-byte header
});
```

`QueryExtension` consults the registry; `ListExtensions` lists it. Built-in:
`BIG-REQUESTS` (the client enables it on connect by default) and `XC-MISC`.
GLX registers through the same hook from the browser bundle.

## RENDER compositing (`extensions/render.js`)

Pictures composite in premultiplied ARGB over the Uint32 rasters; the
pixel-model note at the top of the module says how each depth maps onto the
32-bit cell. One general loop (`compositeSpan`) covers everything — any
operator, transform, filter, repeat mode, mask and coverage — by sampling,
blending and writing one pixel at a time.

That loop is correct but costs six calls and two switches per pixel, and a
window repaint is a few hundred thousand pixels. So the spans a toolkit
actually emits are specialised, in `compositeSpanFast` and in
`FillRectangles`:

| span | what it becomes |
|---|---|
| constant source, depth-24 or a8 destination, operator with no destination term (Src, Clear, In, Out) | `TypedArray.fill` per span |
| constant source, any other operator or depth | per-pixel blend with the factors hoisted out where the operator allows |
| untransformed unfiltered blit, all texels inside the source, Src, matching depths | row copy (`set`) at depth 32, masked row copy at depth 24 and a8 |
| untransformed unfiltered blit, other operators | per-pixel blend with no sampler call |
| a8 to a8 blit | alpha-only loop; a copy for Src |
| source through a **direct a8 mask** (`compositeSpanMasked`) | mask read straight from its raster, source either constant or a matching blit |

**"Constant source" is not the same as "solid picture".** A toolkit
routinely expresses flat paint as a **1x1 pixmap with repeat** rather than
through `CreateSolidFill` — ntk does — and such a picture samples to the
same texel at every coordinate whatever the transform. `constantColorOf`
recognises both, and without it the constant-source paths almost never fire
on real drawing: in a react-x11 repaint every single masked composite was
falling through to the general loop for that one reason.

Coverage masks are the other thing worth knowing about. A toolkit draws
antialiased shapes and runs of text by rasterising coverage into an a8
picture and compositing paint through it, so a8 fills, a8 blits and
"source through an a8 mask" are three of the four biggest spans in a real
repaint. They were all excluded from the fast paths at first, and adding
them took the share of composited pixels on a specialised path from about
40% to **98.6%** — the remainder being the trapezoid coverage path.

Rows are painted as a list of `[start, end)` intervals: the whole row when
there is no clip, and the clip's spans for that row otherwise
(`clipRowSpans`). Clipped drawing therefore runs at fast-path speed instead
of being excluded from it, which matters because a toolkit clips constantly
— every overflow box, every rounded corner, every scrolling viewport. The
spans come out **merged and non-overlapping**: overlapping clip rectangles
would otherwise composite a pixel twice, which is invisible for Src and
wrong for every operator that is not idempotent. The sorted rectangle list
is cached on the picture and keyed by the clip array's identity, and every
assignment site replaces that array rather than mutating it.

A specialisation still bails out (returns false) whenever its other
preconditions do not hold — a mask, a coverage function, a transform, a
resampling filter, a source the region reaches outside of, an unusual depth
— and the general loop runs instead. That is why the preconditions are all
checked before the loop rather than inside it.

**These paths must be indistinguishable from the general loop.**
`test/xserver/render-fastpath.js` is what enforces it: every scenario runs
twice, once with `_setFastPaths(false)`, and the two destination rasters are
compared cell by cell. `scripts/bench-render.js` reports the throughput that
motivates them.

That equivalence check has one blind spot worth remembering: a scenario
where *neither* path is taken passes trivially. When adding a
specialisation, confirm it actually fires — a benchmark row that moves, or
the pixel-bucket counting described above — rather than trusting a green
suite.

## Raster contract (`raster.js`)

All drawing goes through `Raster` with a `gc` state object:

```js
{ func,        // GX function 0-15 (default copy)
  planeMask,   // default 0xffffffff
  foreground, background,       // pixel values
  lineWidth,   // 0/1 thin
  fillStyle,   // 0 solid (tiles/stipples: later)
  arcMode,     // 0 chord, 1 pie
  clip }       // null or [{x,y,width,height}] in drawable coords
```

Ops: `fillRect(s)`, `drawRects`, `drawPoints`, `drawLine(s)`, `drawSegments`,
`drawArcs`, `fillArcs`, `fillPoly`, `putPixels`, `putBitmap`, `getPixels`,
`copyArea`, `copyPlane`, `drawText` (built-in public-domain 8x8 font,
`font8x8.js`). The raster deals **only in Uint32 pixel values** — the server
core packs/unpacks ZPixmap/XYBitmap wire bytes.

Fonts: every font name opens the built-in 8x8 font (`QueryFont` reports its
metrics: 8 wide, ascent 7, descent 1, char range 0-127). Good enough for the
demos; a fuller font story can come later.

## Keyboard

Default US keymap table (keycodes 8-255, keysyms-per-keycode 2+) compatible
with the client's `keysyms.js`; `GetKeyboardMapping`/`GetModifierMapping`
serve it; browser presentation maps `KeyboardEvent.code` to X keycodes.

## Transports

- node tests: `streampair.js` (`createStreamPair()`), pass one side to
  `server.addClientStream`, the other to `createClient({ stream })`.
- node: `server.listen(n)` — real TCP for external clients.
- browser: MessagePort/postMessage adapter in the browser layer (`browser/`),
  registered on the client via `x11.registerDisplayProtocol()`.

## Testing

`test/xserver/*.js` (mocha, `npm run test:xserver`): each suite boots a
server + client over a stream pair — no real X server, no DISPLAY needed.
The existing client is the reference driver: handshake fields, window
lifecycle + events, properties/atoms, GetImage pixel verification of drawing
ops, input injection, error semantics, BIG-REQUESTS.
