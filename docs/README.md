# node-x11 documentation

`node-x11` is a pure-JavaScript X Window System protocol client for Node.js.
There is no native code and no runtime dependency: the library speaks the X11
wire protocol directly over a unix socket or TCP connection.

- [Core protocol requests](core-requests.md) — all 120 requests of the core protocol
- [Core protocol events](core-events.md) — all 34 core events
- [Extensions](#extensions) — one page per protocol extension, listed below

## Connecting

```js
const x11 = require('x11');

x11.createClient((err, display) => {
    if (err) throw err;
    const X = display.client;   // the request interface
    // ...
});
```

`createClient(options, callback)` accepts an optional first argument:

| option | meaning |
|---|---|
| `display` | display string, e.g. `':0'`, `'localhost:1.0'` or a literal socket path (default: `$DISPLAY`) |
| `debug` | log outgoing requests and capture per-request stack traces for errors |
| `disableBigRequests` | skip the automatic BIG-REQUESTS handshake done at connect time |

The client connects over a unix socket when the display refers to the local
host (on macOS the display must be a literal socket path, XQuartz launchd
style, e.g. `/private/tmp/com.apple.launchd.../org.xquartz:0`), and over TCP
(port 6000 + display number) otherwise. `~/.Xauthority` (or `$XAUTHORITY`) is
used for authentication automatically.

`createClient` returns the client object immediately; subscribe to `'error'`
on it to catch connection-phase failures.

### The display object

The `display` passed to the callback describes the connection setup block:

- `display.client` — the `X` client object all requests are called on
- `display.screen[n]` — one entry per screen, with `root` (root window id),
  `white_pixel`, `black_pixel`, `pixel_width`/`pixel_height`,
  `mm_width`/`mm_height`, `default_colormap`, `root_depth`, `depths`, …
- `display.min_keycode` / `display.max_keycode`

## Making requests

All requests live on `X = display.client` and follow the callback style —
no promises. Requests with a reply take a trailing `callback(err, result)`.
Requests with no reply ("void" requests) can be fired and forgotten, or given
a trailing `callback(err)` that fires exactly once: with `null` once the
server has processed the request without error, or with the X error it
caused (the client issues a cheap sync round trip when needed, the way
`xcb_request_check` does):

```js
const wid = X.AllocID();                       // allocate a resource id
X.CreateWindow(wid, display.screen[0].root,    // no reply: fire and forget
               10, 10, 400, 300);
X.MapWindow(wid);

X.InternAtom(false, 'WM_NAME', (err, atom) => { // with reply
    // ...
});

X.ChangeWindowAttributes(root, {                // void request, checked:
    eventMask: x11.eventMask.SubstructureRedirect
}, err => {
    // err === null   → the request succeeded (e.g. we are the WM now)
    // err instanceof Error → e.g. BadAccess: another WM is running
});
```

Resource ids (windows, pixmaps, GCs, …) are allocated client-side with
`X.AllocID()` and can be recycled with `X.ReleaseID(id)` once the resource is
destroyed. When you are done with the connection, call `X.terminate()`; the
client emits `'end'` when the stream closes.

See [core-requests.md](core-requests.md) for the complete reference.

## Flow control

Requests are buffered and written to the socket immediately, but the socket
may not keep up (mouse-driven redraws, full-speed rendering). Three tools
keep memory bounded:

- **Return value + `'drain'`.** Every request method returns `false` when
  the socket applied backpressure — same contract as `stream.Writable`'s
  `write()`. Stop producing and resume on the client's `'drain'` event:

  ```js
  function render() {
      let ok = true;
      while (ok && hasWork())
          ok = X.PolyFillRectangle(wid, gc, nextBatch());
      if (!ok)
          X.once('drain', render);   // resume when the socket caught up
  }
  ```

- **`X.flush([cb])`** — the callback fires once everything buffered so far
  has been handed to the OS. Returns a Promise when called without a
  callback.

- **`X.sync([cb])`** — a full round trip: the callback fires once the
  *server has processed* every request issued so far (the equivalent of
  `XSync`). Any errors those requests caused have been delivered by then.
  Returns a Promise when called without a callback. Pacing a render loop
  with `sync` throttles to what the server actually consumes:

  ```js
  function frame() {
      drawFrame(X, wid, gc);
      X.sync(() => frame());     // next frame only when this one is done
  }
  ```

Sequence numbers are 16-bit on the wire but full-width on the client
(`err.seq` keeps growing past 65535); the client transparently inserts a
cheap round-trip request once per 60000 reply-less requests to keep the
mapping unambiguous, the same way libxcb does.

## Listening for events

Select the events you want on a window — either at creation time or later —
using masks from `x11.eventMask`, then listen on the client:

```js
X.ChangeWindowAttributes(wid, {
    eventMask: x11.eventMask.Exposure | x11.eventMask.PointerMotion
});
X.on('event', ev => {
    if (ev.name === 'MotionNotify')
        console.log(ev.rootx, ev.rooty);
});
```

Every event object carries `name`, `type`, `seq` and the event-specific
fields; `ev.rawData` is the raw wire packet (useful with `SendEvent`).
Extension events are delivered through the same `'event'` emitter once the
extension has been initialised (its `requireExt` registers the parsers).
GenericEvents (X Generic Event Extension, used by Present and XInput 2) are
framed by their length field and dispatched to per-extension parsers
registered in `X.geEventParsers`.

See [core-events.md](core-events.md) for every core event and its fields.

## Error handling

X errors arrive asynchronously. Errors caused by a request issued with a
callback — whether it has a reply or not — are routed to that callback as
`err` (an `Error` with `error` code, `seq`, `badParam`,
`majorOpcode`/`minorOpcode`). Errors from requests issued without a
callback — and errors nobody claims — are emitted as `'error'` on the
client:

```js
X.on('error', err => console.error(err.message, err.badParam));
```

If a reply callback receives an error and returns `true`, the error is
considered handled and is not re-emitted on the client. With
`createClient({debug: true}, …)` each error also carries the stack trace of
the request that caused it.

## Extensions

Extensions are loaded at runtime with `X.require(name, cb)`. The callback
receives an extension object carrying the extension's requests, enums and
version info; any events are registered on the client automatically:

```js
X.require('randr', (err, Randr) => {
    if (err) throw err;              // extension missing on this server
    Randr.GetScreenResources(display.screen[0].root, (err, res) => {
        console.log(res.outputs);
    });
});
```

`name` is the module name below (the file in `lib/ext/`), not the on-the-wire
extension name. Requiring an extension twice returns the cached instance.

| module | X name | page |
|---|---|---|
| `apple-wm` | Apple-WM | [ext/apple-wm.md](ext/apple-wm.md) |
| `big-requests` | BIG-REQUESTS | [ext/big-requests.md](ext/big-requests.md) |
| `composite` | Composite | [ext/composite.md](ext/composite.md) |
| `damage` | DAMAGE | [ext/damage.md](ext/damage.md) |
| `dbe` | DOUBLE-BUFFER | [ext/dbe.md](ext/dbe.md) |
| `dpms` | DPMS | [ext/dpms.md](ext/dpms.md) |
| `fixes` | XFIXES | [ext/fixes.md](ext/fixes.md) |
| `ge` | Generic Event Extension | [ext/ge.md](ext/ge.md) |
| `glx` | GLX | [ext/glx.md](ext/glx.md) |
| `present` | Present | [ext/present.md](ext/present.md) |
| `randr` | RANDR | [ext/randr.md](ext/randr.md) |
| `record` | RECORD | [ext/record.md](ext/record.md) |
| `render` | RENDER | [ext/render.md](ext/render.md) |
| `res` | X-Resource | [ext/res.md](ext/res.md) |
| `screen-saver` | MIT-SCREEN-SAVER | [ext/screen-saver.md](ext/screen-saver.md) |
| `shape` | SHAPE | [ext/shape.md](ext/shape.md) |
| `shm` | MIT-SHM | [ext/shm.md](ext/shm.md) |
| `sync` | SYNC | [ext/sync.md](ext/sync.md) |
| `xc-misc` | XC-MISC | [ext/xc-misc.md](ext/xc-misc.md) |
| `xinerama` | XINERAMA | [ext/xinerama.md](ext/xinerama.md) |
| `xinput` | XInputExtension | [ext/xinput.md](ext/xinput.md) |
| `xkb` | XKEYBOARD | [ext/xkb.md](ext/xkb.md) |
| `xtest` | XTEST | [ext/xtest.md](ext/xtest.md) |
| `xv` | XVideo | [ext/xv.md](ext/xv.md) |

## Other exports

- `x11.eventMask` — event mask bit names
- `x11.keySyms` — keysym tables (lazy-loaded)
- `x11.gcFunction` — GC raster operation constants (lazy-loaded)
- `x11.createServer` — experimental X server implementation
- Window class constants `x11.CopyFromParent` / `x11.InputOutput` /
  `x11.InputOnly` and `SendEvent` destinations `x11.PointerWindow` /
  `x11.InputFocus`

## Diagnosing properties

Window properties are opaque to the X server: it stores whatever bytes you
give it, so a wrong `type`, a wrong `format` or a struct with the wrong flags
word produces no error at all — the window manager simply ignores the
property. When something "does not work", look at what actually landed on the
window:

```sh
node examples/xprop.js 0x400001    # or no argument for the root window
```

[`examples/xprop.js`](../examples/xprop.js) decodes each property by type,
prints `WM_NORMAL_HINTS`/`WM_HINTS` field by field with the flags word spelled
out (a flags word of `0` is a legal property that declares *nothing*, and is
indistinguishable from a correct one until you decode it), and names the
fields of `_NET_WM_STRUT`/`_NET_WM_STRUT_PARTIAL`.

It finishes by printing the root window's `_NET_WORKAREA` against the screen
size. That is the window manager's answer to a strut — if the workarea did not
shrink, the strut had no effect; if it did, the strut worked and the problem
is elsewhere. Note that these conventions (ICCCM/EWMH property *contents*) are
not implemented by this library — see
[ntk](https://github.com/sidorares/ntk) for writers.

## Running against a test server

The test suite runs against a private Xvfb: `npm run test:local` (see
`scripts/test-local.sh`). Runnable demos live in `examples/`.
