# MIT-SHM extension

Transfers images between client and server through SysV shared memory instead
of the X socket — the fast path for large `PutImage`/`GetImage` traffic when
client and server share a machine. This module implements the wire protocol
(SHM 1.1); obtaining an actual shared memory segment is left to the caller,
see [Notes](#notes).

- Module: `X.require('shm', cb)` (X name `MIT-SHM`, version 1.1)
- Source: [`lib/ext/shm.js`](../../lib/ext/shm.js) ·
  Tests: [`test/shm.js`](../../test/shm.js)
- Spec: [shm.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/shm.txt)

```js
X.require('shm', (err, Shm) => {
    // shmid must come from an external shmget() — see Notes
    const seg = X.AllocID();
    Shm.Attach(seg, shmid, false);
    Shm.PutImage(wid, gc, {
        totalWidth: 640, totalHeight: 480,
        srcX: 0, srcY: 0, srcWidth: 640, srcHeight: 480,
        dstX: 0, dstY: 0,
        depth: 24, format: Shm.ImageFormat.ZPixmap,
        sendEvent: true, shmseg: seg, offset: 0
    });
    X.on('event', ev => {
        // ShmCompletion: the server is done reading the segment
    });
});
```

`QueryVersion` is issued automatically while requiring; its results are
cached on the extension object as `Shm.major`, `Shm.minor`,
`Shm.sharedPixmaps`, `Shm.pixmapFormat`, `Shm.uid` and `Shm.gid`.

## Requests

### QueryVersion(cb)
Takes no version arguments. `cb(err, {sharedPixmaps, majorVersion,
minorVersion, uid, gid, pixmapFormat})` — `sharedPixmaps` is a boolean,
`uid`/`gid` identify the server process, `pixmapFormat` is the image format
shared pixmaps must use (only meaningful when `sharedPixmaps` is true).
Called automatically by `X.require`.

### Attach(shmseg, shmid, readOnly)
Attaches the SysV segment `shmid` to the server as SEG XID `shmseg` (a fresh
XID from `X.AllocID()`). With `readOnly` truthy the server maps it
read-only, which makes `GetImage` into it fail. No reply.

### Detach(shmseg)
Detaches the segment from the server; the SEG XID becomes invalid. No reply.

### PutImage(drawable, gc, img)
Copies a subrectangle of the image stored in a shared segment to `drawable`.
`img` is `{totalWidth, totalHeight, srcX, srcY, srcWidth, srcHeight, dstX,
dstY, depth, format, sendEvent, shmseg, offset}` — `totalWidth`/`totalHeight`
describe the full image in the segment, `src*` select the subrectangle,
`format` is a `Shm.ImageFormat` value and `offset` is the byte offset of the
image inside the segment. When `sendEvent` is truthy the server sends a
`ShmCompletion` event after it has finished reading the segment (until then
the client must not modify the data). No reply.

### GetImage(drawable, x, y, width, height, planeMask, format, shmseg, offset, cb)
Like core `GetImage`, but the pixel data is written into the shared segment
at `offset` instead of being returned in the reply.
`cb(err, {depth, visual, size})` — `size` is the number of bytes written.

### CreatePixmap(pid, drawable, width, height, depth, shmseg, offset)
Creates pixmap `pid` (a fresh XID) whose storage is the shared segment at
`offset`; drawing into the pixmap changes the segment and vice versa. Only
valid when `Shm.sharedPixmaps` is true, and the data layout must match
`Shm.pixmapFormat`. No reply.

## Events / errors

### ShmCompletion
Sent after a `PutImage` with `sendEvent` once the server has finished reading
the segment. Fields: `{name: 'ShmCompletion', type, seq, drawable,
minorEvent, majorEvent, shmseg, offset}` — `majorEvent`/`minorEvent` identify
the completed request (the SHM major opcode and minor opcode 3).

### BadSeg
Error code `Shm.firstError + Shm.errors.BadSeg` (`Shm.errors = {BadSeg: 0}`),
raised when a request names a SEG XID that is not an attached segment; the
error's `badParam` carries the offending XID. Note that `Attach` with a bogus
`shmid` fails with core `BadAccess` instead — the XID is fine, the server's
`shmat()` is what fails.

## Notes

- Pure-Node limitation: Node.js has no built-in binding to SysV shared memory
  (`shmget`/`shmat`), and this package's zero-runtime-dependency rule rules
  out native addons. The module therefore only speaks the wire protocol — to
  actually use it you must obtain a `shmid` (and a mapping of the segment in
  your process) from an optional native module or an external helper. Without
  one, every request except `QueryVersion` will error with `BadSeg` or
  `BadAccess`; [`test/shm.js`](../../test/shm.js) validates the encoding via
  exactly those controlled errors.
- AttachFd (minor opcode 6, SHM 1.2) is not implemented: it passes a file
  descriptor over the unix socket using `SCM_RIGHTS` ancillary data, which a
  plain Node `net.Socket` cannot send. The same applies to
  CreateSegment (opcode 7).
- Shared memory only works when client and server run on the same machine
  (and, for `Attach`, when the server's uid/gid may access the segment).
- `Shm.ImageFormat = {XYBitmap: 0, XYPixmap: 1, ZPixmap: 2}` — the core
  image format codes, reused for `format` arguments and `pixmapFormat`.
