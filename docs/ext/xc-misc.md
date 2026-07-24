# XC-MISC extension

Lets a long-running client ask the server which resource IDs (XIDs) are free
again, so it can keep allocating IDs after exhausting its initial range.

- Module: `X.require('xc-misc', cb)` (X name `XC-MISC`, version 1.1)
- Source: [`lib/ext/xc-misc.js`](../../lib/ext/xc-misc.js) ·
  Tests: [`test/xc-misc.js`](../../test/xc-misc.js)
- Spec: [xc-misc.pdf](http://www.x.org/releases/X11R7.6/doc/xcmiscproto/xc-misc.pdf)

```js
X.require('xc-misc', (err, XCMisc) => {
    XCMisc.GetXIDRange((err, range) => {
        // {startId, count} — a contiguous block of unused XIDs
    });
});
```

The version is negotiated automatically while requiring; it is available as
`XCMisc.major` / `XCMisc.minor`.

## Requests

### GetVersion(clientMajor, clientMinor, cb)
`cb(err, [major, minor])` — the XC-MISC version the server will speak.
Called automatically by `X.require`. `QueryVersion` is kept as an alias for
backwards compatibility (the spec name is GetVersion).

### GetXIDRange(cb)
`cb(err, {startId, count})` — the largest contiguous range of XIDs the
server currently considers unused for this client. `count` 1 with `startId`
0 means no IDs are available.

### GetXIDList(count, cb)
`cb(err, ids)` — an array of up to `count` individual unused XIDs (possibly
fewer when the server cannot find that many).

## Events / errors

None.

## Notes

- The client's built-in `X.AllocID` allocator does not use this extension
  yet; XIDs released with `X.ReleaseID` are recycled locally. XC-MISC is the
  server-side mechanism for reclaiming IDs once the handshake-assigned range
  is exhausted.
