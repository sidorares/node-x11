# Present extension

Presents pixmap contents to a window synchronized with the display refresh
(msc — media stream counter), the modern way to do tear-free updates and
vblank-timed animation. Completion and idle notifications arrive as
GenericEvents (see [ext/ge.md](ge.md)).

- Module: `X.require('present', cb)` (X name `Present`, version 1.2
  announced by the client)
- Source: [`lib/ext/present.js`](../../lib/ext/present.js) ·
  Tests: [`test/present.js`](../../test/present.js)
- Spec: [presentproto.txt](https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/blob/master/presentproto.txt)

```js
X.require('present', (err, Present) => {
    const eid = X.AllocID();
    Present.SelectInput(eid, wid, Present.EventMask.CompleteNotify);
    Present.Pixmap(wid, pixmap, {
        serial: 1,
        options: Present.Option.Async | Present.Option.Copy
    });
    X.on('event', ev => {
        if (ev.name === 'PresentCompleteNotify')
            console.log('presented at msc', ev.msc);
    });
});
```

The version is negotiated automatically while requiring; it is available as
`Present.major` / `Present.minor`.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])` — the version the
server will speak. Called automatically by `X.require` (announcing 1.2).

### Pixmap(window, pixmap, opts)
PresentPixmap: copies `pixmap` to `window` at the target msc. No reply.
`opts` keys (all optional, default 0/empty):

- `serial` — client cookie echoed in the CompleteNotify/IdleNotify events
- `valid`, `update` — XFIXES region XIDs ([ext/fixes.md](fixes.md));
  0 = None
- `xOff`, `yOff` — presentation offset (signed)
- `targetCrtc` — RandR crtc to time against; 0 = server picks
- `waitFence`, `idleFence` — SYNC fence XIDs ([ext/sync.md](sync.md));
  0 = None
- `options` — mask of `Present.Option` values
- `targetMsc`, `divisor`, `remainder` — when to present: at `targetMsc`, or
  when `msc % divisor == remainder` (all default 0 = next vblank)
- `notifies` — array of `{window, serial}`: additional windows whose
  CompleteNotify subscribers are notified

### NotifyMSC(window, serial, targetMsc, divisor, remainder)
No reply. Requests a `PresentCompleteNotify` event with
`kind = CompleteKind.NotifyMSC` when the msc of `window`'s crtc reaches
`targetMsc` (same divisor/remainder semantics as `Pixmap`). Delivered only to
clients that selected `CompleteNotify` on `window`.

### SelectInput(eid, window, eventMask)
No reply. Selects Present events on `window`. `eid` is a fresh XID
(`X.AllocID()`) naming the event context; `eventMask` is a mask of
`Present.EventMask` values (`NoEvent` = 0 deselects). Events arrive on the
client as GenericEvents parsed into the shapes below.

### QueryCapabilities(target, cb)
`target` is a window (or RandR crtc). `cb(err, caps)` — a mask of
`Present.Capability` values.

## Events

All Present events are GenericEvents (type 35) dispatched through
`X.geEventParsers` ([ext/ge.md](ge.md)); the module registers its parser at
require time. Common fields on every event: `type` (35), `seq`, `extension`
(Present's major opcode), `evtype` (`Present.events` value), `eid`
(SelectInput context), `wid`/`window` (same value).

### PresentConfigureNotify (evtype 0)
Window size/position changed. Extra fields: `x`, `y`, `width`, `height`,
`offX`, `offY`, `pixmapWidth`, `pixmapHeight`, `pixmapFlags`.

### PresentCompleteNotify (evtype 1)
A `Pixmap` or `NotifyMSC` request completed. Extra fields: `kind`
(`Present.CompleteKind`), `mode` (`Present.CompleteMode`), `serial` (from
the request), `ust` (unadjusted system time, microseconds), `msc`.

### PresentIdleNotify (evtype 2)
A presented pixmap is reusable by the client. Extra fields: `serial`,
`pixmap`, `idleFence`.

Unknown evtypes (e.g. RedirectNotify, which has no parser) are delivered as
`PresentGenericEvent` with the unparsed body in `raw`.

## Notes

- Enums attached to the ext object:
  `Present.EventMask = {NoEvent: 0, ConfigureNotify: 1, CompleteNotify: 2,
  IdleNotify: 4, RedirectNotify: 8}`,
  `Present.Option = {None: 0, Async: 1, Copy: 2, UST: 4, Suboptimal: 8}`,
  `Present.Capability = {None: 0, Async: 1, Fence: 2, UST: 4}`,
  `Present.CompleteKind = {Pixmap: 0, NotifyMSC: 1}`,
  `Present.CompleteMode = {Copy: 0, Flip: 1, Skip: 2, SuboptimalCopy: 3}`.
- 64-bit protocol fields (`targetMsc`, `divisor`, `remainder`, `ust`, `msc`)
  are plain JS numbers composed from two 32-bit halves; values above
  2^53 - 1 lose precision (irrelevant in practice for msc counters).
- Servers may report capability bits newer than the `Capability` enum
  (AsyncMayTear = 8, Syncobj = 16 on current Xorg).
- On Xvfb the copy happens at a fake vblank; test/present.js polls with
  `GetImage` rather than assuming immediate completion.
