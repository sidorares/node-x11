# XINERAMA extension

Reports how multiple physical monitors are combined into one logical screen.
On servers where Xinerama is inactive (single head), the query requests still
work and report zero screens.

- Module: `X.require('xinerama', cb)` (X name `XINERAMA`, version 1.1)
- Source: [`lib/ext/xinerama.js`](../../lib/ext/xinerama.js) ·
  Tests: [`test/xinerama.js`](../../test/xinerama.js)
- Spec: [xinerama.txt](https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/blob/master/specs/xinerama/xinerama.txt)

```js
X.require('xinerama', (err, Xinerama) => {
    Xinerama.QueryScreens((err, screens) => {
        // [{x, y, width, height}, ...] — one entry per monitor
    });
});
```

The version is negotiated automatically while requiring; it is available as
`Xinerama.major` / `Xinerama.minor`.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])` — the version the
server will speak. Called automatically by `X.require`.

### GetState(window, cb)
`cb(err, state)` — `1` when Xinerama is active for the screen `window` is on,
else `0`.

### GetScreenCount(window, cb)
`cb(err, count)` — number of physical monitors composing the screen.

### GetScreenSize(window, screen, cb)
`cb(err, {width, height})` — size of monitor number `screen` (0-based).

### IsActive(cb)
`cb(err, state)` — non-zero when Xinerama is active. Prefer this over
`GetState` on modern servers.

### QueryScreens(cb)
`cb(err, screens)` — array of `{x, y, width, height}` monitor geometries in
screen coordinates. Empty when Xinerama is inactive.

## Events / errors

None.

## Notes

- On an inactive server (`IsActive` → 0) `QueryScreens` returns `[]`;
  RANDR ([ext/randr.md](randr.md)) is the modern interface to per-output
  geometry and is what most compositors use today.
