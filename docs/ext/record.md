# RECORD extension

Intercepts the X protocol itself: a record context selects which clients and
which request/reply/event/error ranges to capture, and `EnableContext` streams
the raw intercepted protocol bytes back. This is the mechanism behind
`xdotool`-style event sniffers and macro recorders.

- Module: `X.require('record', cb)` (X name `RECORD`, version 1.13)
- Source: [`lib/ext/record.js`](../../lib/ext/record.js) ·
  Tests: [`test/record.js`](../../test/record.js)
- Spec: [record.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/recordproto/record.txt)

```js
// control connection: owns the context
X.require('record', (err, Record) => {
    const context = X.AllocID();
    Record.CreateContext(context, 0, [Record.CS.AllClients], [
        { deviceEvents: { first: 2, last: 6 } } // core input events
    ]);

    // dedicated connection: receives the recorded data
    x11.createClient((err, dpy2) => {
        dpy2.client.require('record', (err, Record2) => {
            Record2.EnableContext(context, reply => {
                if (reply.category === Record.Category.FromServer)
                    console.log(reply.data); // raw protocol bytes
            }, err => {
                // EndOfData: recording stopped
            });
        });
    });
});
```

The version is negotiated automatically while requiring (client version 1.13)
and is available as `Record.major` / `Record.minor`.

## Range and client-spec arguments

`ranges` arguments are arrays of range objects; every key is optional:

```js
{
    coreRequests:    {first, last},   // core request opcodes
    coreReplies:     {first, last},
    extRequests:     { major: {first, last}, minor: {first, last} },
    extReplies:      { major: {first, last}, minor: {first, last} },
    deliveredEvents: {first, last},   // events sent to the client
    deviceEvents:    {first, last},   // device events (grabs bypassed)
    errors:          {first, last},
    clientStarted:   false,           // record new-connection setup
    clientDied:      false            // record disconnects
}
```

Omitted sub-ranges default to `{first: 0, last: 0}` (record nothing of that
kind). `clientSpecs` arguments are arrays of client XIDs (any XID owned by
the client, e.g. its `resource_base`) or one of the `Record.CS`
pseudo-clients.

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])`. Called
automatically by `X.require`.

### CreateContext(context, elementHeader, clientSpecs, ranges)
Creates record context `context` (a fresh XID from `X.AllocID()`).
`elementHeader` is a bitmask of `Record.HType` flags controlling optional
per-element header data in the recorded stream; pass 0 for none. No reply.

### RegisterClients(context, elementHeader, clientSpecs, ranges)
Adds clients/ranges to an existing context; same arguments as
`CreateContext`. No reply.

### UnregisterClients(context, clientSpecs)
Removes the listed clients from the context. No reply.

### GetContext(context, cb)
`cb(err, {enabled, elementHeader, interceptedClients})` — `enabled` is a
boolean, `interceptedClients` is an array of
`{clientResource, ranges}` where `ranges` is a list of fully populated range
objects (shape as above, with booleans for `clientStarted`/`clientDied`).

### EnableContext(context, onData, cb)
Starts recording. This is a multi-reply request: the server keeps sending
replies on this connection until the context is disabled or freed.
`onData(reply)` is invoked for each reply as it arrives; `cb(err, replies)`
fires once, when the `EndOfData` reply terminates the series (`replies` is
the accumulated array of every reply passed to `onData`).

Each reply has the shape:

```js
{
    category,       // Record.Category.* (StartOfData first, then data)
    elementHeader,  // as configured on the context
    clientSwapped,  // boolean: recorded client uses swapped byte order
    xidBase,        // XID base of the recorded client
    serverTime,     // server timestamp of the first element in data
    recSequenceNum, // recorded client's sequence number
    data            // Buffer of raw protocol bytes (may be empty)
}
```

Wait for the `StartOfData` reply before triggering anything you expect to be
recorded — only from that point on is the context live.

### DisableContext(context)
Stops recording; the server finishes the `EnableContext` series with an
`EndOfData` reply. Must be issued from a different connection than the one
blocked in `EnableContext`. No reply.

### FreeContext(context)
Destroys the context (implicitly disabling it). No reply.

## Events / errors

No events. One error, `BadContext` (error code `Record.firstError + 0`),
raised when a request names an invalid record context. The error object gets
`badContext` (the offending XID) and message `'RECORD BadContext'`.

## Notes

- Dedicated connection required: while `EnableContext` is active, its
  connection carries only recording replies — issue every other request
  (including `DisableContext`/`FreeContext`) from a separate connection. The
  usual pattern is a control connection that creates and owns the context and
  a second connection used solely for `EnableContext` (see
  [`test/record.js`](../../test/record.js)).
- `reply.data` is raw wire-format protocol, not parsed objects: for a
  `FromClient` element the first byte is the request opcode; for `FromServer`
  it is an event code or reply/error marker. Parsing it is up to the caller.
- Enums attached to the extension object:
  - `Record.HType = {FromServerTime: 1, FromClientTime: 2,
    FromClientSequence: 4}` — `elementHeader` bits.
  - `Record.CS = {CurrentClients: 1, FutureClients: 2, AllClients: 3}` —
    pseudo-client specs.
  - `Record.Category = {FromServer: 0, FromClient: 1, ClientStarted: 2,
    ClientDied: 3, StartOfData: 4, EndOfData: 5}` — reply categories
    (`EndOfData` is consumed internally to terminate the series and never
    reaches `onData`).
