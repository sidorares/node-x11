# DAMAGE extension

Reports changes ("damage") to drawables. A client creates a damage object
monitoring a drawable and receives `DamageNotify` events whenever the
drawable's contents change — the building block of compositing managers and
screen-sharing tools, usually together with Composite
([ext/composite.md](composite.md)) and XFIXES regions
([ext/fixes.md](fixes.md)).

- Module: `X.require('damage', cb)` (X name `DAMAGE`, version 1.1)
- Source: [`lib/ext/damage.js`](../../lib/ext/damage.js) ·
  Example: [`examples/smoketest/damagetest.js`](../../examples/smoketest/damagetest.js)
- Spec: [damageproto.txt](http://www.x.org/releases/X11R7.6/doc/damageproto/damageproto.txt)

```js
X.require('damage', (err, Damage) => {
    const damage = X.AllocID();
    Damage.Create(damage, wid, Damage.ReportLevel.NonEmpty);
    X.on('event', ev => {
        if (ev.name === 'DamageNotify') {
            Damage.Subtract(damage, 0, 0); // acknowledge, rearm reporting
            // repaint from ev.drawable here
        }
    });
});
```

The version is negotiated automatically while requiring; it is available as
`Damage.major` / `Damage.minor`.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])` — the version the
server will speak. Called automatically by `X.require` with 1.1.

### Create(damage, drawable, reportLevel)
Creates damage object `damage` (a client-allocated XID) monitoring
`drawable`. `reportLevel` is one of `Damage.ReportLevel` and controls how
`DamageNotify` events are batched:

| Level | Value | Meaning |
| --- | --- | --- |
| `RawRectangles` | 0 | an event per changed rectangle |
| `DeltaRectangles` | 1 | events only for areas not already damaged |
| `BoundingBox` | 2 | events when the damage bounding box grows |
| `NonEmpty` | 3 | a single event when the region becomes non-empty |

No reply.

### Destroy(damage)
Destroys damage object `damage`. No reply.

### Subtract(damage, repair, parts)
Synchronously subtracts `repair` (an XFIXES region XID, or `0` for "the whole
damage region") from the damage region of `damage`. If `parts` is a region
XID it receives the intersection of the damage region and `repair` before the
subtraction; pass `0` to discard it. Subtracting rearms event delivery: with
`NonEmpty` reporting, call `Subtract(damage, 0, 0)` after each event to be
told about the next change. No reply.

### Add(drawable, region)
Reports damage in `region` (an XFIXES region XID) against `drawable`, as if
the client had drawn there. Damage objects of other clients monitoring the
drawable are notified. No reply. Note: the source names the first parameter
`damage`, but the protocol field is a drawable.

## Events

### DamageNotify
Delivered when a monitored drawable changes, subject to the report level.
Not selected via an event mask — creating a damage object selects delivery.
Parsed fields:

- `type` — wire event type (`firstEvent + Damage.events.DamageNotify`)
- `level` — report level of the damage object (`Damage.ReportLevel`); the
  server may set bit `0x80` when more events for the same drawable follow
- `seq` — sequence number
- `drawable` — the monitored drawable
- `damage` — the damage object
- `time` — server timestamp
- `area` — `{x, y, w, h}` changed rectangle, drawable-relative
- `geometry` — `{x, y, w, h}` current geometry of the drawable
- `name` — `'DamageNotify'`

Note the `w`/`h` field names (not `width`/`height`), and that the event has
no `type` field, unlike most other extension events in this library.

## Notes

- `Damage.ReportLevel = {RawRectangles: 0, DeltaRectangles: 1, BoundingBox: 2,
  NonEmpty: 3}`.
- `Damage.events = {DamageNotify: 0}` (offset from the extension's
  `firstEvent`).
- Regions passed to `Subtract` and `Add` are XFIXES regions; create them with
  `Fixes.CreateRegion` ([ext/fixes.md](fixes.md)).
