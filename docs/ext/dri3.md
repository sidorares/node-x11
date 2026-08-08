# DRI3 extension

Direct Rendering Infrastructure, take 3: the descriptor-passing half of the
modern OpenGL/Vulkan path on X. The client renders on the GPU itself —
entirely outside the X protocol — exports each finished buffer as a **dma-buf
file descriptor**, wraps it into an X pixmap with `PixmapFromBuffer`, and puts
it on screen with the [Present extension](present.md). No pixel data ever
crosses the socket; the server imports the very memory the client rendered to.

```
GPU (render node)                        X server
-----------------                        --------
render into a buffer
export -> dma-buf fd  --- fd over unix socket (DRI3) --->  pixmap
Present.Pixmap(window, pixmap)  ------ vsync'd flip/copy -> on screen
                    <--- PresentCompleteNotify   (pace the next frame)
                    <--- PresentIdleNotify       (buffer reusable)
```

This is what Mesa does under every GL/Vulkan application on modern Xorg and
Xwayland, and the successor to indirect [GLX](glx.md) (GL 1.x serialized
through the server, one round trip per batch — still supported by this
library, see `examples/opengl/glxgears.js`, but capped at what X11R6 could
say on the wire).

- Module: `X.require('dri3', cb)` (X name `DRI3`, version 1.4 announced by
  the client)
- Source: [`lib/ext/dri3.js`](../../lib/ext/dri3.js) ·
  Tests: [`test/dri3.js`](../../test/dri3.js) (encoding, no server needed),
  [`test/dri3-live.js`](../../test/dri3-live.js) (against a DRI3 server)
- Spec: [dri3proto.txt](https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/blob/master/dri3proto.txt)
- Working samples: [`examples/dri3/`](../../examples/dri3/) — a
  self-contained folder (own `package.json`, `npm install && npm start`)
  with [`cube.js`](../../examples/dri3/cube.js) (GPU, spinning cube) and
  [`software.js`](../../examples/dri3/software.js) (CPU pixels through
  udmabuf)

```js
X.require('dri3', (err, DRI3) => {
    const pixmap = X.AllocID();
    DRI3.PixmapFromBuffer(pixmap, wid, {
        fd: dmabufFd,          // consumed by the send
        width: 512, height: 512,
        stride: 2048,          // bytes per row, as the producer reports it
        depth: 24, bpp: 32
    }, err => {
        if (err) throw err;    // server could not import this buffer
        Present.Pixmap(wid, pixmap, { serial: 1 });
    });
});
```

Where the dma-buf comes from is up to the producer: a GBM/EGL swapchain, a
Vulkan exporter, a V4L2 camera, the kernel's udmabuf device. The optional
native companion package [`x11-dri`](https://github.com/sidorares/node-x11-dri)
(`npm install x11-dri`) provides two such producers (an OpenGL ES 2 renderer
and udmabuf) plus `dup()`; the `x11` package itself stays pure JS.

## Descriptors only flow client → server

Requests that *send* descriptors (`PixmapFromBuffer`, `PixmapFromBuffers`,
`FenceFromFD`, `ImportSyncobj`) work on any fd-capable connection — the
default for local unix-socket displays (see `lib/fdpass.js`). The descriptors
are **consumed**: closed once written, whether the write succeeded or not,
matching how they are produced (`gbm_bo_get_fd` returns a fresh fd whose only
purpose is this send). Keep a copy with `dup()` first if you need one.

The four requests whose **replies carry descriptors** — `Open`,
`BufferFromPixmap`, `FDFromFence`, `BuffersFromPixmap` — are not wired: a
descriptor arriving on the connection aborts the Node process before any JS
runs (the libuv abort described in `lib/fdpass.js`), so they report an error
instead of touching the wire. In practice none of them is needed:

- instead of `Open` (get a DRM device fd from the server), open a **render
  node** directly — `fs.openSync('/dev/dri/renderD128', 'r+')` — which
  requires no X-side authentication at all. On multi-GPU machines probe each
  `/dev/dri/renderD*`: import a small test buffer with
  `PixmapFromBuffer(..., cb)` and use the device whose import succeeds.
- instead of `BufferFromPixmap`/`BuffersFromPixmap` (export server pixmaps),
  create the buffers client-side and import them.

`DRI3.fdCapable` tells whether this connection can send descriptors at all
(false on TCP or on a transport without the fd-capable socket).

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version; `cb(err, [major, minor])`. Called
automatically while requiring (announcing 1.4); the result is cached on
`DRI3.major` / `DRI3.minor`. Gate 1.2+/1.3+/1.4+ requests on `DRI3.minor`.

### PixmapFromBuffer(pixmap, drawable, opts, cb?)
Creates `pixmap` (a fresh XID) on `drawable`'s screen from a dma-buf.
`opts` is `{fd, width, height, stride, depth, bpp, size?}` — `stride` in
bytes as the buffer's producer reports it, `size` defaulting to
`stride * height`. The `fd` is consumed. Void; with `cb` a round trip is
forced and `cb(err|null)` reports whether the server accepted the import — a
server on an incompatible device answers `BadValue`/`BadMatch`/`BadAlloc`,
which is also the sanctioned way to probe device compatibility. The buffer's
layout is the driver-negotiated ("implicit") one; use `PixmapFromBuffers` to
state it explicitly.

### PixmapFromBuffers(pixmap, window, opts, cb?) — DRI3 ≥ 1.2
Multi-planar, modifier-aware variant. `opts` is `{width, height, depth, bpp,
modifier, planes}` with `planes` an array of 1–4 `{fd, stride, offset}` and
`modifier` a `DRM_FORMAT_MOD_*` value as **BigInt** (or number; see
constants below). All plane fds are consumed. `cb` as above.

### GetSupportedModifiers(window, depth, bpp, cb) — DRI3 ≥ 1.2
`cb(err, { windowModifiers, screenModifiers })`, both arrays of **BigInt**
format modifiers the server can import for that window/screen at this
depth/bpp. Empty arrays mean "implicit only" — use `PixmapFromBuffer`.

### FenceFromFD(drawable, fence, initiallyTriggered, fd, cb?)
Creates SYNC fence `fence` (fresh XID) from a client-supplied fence fd, for
use as `waitFence`/`idleFence` in `Present.Pixmap`. The fd is consumed.

### SetDRMDeviceInUse(window, drmMajor, drmMinor, cb?) — DRI3 ≥ 1.3
Hint: this window's buffers will come from the DRM device with that
major/minor (`fs.fstatSync(fd).rdev` decoded). Void.

### ImportSyncobj(syncobj, drawable, fd, cb?) / FreeSyncobj(syncobj, cb?) — DRI3 ≥ 1.4
Imports (and frees) a DRM timeline syncobj for explicit synchronization with
Present 1.4 servers. The fd is consumed.

### Open / BufferFromPixmap / FDFromFence / BuffersFromPixmap
Refused with an explanatory error — their replies carry descriptors (see
above).

## Constants

- `DRI3.FormatModifier.Invalid` — `DRM_FORMAT_MOD_INVALID` (2⁵⁶−1), "layout
  is implicit, negotiated by the drivers".
- `DRI3.FormatModifier.Linear` — `DRM_FORMAT_MOD_LINEAR` (0n), plain
  row-major.

Modifiers use the full 64-bit range (vendor code in the top byte), beyond
`Number`'s 53-bit exactness — hence BigInt on this API.

## Errors

DRI3 defines no errors of its own; imports fail with core `BadValue`,
`BadMatch` or `BadAlloc` on the `PixmapFromBuffer(s)` sequence number.
