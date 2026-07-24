# XVideo (Xv) extension

Access to hardware video adaptors: scaled/color-converted image output
(and video input) through per-adaptor "ports". This module implements the
query/port-management half of the protocol; the actual video-path requests
are not implemented (see Notes).

- Module: `X.require('xv', cb)` (X name `XVideo`, version reported by the
  server, 2.2 on current Xorg/Xvfb)
- Source: [`lib/ext/xv.js`](../../lib/ext/xv.js) ·
  Tests: [`test/xv.js`](../../test/xv.js)
- Spec: [xv-protocol-v2.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/videoproto/xv-protocol-v2.txt)

```js
X.require('xv', (err, Xv) => {
    Xv.QueryAdaptors(root, (err, adaptors) => {
        // [] on Xvfb; on real hardware:
        // [{baseId, numPorts, type, name, formats: [{visual, depth}]}, ...]
        if (adaptors.length === 0) return;
        const port = adaptors[0].baseId;
        Xv.QueryEncodings(port, (err, encodings) => { /* ... */ });
    });
});
```

The version is negotiated automatically while requiring; it is available as
`Xv.major` / `Xv.minor`.

## Requests

### QueryExtension(cb)
`cb(err, [major, minor])` — the Xv protocol version spoken by the server.
(The protocol calls its version request "QueryExtension".) Called
automatically by `X.require`.

### QueryAdaptors(window, cb)
`cb(err, adaptors)` — array of
`{baseId, numPorts, type, name, formats}` for the screen `window` is on.
`baseId` is the first port XID (ports are `baseId .. baseId+numPorts-1`),
`type` is a mask of `Xv.Type` values, `formats` is an array of
`{visual, depth}`.

### QueryEncodings(port, cb)
`cb(err, encodings)` — array of
`{encoding, width, height, rate: {numerator, denominator}, name}` supported
by `port`. `encoding` is an XID usable as the `XV_ENCODING` attribute value.

### GrabPort(port, time, cb)
Grabs exclusive use of `port`. `time` 0 = CurrentTime. `cb(err, status)` —
an `Xv.GrabPortStatus` value (`Success` = 0; note a non-Success status is a
normal reply, not an X error).

### UngrabPort(port, time)
No reply. Releases a port grab.

### QueryBestSize(port, vidW, vidH, drwW, drwH, motion, cb)
`cb(err, {width, height})` — closest size the adaptor can scale
`vidW x vidH` video to when asked for `drwW x drwH`. `motion` is a boolean
(clipped to 0/1) hinting the video will move/resize continuously.

### SetPortAttribute(port, attribute, value)
No reply. Sets port attribute `attribute` (an atom, e.g. `XV_BRIGHTNESS`)
to the signed 32-bit `value`. Raises `XvBadPort`/`BadMatch`/`BadValue` on
the error event when invalid.

### GetPortAttribute(port, attribute, cb)
`cb(err, value)` — current signed 32-bit value of the attribute atom.

### QueryPortAttributes(port, cb)
`cb(err, attributes)` — array of `{flags, min, max, name}`. `flags` is a
mask of `Xv.AttributeFlag` (`Gettable`/`Settable`); `name` is the attribute
name string (intern it to get the atom for Get/SetPortAttribute).

### ListImageFormats(port, cb)
`cb(err, formats)` — array of XvImageFormatInfo objects:
`{id, type, byteOrder, guid, bpp, numPlanes, depth, redMask, greenMask,
blueMask, format, ySampleBits, uSampleBits, vSampleBits, horzYPeriod,
horzUPeriod, horzVPeriod, vertYPeriod, vertUPeriod, vertVPeriod, compOrder,
scanlineOrder}`. `id` is the FOURCC as a number, `guid` a 16-byte Buffer,
`type` an `Xv.ImageFormatInfoType`, `format` an `Xv.ImageFormatInfoFormat`,
`scanlineOrder` an `Xv.ScanlineOrder`, `compOrder` a string.

## Events

Selecting these requires SelectVideoNotify/SelectPortNotify, which are not
implemented (see Notes); the parsers are registered for completeness.

### XvVideoNotify
Video started/stopped on a drawable. Fields: `type`, `seq`, `reason`
(`Xv.VideoNotifyReason` value), `time`, `drawable`, `port`.

### XvPortNotify
A port attribute changed. Fields: `type`, `seq`, `time`, `port`,
`attribute` (atom), `value`.

## Errors

`Xv.errors = {BadPort, BadEncoding, BadControl}` — extension error codes
(`ext.firstError` based); compare against `err.error` in callbacks.

## Notes

- Enums attached to the ext object:
  `Xv.Type = {InputMask: 1, OutputMask: 2, VideoMask: 4, StillMask: 8,
  ImageMask: 16}`,
  `Xv.ImageFormatInfoType = {RGB: 0, YUV: 1}`,
  `Xv.ImageFormatInfoFormat = {Packed: 0, Planar: 1}`,
  `Xv.AttributeFlag = {Gettable: 1, Settable: 2}`,
  `Xv.ScanlineOrder = {TopToBottom: 0, BottomToTop: 1}`,
  `Xv.GrabPortStatus = {Success: 0, BadExtension: 1, AlreadyGrabbed: 2,
  InvalidTime: 3, BadReply: 4, BadAlloc: 5}`,
  `Xv.VideoNotifyReason = {Started: 0, Stopped: 1, Busy: 2, Preempted: 3,
  HardError: 4}`.
- Not implemented: the video-path requests PutVideo (5), PutStill (6),
  GetVideo (7), GetStill (8), StopVideo (9), SelectVideoNotify (10),
  SelectPortNotify (11), QueryImageAttributes (17), PutImage (18),
  ShmPutImage (19). These need a working port to do anything, and Xvfb
  (the CI server) exposes the extension with zero adaptors, so they cannot
  be exercised; they are omitted rather than shipped untested.
- test/xv.js validates the port-based requests against a bogus port: a
  controlled `XvBadPort` error proves correct request framing. With a real
  adaptor present the same tests take the success path.
