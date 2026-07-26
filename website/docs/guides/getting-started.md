---
title: Getting started
sidebar_position: 1
---

# Getting started

## Connecting

Everything starts with `x11.createClient`:

```js
const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client; // the request interface
  // ...
});
```

`createClient(options, callback)` accepts an optional first argument:

| option | meaning |
|---|---|
| `display` | display string, e.g. `':0'`, `'localhost:1.0'` or a literal socket path (default: `$DISPLAY`) |
| `debug` | log outgoing requests and capture per-request stack traces for errors |
| `disableBigRequests` | skip the automatic BIG-REQUESTS handshake done at connect time |
| `stream` | an already-connected duplex stream to use instead of opening a socket (see [Custom transports](custom-transports.md)) |
| `auth` | authentication override, `{ name, data }` (see [Custom transports](custom-transports.md)) |

The client connects over a unix socket when the display refers to the local
host (on macOS the display must be a literal socket path, XQuartz launchd
style, e.g. `/private/tmp/com.apple.launchd.../org.xquartz:0`), and over TCP
(port 6000 + display number) otherwise. `~/.Xauthority` (or `$XAUTHORITY`)
is consulted for authentication automatically.

`createClient` returns the client object immediately; subscribe to `'error'`
on it to catch connection-phase failures:

```js
const client = x11.createClient((err, display) => { /* ... */ });
client.on('error', err => console.error(err));
```

## The display object

The `display` passed to the callback describes the connection setup block
sent by the server:

- `display.client` — the `X` client object all requests are called on
- `display.screen[n]` — one entry per screen; each screen carries
  `root` (root window id), `white_pixel`, `black_pixel`,
  `pixel_width` / `pixel_height`, `mm_width` / `mm_height`,
  `default_colormap`, `root_depth`, `root_visual` and the list of supported
  `depths` with their visuals
- `display.vendor`, `display.release` — server identification
- `display.min_keycode` / `display.max_keycode`

Most programs only need the first screen:

```js
const screen = display.screen[0];
const root = screen.root;
const white = screen.white_pixel;
const black = screen.black_pixel;
```

## Making requests

All requests live on `X = display.client` and follow the Node callback style
— no promises. Requests with no reply take plain arguments; requests with a
reply take a trailing `callback(err, result)`:

```js
const wid = X.AllocID();                    // allocate a resource id
X.CreateWindow(wid, root, 10, 10, 400, 300); // no reply: fire and forget
X.MapWindow(wid);

X.InternAtom(false, 'WM_NAME', (err, atom) => { // with reply
  // ...
});
```

Resource ids (windows, pixmaps, GCs, …) are allocated client-side with
`X.AllocID()` and can be recycled with `X.ReleaseID(id)` once the resource
is destroyed. When you are done with the connection, call `X.terminate()`;
the client emits `'end'` when the stream closes.

## Error handling

X errors arrive asynchronously. Errors caused by a request with a reply are
routed to that request's callback as `err`; errors from reply-less requests
— and errors nobody claims — are emitted as `'error'` on the client:

```js
X.on('error', err => console.error(err.message, err.badParam));
```

With `createClient({ debug: true }, …)` each error also carries the stack
trace of the request that caused it.

See the [API reference overview](../reference/index.md) for the full
connection and error-handling details, and
[Core requests](../reference/core-requests.md) for every request signature.
