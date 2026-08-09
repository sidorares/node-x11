// DRI3 extension
// spec: https://gitlab.freedesktop.org/xorg/proto/xorgproto/-/blob/master/dri3proto.txt
// wire structs: <X11/extensions/dri3proto.h> (xorgproto)
//
// DRI3 is the descriptor-passing half of the modern direct-rendering path:
// the client renders on the GPU itself (EGL/GBM/Vulkan — entirely outside the
// X protocol), exports each finished buffer as a dma-buf file descriptor,
// wraps it into an X pixmap with PixmapFromBuffer(s), and puts it on screen
// with the Present extension (lib/ext/present.js). No pixel data ever crosses
// the socket; the server imports the same GPU memory the client rendered to.
//
// Descriptor direction is asymmetric here, on purpose:
//
//   client -> server — PixmapFromBuffer, PixmapFromBuffers, FenceFromFD,
//   ImportSyncobj — works on an fd-capable local connection (the default for
//   unix-socket displays; lib/fdpass.js). The descriptors are CONSUMED:
//   closed once written, whether the write succeeded or not. That matches how
//   they are produced (gbm_bo_get_fd/eglExportDMABUFImageMESA return a fresh
//   fd whose only purpose is this send, while the GPU buffer object keeps its
//   own reference).
//
//   server -> client — Open, BufferFromPixmap, FDFromFence, BuffersFromPixmap
//   — is NOT wired: a descriptor arriving on the connection aborts the Node
//   process before any JS runs (see lib/fdpass.js). These four requests are
//   never put on the wire; they report an error instead. The standard
//   substitute for Open is opening a render node directly —
//   fs.openSync('/dev/dri/renderD128', 'r+') — which needs no X-side
//   authentication at all. On multi-GPU machines, probe each
//   /dev/dri/renderD* by importing a small test buffer with PixmapFromBuffer
//   until one succeeds.

const fs = require('fs');

// 64-bit format modifiers use the full 64-bit range (vendor code in the top
// byte; DRM_FORMAT_MOD_INVALID is 2^56 - 1), beyond Number's 53-bit exactness,
// so modifiers are BigInt on this API. Plain numbers are accepted on input.
const toBigUInt64 = v => (typeof v === 'bigint' ? v : BigInt(v || 0)) & 0xffffffffffffffffn;

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('DRI3', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        // drm_fourcc.h values needed to talk about buffer layout
        ext.FormatModifier = {
            Linear: 0n,
            Invalid: (1n << 56n) - 1n   // DRM_FORMAT_MOD_INVALID: "implicit, driver-negotiated"
        };

        const closeAll = fds =>
            fds.forEach(fd => { try { fs.closeSync(fd); } catch { /* ignore */ } });

        // Requests that make the server send a descriptor back are refused
        // here (fds are unreceivable — see the header). Errors, not throws,
        // when a callback is given, so probing code can fall back cleanly.
        const unreceivable = (what, hint, cb) => {
            const err = new Error(`DRI3: ${what} makes the server return a file descriptor, ` +
                'and receiving one would abort the Node process (see lib/fdpass.js). ' + hint);
            if (cb) return process.nextTick(() => cb(err));
            throw err;
        };

        // Shared tail of every descriptor-carrying request. The descriptors
        // ride the output queue with their request bytes (putWithFds), so the
        // request keeps its place in wire order no matter what else is issued
        // around it, and behaves like any other void request: with `cb` a
        // round trip is forced and cb(err|null) reports whether the server
        // accepted it. The fds are consumed in all cases.
        const sendWithFds = (b, fds, what, cb) => {
            const socket = X.stream;
            if (!socket || !socket._fdCapable || typeof socket.sendFds !== 'function') {
                closeAll(fds);
                const err = new Error(`DRI3: ${what} passes file descriptors and needs ` +
                    'an fd-capable local connection (unix-socket display; see lib/fdpass.js)');
                if (cb) return process.nextTick(() => cb(err));
                throw err;
            }
            X.seq_num++;
            const seq = X.seq_num;
            if (cb) {
                X.replies[seq] = [null, e => { cb(e || null); return true; }];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.putWithFds(b, fds);
            X.pack_stream.submit();
        };

        ext.QueryVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(clientMaj >>> 0, 4);
            b.writeUInt32LE(clientMin >>> 0, 8);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => [buf.readUInt32LE(0), buf.readUInt32LE(4)],
                cb
            ];
            X.pack_stream.submit(true);
        }

        // The reply carries the DRM device fd — unreceivable (see header).
        ext.Open = (drawable, provider, cb) =>
            unreceivable('Open', 'Open a render node directly instead: ' +
                "fs.openSync('/dev/dri/renderD128', 'r+').", cb);

        // Turn a dma-buf into `pixmap` (a fresh XID) on `drawable`'s screen.
        // opts: { fd, width, height, stride, depth, bpp, size? } — size
        // defaults to stride * height. The fd is consumed. With `cb` the
        // creation is confirmed by a round trip (cb(err|null)): a server that
        // cannot import the buffer answers with a BadValue/BadMatch/BadAlloc
        // error, so probing "does this device's buffers import?" is exactly
        // PixmapFromBuffer with a callback.
        ext.PixmapFromBuffer = (pixmap, drawable, opts, cb) => {
            const b = Buffer.alloc(24);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(6, 2);
            b.writeUInt32LE(pixmap >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            b.writeUInt32LE((opts.size != null ? opts.size : opts.stride * opts.height) >>> 0, 12);
            b.writeUInt16LE(opts.width, 16);
            b.writeUInt16LE(opts.height, 18);
            b.writeUInt16LE(opts.stride, 20);
            b.writeUInt8(opts.depth, 22);
            b.writeUInt8(opts.bpp, 23);
            sendWithFds(b, [opts.fd], 'PixmapFromBuffer', cb);
        }

        // The reply carries the buffer's dma-buf fd — unreceivable.
        ext.BufferFromPixmap = (pixmap, cb) =>
            unreceivable('BufferFromPixmap',
                'Keep the buffer on the client side instead: create it yourself and ' +
                'import it with PixmapFromBuffer.', cb);

        // Create SYNC fence `fence` (a fresh XID) on `drawable`'s screen from
        // a poll-able fence fd (SyncFD). The fd is consumed.
        ext.FenceFromFD = (drawable, fence, initiallyTriggered, fd, cb) => {
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(fence >>> 0, 8);
            b.writeUInt8(initiallyTriggered ? 1 : 0, 12);
            // bytes 13..15 pad
            sendWithFds(b, [fd], 'FenceFromFD', cb);
        }

        ext.FDFromFence = (drawable, fence, cb) =>
            unreceivable('FDFromFence',
                'Create the fence from a client-side fd with FenceFromFD instead.', cb);

        // DRI3 1.2: which format modifiers the server can import for this
        // window (and for its screen as a whole) at depth/bpp.
        // cb(err, { windowModifiers: [BigInt], screenModifiers: [BigInt] })
        ext.GetSupportedModifiers = (window, depth, bpp, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt8(depth, 8);
            b.writeUInt8(bpp, 9);
            // bytes 10..11 pad
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const nWindow = buf.readUInt32LE(0);
                    const nScreen = buf.readUInt32LE(4);
                    const windowModifiers = [];
                    const screenModifiers = [];
                    let off = 24; // modifier lists start at byte 32 of the reply
                    for (let i = 0; i < nWindow; i++, off += 8)
                        windowModifiers.push(buf.readBigUInt64LE(off));
                    for (let i = 0; i < nScreen; i++, off += 8)
                        screenModifiers.push(buf.readBigUInt64LE(off));
                    return { windowModifiers, screenModifiers };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // DRI3 1.2: multi-planar/modifier-aware PixmapFromBuffer.
        // opts: { width, height, depth, bpp, modifier (BigInt|number),
        //         planes: [{ fd, stride, offset }] (1..4) }.
        // All plane fds are consumed. Use modifier ext.FormatModifier.Invalid
        // with a single plane for driver-negotiated ("implicit") layout.
        ext.PixmapFromBuffers = (pixmap, window, opts, cb) => {
            const planes = opts.planes;
            if (!planes || planes.length < 1 || planes.length > 4) {
                const err = new Error('DRI3: PixmapFromBuffers takes 1 to 4 planes');
                if (cb) return process.nextTick(() => cb(err));
                throw err;
            }
            const b = Buffer.alloc(64);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(16, 2);
            b.writeUInt32LE(pixmap >>> 0, 4);
            b.writeUInt32LE(window >>> 0, 8);
            b.writeUInt8(planes.length, 12);
            // bytes 13..15 pad
            b.writeUInt16LE(opts.width, 16);
            b.writeUInt16LE(opts.height, 18);
            for (let i = 0; i < 4; i++) {
                const p = planes[i];
                b.writeUInt32LE(p ? p.stride >>> 0 : 0, 20 + i * 8);
                b.writeUInt32LE(p ? (p.offset || 0) >>> 0 : 0, 24 + i * 8);
            }
            b.writeUInt8(opts.depth, 52);
            b.writeUInt8(opts.bpp, 53);
            // bytes 54..55 pad
            b.writeBigUInt64LE(toBigUInt64(opts.modifier), 56);
            sendWithFds(b, planes.map(p => p.fd), 'PixmapFromBuffers', cb);
        }

        ext.BuffersFromPixmap = (pixmap, cb) =>
            unreceivable('BuffersFromPixmap',
                'Keep the buffers on the client side instead: create them yourself and ' +
                'import them with PixmapFromBuffers.', cb);

        // DRI3 1.3: tell the server which DRM device (by dev_t major/minor)
        // this window's buffers will come from, so multi-GPU servers pick the
        // right import path. Void; check ext.minor >= 3 before using.
        ext.SetDRMDeviceInUse = (window, drmMajor, drmMinor, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(9, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(drmMajor >>> 0, 8);
            b.writeUInt32LE(drmMinor >>> 0, 12);
            if (cb) {
                X.replies[seq] = [null, e => { cb(e || null); return true; }];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // DRI3 1.4: import a DRM timeline syncobj (fd consumed) under a fresh
        // XID for explicit sync with Present; check ext.minor >= 4.
        ext.ImportSyncobj = (syncobj, drawable, fd, cb) => {
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(10, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(syncobj >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            sendWithFds(b, [fd], 'ImportSyncobj', cb);
        }

        ext.FreeSyncobj = (syncobj, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(11, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(syncobj >>> 0, 4);
            if (cb) {
                X.replies[seq] = [null, e => { cb(e || null); return true; }];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // Whether this connection can put descriptor-carrying requests on the
        // wire at all (local unix socket with the fd-capable transport).
        ext.fdCapable = !!(X.stream && X.stream._fdCapable &&
            typeof X.stream.sendFds === 'function');

        // the spec requires clients to negotiate the version before use
        ext.QueryVersion(1, 4, (e, vers) => {
            if (e)
                return callback(e);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
