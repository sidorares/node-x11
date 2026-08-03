'use strict';

// Built-in, zero-dependency MIT-SHM segment provider.
//
// A shared segment is an ordinary file on a tmpfs (`/dev/shm`), created and
// unlinked immediately so it is anonymous and reference-counted by open
// descriptors: it goes away when both the client's fd and the server's mapping
// are gone, which makes it leak-proof across `close()` and even a client crash.
//
// The server receives the descriptor through MIT-SHM `AttachFd` (see
// lib/fdpass.js) and `mmap`s it; the client never maps it, and reads and writes
// it with positional `fs` calls (`pwrite`/`pread`). Not mapping the segment in
// the client is deliberate — it keeps the pure-Node client unable to segfault
// on a dangling pointer, which an `mmap`-based (FFI) provider cannot promise.
//
// Providers are pluggable: pass your own as `createClient({ shm: provider })`
// to get zero-copy behaviour from an FFI mapping, or SysV segments for servers
// older than SHM 1.2. The contract a provider must implement:
//
//   provider.flavor      'fd' (attach via AttachFd) | 'shmid' (via Attach)
//   provider.zeroCopy    true if `seg.buffer` aliases the server's memory
//   provider.create(size)            -> seg   (throws on failure)
//   provider.commit(seg, off, len)           make buffer bytes visible to server
//   provider.sync(seg, off, len)             pull server-written bytes into buffer
//   provider.destroy(seg)                     release the segment
//
// `seg` is opaque except for the fields the extension reads: `seg.size`,
// `seg.buffer` (a Buffer to render into), and either `seg.fd` (flavor 'fd') or
// `seg.shmid` (flavor 'shmid').

const SHM_DIR = '/dev/shm';
let counter = 0;

// Returns a provider, or null when this platform cannot back one with plain
// Node (no tmpfs: macOS, Windows). The connection must also be fd-capable
// (lib/fdpass.js) for the returned 'fd'-flavor provider to attach — the
// extension checks that separately.
function createBuiltinProvider() {
    let fs;
    try {
        fs = require('fs');
    } catch {
        return null; // browser bundle
    }
    // tmpfs is what makes this "shared memory" rather than disk I/O; without it
    // (macOS/Windows) fall back to core PutImage or a caller-supplied provider.
    try {
        fs.accessSync(SHM_DIR, fs.constants.W_OK);
    } catch {
        return null;
    }

    return {
        flavor: 'fd',
        zeroCopy: false,

        create(size) {
            if (!(size > 0))
                throw new Error('segment size must be positive');
            const path = `${SHM_DIR}/node-x11-shm-${process.pid}-${counter++}`;
            const fd = fs.openSync(path, 'w+', 0o600);
            try {
                fs.ftruncateSync(fd, size);
                // Anonymous from here on: the inode lives only as long as an
                // open descriptor references it (ours, then also the server's).
                fs.unlinkSync(path);
            } catch (err) {
                try { fs.closeSync(fd); } catch { /* ignore */ }
                try { fs.unlinkSync(path); } catch { /* ignore */ }
                throw err;
            }
            return { size, fd, buffer: Buffer.alloc(size) };
        },

        commit(seg, offset = 0, length = seg.size - offset) {
            if (length <= 0)
                return;
            fs.writeSync(seg.fd, seg.buffer, offset, length, offset);
        },

        sync(seg, offset = 0, length = seg.size - offset) {
            if (length <= 0)
                return;
            fs.readSync(seg.fd, seg.buffer, offset, length, offset);
        },

        destroy(seg) {
            if (seg.fd !== undefined && seg.fd !== null) {
                try { fs.closeSync(seg.fd); } catch { /* ignore */ }
                seg.fd = null;
            }
        }
    };
}

module.exports = { createBuiltinProvider };
