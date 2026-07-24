# XTEST extension

Synthesizes keyboard, mouse and motion input as if it came from the real
devices, and provides cursor comparison plus grab immunity for test
harnesses and automation tools (this is what `xdotool` uses).

- Module: `X.require('xtest', cb)` (X name `XTEST`, version 2.2)
- Source: [`lib/ext/xtest.js`](../../lib/ext/xtest.js) ·
  Tests: [`test/xtest.js`](../../test/xtest.js)
- Spec: [xtest.pdf](http://www.x.org/releases/X11R7.6/doc/xextproto/xtest.pdf)

```js
X.require('xtest', (err, XTest) => {
    // move the pointer to absolute root coordinates (33, 44)
    XTest.FakeInput(XTest.MotionNotify, 0, 0, 0, 33, 44);
    // press and release keycode 38 ('a' on most layouts)
    XTest.FakeInput(XTest.KeyPress, 38, 0, 0, 0, 0);
    XTest.FakeInput(XTest.KeyRelease, 38, 0, 0, 0, 0);
});
```

## Requests

### GetVersion(clientMajor, clientMinor, cb)
`cb(err, [major, minor])` — the XTEST version the server implements. Not
called automatically.

### CompareCursor(window, cursor, cb)
Compares `cursor` against the cursor attribute of `window`.
`cb(err, same)` — boolean. `cursor` is a CURSOR XID, or `XTest.Cursor.None`
(0) to test that the window has no cursor, or `XTest.Cursor.Current` (1) to
compare against the cursor currently being displayed.

### FakeInput(type, detail, time, window, x, y)
Injects one input event. No reply. Arguments by event `type`:

- `XTest.KeyPress` / `XTest.KeyRelease` — `detail` is the keycode; pass 0
  for `window`, `x`, `y`.
- `XTest.ButtonPress` / `XTest.ButtonRelease` — `detail` is the button
  number.
- `XTest.MotionNotify` — `detail` 0 moves to absolute root coordinates
  `x`,`y`; non-zero moves relative. `window` names the root window of the
  screen to move on (0 = the screen the pointer is currently on).

`time` is a delay in milliseconds before the event is processed (0 =
CurrentTime, no delay).

### GrabControl(impervious)
When `impervious` is truthy, this client's requests keep executing even
while other clients hold a server grab. No reply. Always pair with a later
`GrabControl(false)` to return to normal behavior.

## Events / errors

None.

## Notes

- Constants on the extension object: `XTest.Cursor = {None: 0, Current: 1}`
  and the fake-event types `XTest.KeyPress = 2`, `XTest.KeyRelease = 3`,
  `XTest.ButtonPress = 4`, `XTest.ButtonRelease = 5`,
  `XTest.MotionNotify = 6` (these are the core event codes, reused as the
  `type` argument of `FakeInput`).
- No version is negotiated at require time; call `GetVersion` yourself if
  you need it.
- Fake events go through normal event processing: grabs, event masks and
  pointer barriers all apply, and `QueryPointer` immediately reflects a
  faked motion (see the test).
