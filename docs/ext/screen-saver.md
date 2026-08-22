# MIT-SCREEN-SAVER extension

Lets a client find out about the state of the built-in screen saver, be
notified when it activates or cycles, provide its own saver window ("external
saver"), and temporarily suspend saver activation. Complements the core
`SetScreenSaver` / `GetScreenSaver` / `ForceScreenSaver` requests
([core-requests.md](../core-requests.md)).

- Module: `X.require('screen-saver', cb)` (X name `MIT-SCREEN-SAVER`,
  version 1.1)
- Source: [`lib/ext/screen-saver.js`](../../lib/ext/screen-saver.js) ·
  Tests: [`test/screen-saver.js`](../../test/screen-saver.js)
- Spec: [saver.pdf](http://www.x.org/releases/X11R7.6/doc/scrnsaverproto/saver.pdf)

```js
X.require('screen-saver', (err, Saver) => {
    Saver.QueryInfo(root, (err, info) => {
        // { state, window, until, idle, eventMask, kind }
    });
    Saver.SelectInput(root, Saver.eventMask.Notify);
    X.on('event', ev => {
        if (ev.name === 'ScreenSaverNotify')
            console.log('saver state', ev.state, 'forced', ev.forced);
    });
});
```

The version is negotiated automatically while requiring; it is available as
`Saver.major` / `Saver.minor`.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Opcode 0. Negotiates the protocol version. `cb(err, [major, minor])` — the
version the server will speak. Called automatically by `X.require` with 1.1.
The client version is sent as two single bytes (CARD8) per the wire
protocol.

### QueryInfo(drawable, cb)
Opcode 1. `cb(err, info)` — saver state for the screen of `drawable`:

- `state` — current `Saver.State` (`Off`, `On`, or `Disabled`)
- `window` — XID of the saver window (valid only while the saver is on)
- `until` — with state `Off`: milliseconds until the saver activates
  (0 = never); with state `On`: milliseconds until it cycles
- `idle` — milliseconds since the last user input
- `eventMask` — events this client has selected with `SelectInput`
- `kind` — `Saver.Kind` of the current/last saver (`Blanked`, `Internal`,
  `External`)

### SelectInput(drawable, eventMask)
Opcode 2. Selects `ScreenSaverNotify` delivery for the screen of `drawable`.
`eventMask` is a bitwise OR of `Saver.eventMask` (`Notify: 1` — on/off
transitions, `Cycle: 2` — cycle intervals); `0` deselects. No reply.

### SetAttributes(drawable, x, y, width, height, borderWidth, windowClass, depth, visual, [values])
Opcode 3. Registers this client as the external screen saver for the screen
of `drawable` and describes the saver window the server will create when the
saver next activates. Geometry and `windowClass`/`depth`/`visual` follow
core `CreateWindow` (`0` = CopyFromParent). `values` is an optional object
of CreateWindow-style attributes; accepted keys: `backgroundPixmap`,
`backgroundPixel`, `borderPixmap`, `borderPixel`, `bitGravity`,
`winGravity`, `backingStore`, `backingPlanes`, `backingPixel`,
`overrideRedirect`, `saveUnder`, `eventMask`, `doNotPropagateMask`,
`colormap`, `cursor` (each a 32-bit value). No reply.

### UnsetAttributes(drawable)
Opcode 4. Withdraws this client's external saver registration for the screen
of `drawable`. No reply.

### Suspend(suspend)
Opcode 5. `suspend` truthy disables saver activation, falsy re-enables it.
Suspensions are counted per client by the server, so always pair
`Suspend(true)` with a later `Suspend(false)`; all of a client's suspensions
are dropped when it disconnects. No reply.

## Events

### ScreenSaverNotify
Delivered after `SelectInput`. Parsed fields:

- `type` — wire event type (`firstEvent + Saver.events.ScreenSaverNotify`)
- `state` — new saver state (`Saver.State`; `Cycle: 2` for cycle events)
- `seq` — sequence number
- `time` — server timestamp
- `root` — root window of the screen
- `saverWindow` — the saver window (with state `On`)
- `kind` — `Saver.Kind` of the saver
- `forced` — `1` when the transition was caused by `ForceScreenSaver`,
  else `0`
- `name` — `'ScreenSaverNotify'`

## Notes

- Enums: `Saver.State = {Off: 0, On: 1, Cycle: 2, Disabled: 3}`,
  `Saver.Kind = {Blanked: 0, Internal: 1, External: 2}`,
  `Saver.eventMask = {Notify: 1, Cycle: 2}`,
  `Saver.events = {ScreenSaverNotify: 0}`.
- `QueryInfo`'s `state` reports `Disabled` when the core saver timeout is 0;
  the `Cycle` value only appears in the `state` field of events.
- On an idle Xvfb the saver may already be `On`; tests treat any state in
  0–3 as valid.
- `SetAttributes` describes a window the *server* creates later; it does not
  itself create or map a window and returns no XID.
