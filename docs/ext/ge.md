# Generic Event Extension (GE)

Carries only a version handshake; its purpose is the GenericEvent (type 35)
wire event that other extensions (Present, XInput2, ...) use to deliver
events longer than the classic 32 bytes. Requiring `ge` is how a client
announces it understands type-35 events.

- Module: `X.require('ge', cb)` (X name `Generic Event Extension`,
  version 1.0)
- Source: [`lib/ext/ge.js`](../../lib/ext/ge.js) ·
  Tests: [`test/ge.js`](../../test/ge.js)
- Spec: [geproto](https://www.x.org/releases/X11R7.7/doc/xextproto/geproto.html)

```js
X.require('ge', (err, GE) => {
    // GE.major / GE.minor — negotiated version (1.0)
});
```

The version is negotiated automatically while requiring; it is available as
`GE.major` / `GE.minor`.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])` — the version the
server will speak. Called automatically by `X.require`.

## Events

None of its own. GenericEvents are always defined (and parsed) by the
extension that sends them; see below.

## GenericEvent dispatch (`X.geEventParsers`)

`lib/xcore.js` handles the type-35 wire format itself:

- A GenericEvent header carries the sending extension's major opcode in
  byte 1 and an extra length (in 4-byte units) in bytes 4-7. The event body
  is `32 + extra * 4` bytes; xcore frames it by that length so
  variable-length events do not corrupt the reply stream.
- The parsed event is produced by `X.geEventParsers[majorOpcode]`, a map
  keyed by the sending extension's major opcode. An extension module
  registers its parser as
  `X.geEventParsers[ext.majorOpcode] = (type, seq, extra, code, raw) => ...`
  where `type` is 35, `code` is the major opcode, `extra` is the extra
  length, and `raw` is the event from byte 8 on (the 16-bit `evtype`
  selecting the extension's event is at `raw` offset 0).
- With no parser registered the client still frames the event correctly and
  emits `{type: 35, seq, extension, evtype, raw}`.
- As with all events, the full wire packet (here variable-length, not 32
  bytes) is attached as `event.rawData`.

[ext/present.md](present.md) is the in-tree example of a registered parser;
XInput2 events are not wired up yet (see [ext/xinput.md](xinput.md)).

## Notes

- The spec requires clients to negotiate the version before relying on
  GenericEvents; `X.require('ge', ...)` does that. Extensions in this repo
  that send GenericEvents perform their own version handshakes, so requiring
  `ge` explicitly is only needed when talking to the wire format directly.
