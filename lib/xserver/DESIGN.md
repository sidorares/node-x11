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
