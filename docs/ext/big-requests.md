# BIG-REQUESTS extension

Raises the maximum request length from the core limit of 262140 bytes
(65535 4-byte units) to a server-advertised value in the megabytes, using an
extended length encoding. Needed for large image transfers and glyph
uploads.

- Module: `X.require('big-requests', cb)` (X name `BIG-REQUESTS`, version 2.0)
- Source: [`lib/ext/big-requests.js`](../../lib/ext/big-requests.js) ·
  Tests: no dedicated file — enabled implicitly at connect by every test
- Spec: [bigreq.html](http://www.x.org/releases/X11R7.6/doc/bigreqsproto/bigreq.html)

You normally never require this module yourself: `x11.createClient` enables
it automatically as part of connecting, unless you opt out:

```js
x11.createClient({ disableBigRequests: true }, (err, display) => {
    // display.max_request_length stays at the handshake value (65535)
});

x11.createClient((err, display) => {
    // BigReq enabled; typically 4194303 units (16 MiB) on Xorg/Xvfb
    console.log(display.max_request_length);
});
```

## Requests

### Enable(cb)
Switches this connection to the extended length encoding.
`cb(err, maxRequestLength)` — the new maximum request length in 4-byte
units. Called automatically at connect; `createClient` stores the result as
`display.max_request_length` (replacing the core handshake value) before
invoking your callback.

## Events / errors

None.

## Notes

- After `Enable`, requests may use the extended encoding: a core length
  field of 0 followed by a 32-bit length. Requests up to the core limit keep
  the classic encoding; only oversized ones need the extended form.
- Render's `AddGlyphs`/`AddGlyphsFromPicture`
  ([ext/render.md](render.md)) always emit the extended encoding, so they
  only work while BigReq is enabled (the default).
- With `disableBigRequests` the extension is not required at all — no
  `Enable` request is sent and the connection keeps the core 262140-byte
  limit.
