# MIT-SHM extension

Transfers images between client and server through shared memory instead of the
X socket — the fast path for large `PutImage`/`GetImage` traffic when client and
server share a machine. On this stack an upload is roughly 2× faster above a few
hundred KB, and a readback can be many times faster because it skips a large
socket reply.

The module has two layers:

- a **high-level, provider-backed API** — [`usable`](#usablecb),
  [`createSegment`](#createsegmentsize-cb) and a
  [segment object](#the-segment-object) — with a **built-in, zero-dependency
  provider**, so on a local connection SHM works out of the box; and
- the **raw wire requests** (`Attach`, `AttachFd`, `Detach`, `PutImage`,
  `GetImage`, `CreatePixmap`) for building your own flow.

- Module: `X.require('shm', cb)` (X name `MIT-SHM`)
- Source: [`lib/ext/shm.js`](../../lib/ext/shm.js),
  [`lib/shm-provider.js`](../../lib/shm-provider.js),
  [`lib/fdpass.js`](../../lib/fdpass.js) ·
  Tests: [`test/shm.js`](../../test/shm.js)
- Spec: [shm.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/shm.txt)

## Quick start

```js
X.require('shm', (err, Shm) => {
    Shm.usable((err, ok) => {
        if (!ok) return drawWithCorePutImage(); // remote, old server, no /dev/shm

        Shm.createSegment(640 * 480 * 4, (err, seg) => {
            // render straight into seg.buffer, then blit
            paintInto(seg.buffer);
            seg.putImage(drawable, gc, { width: 640, height: 480, depth: 24 });

            // reuse the same segment next frame only after the server is done
            // reading it; ask for a completion event and wait for it:
            seg.putImage(drawable, gc, { width: 640, height: 480, depth: 24, sendEvent: true });
            seg.once('complete', () => { /* safe to repaint seg.buffer */ });

            // read pixels back into seg.buffer (no big socket reply)
            seg.getImage(drawable, 0, 0, 640, 480, 0xffffffff, undefined, 0, (err, rep) => {
                readOut(seg.buffer, rep.size);
            });

            // when finished
            seg.detach();
        });
    });
});
```

## Is it available?

Whether SHM can be used is **not** decided by the extension being present:
remote servers advertise MIT-SHM (even version 1.2) and then reject every real
request, and containers or the OS can block attachment locally. Always probe
with `usable()`, which actually attaches a scratch segment and round-trips.

Two facts feed into it:

- **`display.isLocalSocket`** — true only for a same-machine unix-socket
  connection (not TCP, not an injected/custom transport). A necessary
  precondition, exposed on the display returned by `createClient`.
- **`Shm.fdCapable`** — true when the connection can pass a file descriptor to
  the server (see [How the built-in provider works](#how-the-built-in-provider-works)).

## Choosing a provider — `createClient({ shm })`

A *provider* creates shared segments and moves bytes in and out of them. The
default is the built-in one; override or disable it with the `shm` option:

| `shm` value | Effect |
|---|---|
| *(unset)* / any truthy non-object | Built-in `/dev/shm` provider on eligible local connections (default). |
| `false` or `'off'` | SHM disabled; the connection is a plain socket and `usable()` is false. |
| a provider object | Your provider (e.g. an `mmap`/`koffi` zero-copy provider, or a SysV `shmid` provider for servers without SHM 1.2). |

The built-in provider needs no native modules and adds no dependencies. It only
works where plain Node can back it — a local unix socket, a SHM 1.2 server, and
a writable `/dev/shm` (Linux). Elsewhere `usable()` returns false and you fall
back to core `PutImage`/`GetImage`, or supply your own provider.

### How the built-in provider works

A segment is an ordinary file on tmpfs (`/dev/shm`), created and immediately
unlinked so it is anonymous and reference-counted by open descriptors — it goes
away once both the client's fd and the server's mapping are gone, which makes it
leak-proof across `close()` and even a client crash. The descriptor is handed to
the server with `AttachFd` (SHM 1.2) over the unix socket; the client never maps
the segment, and reads and writes it with positional `fs` calls. Not mapping it
in the client is deliberate: a pure-Node client stays unable to segfault on a
dangling pointer, which an `mmap`-based provider cannot promise.

Passing a descriptor uses Node's internal `pipe_wrap` binding (there is no
public API for `SCM_RIGHTS`). It is isolated in [`lib/fdpass.js`](../../lib/fdpass.js)
and fully guarded: under `--permission`, in a browser bundle, or if the binding
ever disappears, the connection silently falls back to a plain socket and
`usable()` reports false.

### Writing a provider

```js
const provider = {
    flavor: 'fd',     // 'fd' -> attached with AttachFd; 'shmid' -> with Attach
    zeroCopy: false,  // true if seg.buffer aliases the server's memory
    create(size)          { /* -> seg */ },
    commit(seg, off, len) { /* make seg.buffer bytes visible to the server */ },
    sync(seg, off, len)   { /* pull server-written bytes into seg.buffer */ },
    destroy(seg)          { /* release */ }
};
```

`create` returns an object the extension reads `size`, `buffer` (a `Buffer` to
render into), and either `fd` (flavor `'fd'`) or `shmid` (flavor `'shmid'`)
from. A `'fd'` provider needs `fdCapable`; a `'shmid'` provider (SysV
`shmget`/`shmat`, e.g. via `koffi`) works on any local connection and on servers
older than SHM 1.2. For a zero-copy provider, `buffer` aliases the mapping and
`commit` is a no-op.

## High-level API

### usable(cb)
`cb(err, ok)` — `ok` is a boolean; `err` is always null. Attaches a scratch
segment and round-trips the first time, then caches the answer. `false` means
"no shared-memory fast path" — use core `PutImage`/`GetImage`.

### createSegment(size, cb)
Allocates a segment of `size` bytes and attaches it. `cb(err, segment)`. Fails
(never throws) when no provider is usable, so you can attempt it and fall back on
error.

### The segment object
Returned by `createSegment`. An `EventEmitter` with:

- **`shmseg`** — the segment's XID.
- **`size`** — byte size.
- **`buffer`** — a `Buffer` to render pixels into. With the built-in provider
  this is a plain buffer that `commit` copies into the segment; with a zero-copy
  provider it aliases the server's memory.
- **`zeroCopy`** — whether `buffer` aliases server memory (then `commit` is a
  no-op).
- **`putImage(drawable, gc, opts)`** — commits the buffer (unless
  `opts.autoCommit === false`) and issues a shared-memory `PutImage`. `opts`:
  `{ width, height, depth, format?, srcX?, srcY?, srcWidth?, srcHeight?, dstX?,
  dstY?, offset?, totalWidth?, totalHeight?, sendEvent? }`. `format` defaults to
  `ZPixmap`; `total*`/`src*` default to `width`/`height`. With `sendEvent` the
  server emits a completion when it has finished reading — wait for it before
  reusing the buffer.
- **`getImage(drawable, x, y, width, height, planeMask, format, offset, cb)`** —
  shared-memory `GetImage`: pixels land in the segment, then in `buffer`.
  `format` defaults to `ZPixmap`. `cb(err, { depth, visual, size })`.
- **`commit(offset?, length?)`** / **`readback(offset?, length?)`** — flush the
  buffer to the segment / pull the segment into the buffer, if you drive
  `PutImage`/`GetImage` yourself.
- **`detach(cb?)`** — detach from the server and release the segment.
- **`'complete'` event** — `(offset, event)`, emitted for a `sendEvent`
  `putImage` once the server has finished reading the segment.

## Raw requests

`QueryVersion` is issued automatically while requiring; its results are cached as
`Shm.major`, `Shm.minor`, `Shm.sharedPixmaps`, `Shm.pixmapFormat`, `Shm.uid` and
`Shm.gid`. (Note: `uid`/`gid` are 16-bit on the wire and unreliable on systems
with larger ids; and a reported version says nothing about usability — probe.)

### QueryVersion(cb)
`cb(err, {sharedPixmaps, majorVersion, minorVersion, uid, gid, pixmapFormat})`.

### Attach(shmseg, shmid, readOnly, cb?)
Attaches the SysV segment `shmid` to the server as SEG XID `shmseg` (a fresh XID
from `X.AllocID()`). With `readOnly` truthy the server maps it read-only, which
makes `GetImage` into it fail. Void; with `cb` it fires `cb(null)` once the
server has processed it or `cb(err)` if it failed (an attach can raise
`BadAccess` server-side even with a valid XID).

### AttachFd(shmseg, fd, readOnly, cb?)
Like `Attach`, but hands the server the open file descriptor `fd` (a regular
file or memfd you keep owning — what actually travels is a self-dup made
through `/proc/self/fd`) instead of a SysV id. Needs `fdCapable`. The request
rides the ordinary output queue like any other, so it may be freely mixed with
other requests. Void; `cb` as for `Attach`. (SHM 1.2.)

### Detach(shmseg, cb?)
Detaches the segment from the server; the SEG XID becomes invalid. Void, `cb` as
above.

### PutImage(drawable, gc, img)
Copies a subrectangle of the image stored in a shared segment to `drawable`.
`img` is `{totalWidth, totalHeight, srcX, srcY, srcWidth, srcHeight, dstX, dstY,
depth, format, sendEvent, shmseg, offset}`. When `sendEvent` is truthy the
server sends a `ShmCompletion` event after it finishes reading (until then the
client must not modify the data). No reply.

### GetImage(drawable, x, y, width, height, planeMask, format, shmseg, offset, cb)
Like core `GetImage`, but the pixel data is written into the shared segment at
`offset` instead of returned in the reply. `cb(err, {depth, visual, size})`.

### CreatePixmap(pid, drawable, width, height, depth, shmseg, offset)
Creates pixmap `pid` (a fresh XID) whose storage is the shared segment at
`offset`. Only valid when `Shm.sharedPixmaps` is true, and the data layout must
match `Shm.pixmapFormat`. No reply.

## Events / errors

### ShmCompletion
Sent after a `PutImage` with `sendEvent` once the server has finished reading the
segment. Fields: `{name: 'ShmCompletion', type, seq, drawable, minorEvent,
majorEvent, shmseg, offset}`. The high-level API routes this to the owning
segment's `'complete'` event.

### BadSeg
Error code `Shm.firstError + Shm.errors.BadSeg` (`Shm.errors = {BadSeg: 0}`),
raised when a request names a SEG XID that is not an attached segment; the
error's `badParam` carries the offending XID. Note that `Attach` with a bogus
`shmid` fails with core `BadAccess` instead — the XID is fine, the server's
`shmat()`/`mmap()` is what fails.

## Notes

- **CreateSegment (minor opcode 7) is deliberately not implemented.** It is the
  reverse-direction request: the server allocates the segment and returns *its*
  descriptor to the client. Receiving a regular-file descriptor over a
  libuv-read socket aborts the Node process (`SIGABRT`), so this module only ever
  *sends* descriptors (`AttachFd`).
- **Shared memory only works when client and server run on the same machine.**
  The built-in provider additionally needs a SHM 1.2 server and a writable
  `/dev/shm`; on other platforms (macOS, Windows) supply a provider or fall back
  to core requests.
- `Shm.ImageFormat = {XYBitmap: 0, XYPixmap: 1, ZPixmap: 2}` — the core image
  format codes, reused for `format` arguments and `pixmapFormat`.
