# X-Resource extension

Server introspection: enumerates connected clients, the resources (windows,
pixmaps, GCs, ...) each one owns and how much pixmap memory they consume.
Version 1.2 adds client PID lookup and exact per-resource byte accounting.

- Module: `X.require('res', cb)` (X name `X-Resource`, version 1.2)
- Source: [`lib/ext/res.js`](../../lib/ext/res.js) ·
  Tests: [`test/res.js`](../../test/res.js)
- Spec: [resproto.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/resourceproto/resproto.txt)

```js
X.require('res', (err, Res) => {
    Res.QueryClients((err, clients) => {
        // [{resourceBase, resourceMask}, ...] — one entry per connection
        Res.QueryClientResources(clients[0].resourceBase, (err, types) => {
            // [{resourceType, count}, ...] — resourceType is an atom
        });
    });
});
```

The version is negotiated automatically while requiring; it is available as
`Res.major` / `Res.minor`.

Clients are identified by any XID inside their resource range — typically the
`resourceBase` from `QueryClients` (for your own connection,
`display.resource_base`).

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])`. Called
automatically by `X.require` with 1.2.

### QueryClients(cb)
`cb(err, clients)` — array of `{resourceBase, resourceMask}` XID ranges, one
per connected client.

### QueryClientResources(xid, cb)
`xid`: any XID in the target client's range. `cb(err, types)` — array of
`{resourceType, count}` for each resource type the client owns;
`resourceType` is an atom (e.g. 20 = `PIXMAP`).

### QueryClientPixmapBytes(xid, cb)
`cb(err, bytes)` — estimated pixmap memory usage of the client owning `xid`,
in bytes. The 64-bit bytes/bytesOverflow pair is composed into a plain JS
number, exact only up to 2^53 - 1.

### QueryClientIds(specs, cb)
Since 1.2. `specs` is an array of `{client, mask}`: `client` is an XID in the
target client's range or 0 for all clients; `mask` is a set of
`Res.ClientIdMask` bits or 0 for all id methods. `cb(err, ids)` — array of
`{client, mask, value}` where `value` is a list of CARD32s: a single PID for
`LocalClientPID`, empty for `ClientXID` (the id is the `client` field
itself).

### QueryResourceBytes(client, specs, cb)
Since 1.2. `client`: XID restricting the query to one client, or 0 for all.
`specs` is an array of `{resource, type}`: `resource` is an XID or 0 (all
resources), `type` an atom or 0 (any type). `cb(err, sizes)` — array of size
records `{resource, type, bytes, refCount, useCount, crossReferences}`;
`crossReferences` is a list of `{resource, type, bytes, refCount, useCount}`
for resources referenced by the main one.

## Events / errors

None.

## Notes

- `Res.ClientIdMask = {ClientXID: 1, LocalClientPID: 2}`.
- `QueryClientIds` and `QueryResourceBytes` need a server speaking
  X-Resource 1.2; guard with a version check
  (`Res.major > 1 || Res.minor >= 2`) as the tests do.
- `LocalClientPID` only yields a PID for clients local to the server host;
  remote clients report no value.
- Byte counts from `QueryClientPixmapBytes`/`QueryResourceBytes` include
  scanline padding, so a pixmap may account for more than
  `width * height * bytesPerPixel`.
