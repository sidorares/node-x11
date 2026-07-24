# Composite extension

Lets a client (typically a compositing window manager) redirect the rendering
of windows into off-screen storage, name that storage as a pixmap, and access
a special overlay window stacked above everything else. Usually used together
with DAMAGE ([ext/damage.md](damage.md)) to learn when the off-screen
contents change, and XFIXES ([ext/fixes.md](fixes.md)) for region arithmetic.

- Module: `X.require('composite', cb)` (X name `Composite`, version 0.4)
- Source: [`lib/ext/composite.js`](../../lib/ext/composite.js) ·
  Example: [`examples/smoketest/compositetest.js`](../../examples/smoketest/compositetest.js)
- Spec: [compositeproto.txt](http://cgit.freedesktop.org/xorg/proto/compositeproto/plain/compositeproto.txt)

```js
X.require('composite', (err, Composite) => {
    X.require('damage', (err, Damage) => {
        Composite.RedirectWindow(wid, Composite.Redirect.Automatic);
        const pixmap = X.AllocID();
        Composite.NameWindowPixmap(wid, pixmap);
        // pixmap now refers to the off-screen storage of wid;
        // use Damage.Create(damage, wid, ...) to hear about updates
    });
});
```

The version is negotiated automatically while requiring (the module asks for
0.4); it is available as `Composite.major` / `Composite.minor`.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])` — the version the
server will speak. Called automatically by `X.require` with 0.4.

### RedirectWindow(window, updateType)
Redirects the hierarchy rooted at `window` to off-screen storage.
`updateType` is one of `Composite.Redirect` (`Automatic: 0` — the server
keeps the screen updated itself, `Manual: 1` — the client paints).
No reply.

### RedirectSubwindows(window, updateType)
Like `RedirectWindow`, but redirects all current and future children of
`window` instead of the window itself. Compositing managers typically call
this on the root window. No reply.

### UnredirectWindow(window)
Terminates redirection of `window` started by this client with
`RedirectWindow`. No reply.

### UnredirectSubwindows(window)
Terminates redirection of the children of `window` started by this client
with `RedirectSubwindows`. No reply.

### CreateRegionFromBorderClip(region, window)
Initializes `region` (a client-allocated XFIXES region XID) with the border
clip of `window`, i.e. the part of the window not obscured by siblings or
ancestors. Operate on it with the XFIXES region requests
([ext/fixes.md](fixes.md)). No reply.

### NameWindowPixmap(window, pixmap)
Binds `pixmap` (a client-allocated XID) to the off-screen storage of the
redirected `window`. The pixmap keeps referring to that snapshot of storage
even after the window is resized (the server allocates new storage and the
name must be re-fetched). Use it like a regular pixmap, e.g. as a `CopyArea`
source. No reply.

### GetOverlayWindow(window, cb)
`cb(err, overlayWid)` — the XID of the composite overlay window of the screen
`window` is on. The overlay window is mapped above all other windows and is
untouched by the server; compositing output is drawn there. The server
reference-counts overlay users per client.

### ReleaseOverlayWindow(window)
Drops this client's reference to the overlay window of the screen `window` is
on; the overlay is unmapped when no clients use it. No reply.

## Events / errors

None.

## Notes

- `Composite.Redirect = {Automatic: 0, Manual: 1}`.
- The module negotiates version 0.4; the coordinate-origin translation
  requests of later protocol revisions are not implemented (a source comment
  marks the version for bumping once they are).
- Redirection is reference-counted by the server per window and per client;
  a second `Manual` redirect of the same window by another client fails with
  `BadAccess`.
