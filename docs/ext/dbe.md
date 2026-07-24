# DOUBLE-BUFFER (DBE) extension

Flicker-free drawing: associates a back buffer with a window, lets you render
into it with ordinary core drawing requests, then swaps it to the front in one
atomic operation.

- Module: `X.require('dbe', cb)` (X name `DOUBLE-BUFFER`, version 1.0)
- Source: [`lib/ext/dbe.js`](../../lib/ext/dbe.js) ·
  Tests: [`test/dbe.js`](../../test/dbe.js)
- Spec: [dbe.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/dbe.txt)

```js
X.require('dbe', (err, Dbe) => {
    const backBuf = X.AllocID();
    Dbe.AllocateBackBufferName(wid, backBuf, Dbe.SwapAction.Untouched);
    // the back buffer is a drawable: draw with core requests
    X.PolyFillRectangle(backBuf, gc, [0, 0, 100, 100]);
    Dbe.SwapBuffers([{ window: wid, swapAction: Dbe.SwapAction.Untouched }]);
});
```

The version is negotiated automatically while requiring (the spec requires
`GetVersion` before any other DBE request); it is available as `Dbe.major` /
`Dbe.minor`.

## Requests

### GetVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])`. Called
automatically by `X.require` with 1.0.

### AllocateBackBufferName(window, backBuffer, swapActionHint)
Associates `backBuffer` (a fresh XID from `X.AllocID()`) with the back buffer
of `window`. `swapActionHint` is a `Dbe.SwapAction` value hinting the swap
behavior the client intends to use. The back buffer is a drawable usable
with any core drawing request. No reply.

### DeallocateBackBufferName(backBuffer)
Frees the buffer name. The window stays double-buffered while other names
reference its back buffer. No reply.

### SwapBuffers(swapInfos)
`swapInfos` is an array of `{window, swapAction}` — swaps front and back
buffers of each listed window in one atomic request. `swapAction` (a
`Dbe.SwapAction` value) determines what the new back buffer contains
afterwards. No reply.

### BeginIdiom()
Marks the start of a request sequence the server may optimize as a unit.
Purely a hint. No reply.

### EndIdiom()
Ends the sequence started by `BeginIdiom`. No reply.

### GetVisualInfo(drawables, cb)
`drawables` is an array of screen specifiers (any drawable on each screen of
interest, e.g. root windows). `cb(err, screens)` — one entry per drawable,
each an array of `{visual, depth, perfLevel}` describing the double-buffer
capable visuals of that screen (higher `perfLevel` means better expected
performance).

### GetBackBufferAttributes(backBuffer, cb)
`cb(err, {window})` — the window the buffer name is attached to, or 0 (None)
if it has been deallocated or the window was destroyed.

## Events / errors

None.

## Notes

- `Dbe.SwapAction = {Undefined: 0, Background: 1, Untouched: 2, Copied: 3}`
  — the new back-buffer contents after a swap: undefined, cleared to the
  window background, left as-is (the old front buffer), or a copy of the old
  back buffer.
- Only the untouched front-buffer contents change on `SwapBuffers`; a
  `GetImage` on the window before and after a swap is the easiest way to
  verify it worked (see [`test/dbe.js`](../../test/dbe.js)).
