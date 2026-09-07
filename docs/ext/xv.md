# XVideo (Xv) extension

Access to hardware video adaptors: scaled/color-converted image output
(and video input) through per-adaptor "ports". This module implements
adaptor/port management and the image path — handing an adaptor a YUV (or
RGB) frame and letting it convert and scale in hardware. The capture side
(PutVideo/GetVideo and friends) is not implemented, apart from the
`StopVideo` teardown every client needs (see Notes).

- Module: `X.require('xv', cb)` (X name `XVideo`, version reported by the
  server, 2.2 on current Xorg/Xvfb)
- Source: [`lib/ext/xv.js`](../../lib/ext/xv.js) ·
  Tests: [`test/xv.js`](../../test/xv.js),
  [`test/xserver/xv.js`](../../test/xserver/xv.js) ·
  Example: [`examples/xv/testpattern.js`](../../examples/xv/testpattern.js)
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

### QueryImageAttributes(port, id, width, height, cb)
`cb(err, {numPlanes, dataSize, width, height, pitches, offsets})` — how a
frame of image format `id` (from `ListImageFormats`) at `width x height` has
to be laid out in memory for this port. The server may round the size up
(planar formats need even dimensions, every plane's pitch is padded), so use
the `width`/`height` it answers, allocate `dataSize` bytes, and write plane
`i` at `offsets[i]` with `pitches[i]` bytes per row. Call this before
`PutImage`, not after.

### PutImage(port, drawable, gc, id, img, [cb])
Hands the adaptor one frame. `img` is
`{srcX, srcY, srcWidth, srcHeight, drwX, drwY, drwWidth, drwHeight, width,
height, data}`: `width`/`height` describe the image in `data` (laid out per
`QueryImageAttributes`), `src*` selects the part of it to show, `drw*` is the
destination rectangle in `drawable`. The adaptor scales and colour-converts
between the two.

```js
Xv.QueryImageAttributes(port, format.id, 640, 480, (err, plane) => {
    const frame = Buffer.alloc(plane.dataSize);
    // ... fill plane 0 at plane.offsets[0], plane.pitches[0] bytes per row
    Xv.PutImage(port, win, gc, format.id, {
        srcX: 0, srcY: 0, srcWidth: plane.width, srcHeight: plane.height,
        drwX: 0, drwY: 0, drwWidth: 1280, drwHeight: 960,
        width: plane.width, height: plane.height, data: frame
    });
});
```

Two things to know about `data`:

- **It is queued by reference, not copied** (core `PutImage` copies; this one
  does not, because a frame is large and the point of Xv is to move fewer
  bytes). Do not overwrite it until the server has read it: alternate two
  buffers, or wait for `cb`. `ShmPutImage` with `sendEvent` is the proper
  recycling discipline.
- **A frame past 256 KiB needs BIG-REQUESTS**, which is enabled by default;
  the request switches to the extended length encoding on its own. A frame
  past `display.max_request_length * 4` bytes (that limit is 256 KiB when the
  connection was made with `disableBigRequests`) is refused before anything
  is sent — through `cb` if you passed one, otherwise as a thrown `Error` —
  because a server that reads a length it cannot accept drops the whole
  connection, not just the request. There is no way to split one XvPutImage:
  send a smaller frame and let the adaptor scale it up, or use
  `ShmPutImage`, whose size is bounded by the segment rather than the
  request.

`cb` is optional and makes this a *checked* void request: it fires with
`null` once the server has processed the frame, or with the error
(`XvBadPort`, `BadMatch` for a format the port does not take, `BadAlloc`).
It forces a round trip, so use it while bringing a pipeline up, not on every
frame of a playback loop.

### ShmPutImage(port, drawable, gc, shmseg, id, img, [cb])
`PutImage` with the pixels already in a shared memory segment instead of on
the wire. `img` takes the same fields except `data`, plus `offset` (where the
frame starts in the segment) and `sendEvent`. `shmseg` is a segment XID from
[MIT-SHM](shm.md) — `Shm.createSegment(size, cb)` gives you one with a
`buffer` to render into.

With `sendEvent: true` the server sends a `ShmCompletion` event once it has
finished reading the segment, which is what lets you reuse that buffer
safely; `lib/ext/shm.js` routes it to the segment, so
`segment.on('complete', ...)` fires:

```js
Shm.createSegment(plane.dataSize, (err, segment) => {
    segment.on('complete', () => { /* safe to render the next frame */ });
    segment.buffer.fill(0x80);
    segment.commit(0);
    Xv.ShmPutImage(port, win, gc, segment.shmseg, format.id, {
        srcX: 0, srcY: 0, srcWidth: w, srcHeight: h,
        drwX: 0, drwY: 0, drwWidth: w, drwHeight: h,
        width: w, height: h, offset: 0, sendEvent: true
    });
});
```

### StopVideo(port, drawable, [cb])
Stops whatever `port` is putting into `drawable` and drops the association
between the two — the teardown half of `PutImage`, and what makes a server
send `XvVideoNotify` with reason `Stopped`. Call it when the window a port
was feeding goes away. Void; `cb` is checked as for `PutImage`.

### SelectVideoNotify(drawable, onoff, [cb])
Subscribes to (`onoff` true) or unsubscribes from `XvVideoNotify` events for
`drawable`. Takes a drawable rather than a port, so it works even on a server
with no adaptors. Void; `cb` is checked as for `PutImage`.

### SelectPortNotify(port, onoff, [cb])
Subscribes to (`onoff` true) or unsubscribes from `XvPortNotify` events for
`port` — sent whenever one of its attributes changes, including changes made
by other clients.

## Events

Both need the matching Select request above before a server sends them.

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
- Not implemented: the capture-side requests PutVideo (5), PutStill (6),
  GetVideo (7) and GetStill (8). They drive a video *input* port — a capture
  card scanning into a drawable — which no current driver ships, and none of
  them can be exercised anywhere in CI. `StopVideo` (9) *is* implemented
  despite belonging to the same group: it is how an image client releases a
  drawable.
- **There may well be no adaptor.** `QueryAdaptors` returning `[]` is the
  normal case on anything but a machine with a GPU driver that offers
  textured video: Xvfb (the CI server) and XQuartz both advertise
  `X-Video Extension version 2.2` and answer "no adaptors present". A client
  that wants Xv has to check the list and fall back to core `PutImage`.
- Testing, given the above: test/xv.js runs against the real server and
  checks that each port-based request reaches it well formed — a controlled
  `XvBadPort` rather than a `BadLength`, with the connection still in step
  afterwards — and takes the success path instead when a real adaptor is
  present. test/xserver/xv.js registers a test adaptor
  (test/xserver/xv-adaptor.js) on the pure-JS X server and drives the image
  path to completion: YUY2 and I420 frames decoded and compared pixel by
  pixel, plane pitches and offsets, scaling, the BIG-REQUESTS encoding, and
  the notify events including the Started/Stopped pair around StopVideo.
