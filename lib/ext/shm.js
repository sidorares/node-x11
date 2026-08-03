// MIT-SHM (shared memory) extension
// https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/shm.txt
// wire format: autogen/proto/shm.xml
//
// Two layers:
//   - the wire protocol (Attach/Detach/PutImage/GetImage/CreatePixmap,
//     AttachFd), and
//   - a high-level, provider-backed segment API (`usable`, `createSegment`)
//     with a built-in zero-dependency provider (see lib/shm-provider.js).
//
// The built-in provider is an unlinked /dev/shm file handed to the server with
// AttachFd (SHM 1.2), which needs an fd-capable local connection — see
// lib/fdpass.js. Node has no SysV shmget/shmat, so the classic Attach path
// still needs a caller-supplied provider (`createClient({ shm: provider })`);
// that same seam takes an mmap/koffi provider for zero-copy.
//
// CreateSegment (minor opcode 7, the server-allocates-and-returns-an-fd
// variant) is deliberately NOT implemented: receiving a regular-file fd over a
// libuv-read socket aborts the Node process (SIGABRT). AttachFd sends only.

const { EventEmitter } = require('events');
const { createBuiltinProvider } = require('../shm-provider');

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('MIT-SHM', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        // image formats (core protocol values, used by PutImage/GetImage)
        ext.ImageFormat = {
            XYBitmap: 0,
            XYPixmap: 1,
            ZPixmap: 2
        };

        ext.QueryVersion = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        sharedPixmaps: !!opt,
                        majorVersion: buf.readUInt16LE(0),
                        minorVersion: buf.readUInt16LE(2),
                        uid: buf.readUInt16LE(4),
                        gid: buf.readUInt16LE(6),
                        pixmapFormat: buf.readUInt8(8)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // shmseg: client-allocated XID (X.AllocID()), shmid: SysV segment id.
        // A void request: with `cb` it fires cb(null) once the server has
        // processed it (forced by a round trip) or cb(err) if it errored — an
        // attach can fail server-side (BadAccess) even with a valid XID.
        ext.Attach = (shmseg, shmid, readOnly, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(shmseg >>> 0, 4);
            b.writeUInt32LE(shmid >>> 0, 8);
            b.writeUInt8(readOnly ? 1 : 0, 12);
            if (cb) {
                X.replies[seq] = [null, cb];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.Detach = (shmseg, cb) => {
            X.seq_num++;
            const seq = X.seq_num;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(shmseg >>> 0, 4);
            if (cb) {
                X.replies[seq] = [null, cb];
                X._scheduleVoidSync(seq);
            }
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // img: { totalWidth, totalHeight, srcX, srcY, srcWidth, srcHeight,
        //        dstX, dstY, depth, format, sendEvent, shmseg, offset }
        // If sendEvent is true the server sends a ShmCompletion event when
        // it has finished reading the segment.
        ext.PutImage = (drawable, gc, img) => {
            X.seq_num++;
            const b = Buffer.alloc(40);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(10, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(gc >>> 0, 8);
            b.writeUInt16LE(img.totalWidth, 12);
            b.writeUInt16LE(img.totalHeight, 14);
            b.writeUInt16LE(img.srcX, 16);
            b.writeUInt16LE(img.srcY, 18);
            b.writeUInt16LE(img.srcWidth, 20);
            b.writeUInt16LE(img.srcHeight, 22);
            b.writeInt16LE(img.dstX, 24);
            b.writeInt16LE(img.dstY, 26);
            b.writeUInt8(img.depth, 28);
            b.writeUInt8(img.format, 29);
            b.writeUInt8(img.sendEvent ? 1 : 0, 30);
            b.writeUInt32LE(img.shmseg >>> 0, 32);
            b.writeUInt32LE(img.offset >>> 0, 36);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // The image data is written into the shared segment at `offset`;
        // the reply only carries depth/visual/size.
        ext.GetImage = (drawable, x, y, width, height, planeMask, format, shmseg, offset, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(32);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(8, 2);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeInt16LE(x, 8);
            b.writeInt16LE(y, 10);
            b.writeUInt16LE(width, 12);
            b.writeUInt16LE(height, 14);
            b.writeUInt32LE(planeMask >>> 0, 16);
            b.writeUInt8(format, 20);
            b.writeUInt32LE(shmseg >>> 0, 24);
            b.writeUInt32LE(offset >>> 0, 28);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        depth: opt,
                        visual: buf.readUInt32LE(0),
                        size: buf.readUInt32LE(4)
                    };
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // pid: client-allocated pixmap XID backed by the shared segment
        ext.CreatePixmap = (pid, drawable, width, height, depth, shmseg, offset) => {
            X.seq_num++;
            const b = Buffer.alloc(28);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(7, 2);
            b.writeUInt32LE(pid >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            b.writeUInt16LE(width, 12);
            b.writeUInt16LE(height, 14);
            b.writeUInt8(depth, 16);
            b.writeUInt32LE(shmseg >>> 0, 20);
            b.writeUInt32LE(offset >>> 0, 24);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // AttachFd (minor opcode 6, SHM 1.2). The descriptor travels as
        // SCM_RIGHTS ancillary data, not in the request body, so it needs an
        // fd-capable connection (a local unix socket built through
        // lib/fdpass.js). `fd` must be a regular-file/memfd descriptor the
        // caller keeps owning.
        //
        // Ordering matters: this writes out of band, past the request buffer,
        // so it must be issued at a quiescent point — no other request may be
        // issued between AttachFd(...) and its callback, or wire order and
        // sequence numbers would disagree. `createSegment` below observes this.
        // The reverse-direction CreateSegment (opcode 7) is deliberately absent
        // — see the note at the top of this file.
        ext.AttachFd = (shmseg, fd, readOnly, cb) => {
            const socket = X.stream;
            if (!socket || !socket._fdCapable || typeof socket.sendFd !== 'function') {
                const err = new Error('MIT-SHM: AttachFd needs an fd-capable local connection');
                if (cb) return process.nextTick(() => cb(err));
                throw err;
            }
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);              // AttachFd minor opcode
            b.writeUInt16LE(3, 2);          // length, 4-byte units
            b.writeUInt32LE(shmseg >>> 0, 4);
            b.writeUInt8(readOnly ? 1 : 0, 8);
            // bytes 9..11 are pad (already zero)
            X.seq_num++;                    // reserve the sequence now
            const seq = X.seq_num;
            if (cb)
                X.replies[seq] = [null, cb];
            // Flush queued requests to the wire first, then hand the fd to the
            // same socket handle so it is ordered strictly after them.
            X.flush(() => {
                socket.sendFd(b, fd, sendErr => {
                    if (sendErr) {
                        if (X.replies[seq]) delete X.replies[seq];
                        if (cb) cb(sendErr);
                        return;
                    }
                    // AttachFd is void: force a round trip so a success is
                    // confirmed and any error has arrived before cb fires.
                    if (cb) X.GetInputFocus(() => true);
                });
            });
        }

        ext.events = {
            ShmCompletion: 0
        };

        X.eventParsers[ext.firstEvent + ext.events.ShmCompletion] = (type, seq, extra, code, raw) => {
            const event = {};
            event.name = 'ShmCompletion';
            event.type = type;
            event.seq = seq;
            event.drawable = extra;
            event.minorEvent = raw.readUInt16LE(0);
            event.majorEvent = raw.readUInt8(2);
            event.shmseg = raw.readUInt32LE(4);
            event.offset = raw.readUInt32LE(8);
            return event;
        };

        ext.errors = {
            BadSeg: 0
        };

        X.errorParsers[ext.firstError + ext.errors.BadSeg] = err => {
            err.message = 'MIT-SHM: SEG argument does not name a defined shared memory segment';
        };

        // ---- high-level, provider-backed segment API ----
        //
        // A "provider" turns a byte size into an attachable shared segment and
        // moves bytes in and out of it (see lib/shm-provider.js for the
        // contract). The built-in one is pure Node; supply your own with
        // createClient({ shm: provider }) for zero-copy (mmap/koffi) or SysV
        // ('shmid') segments. `ext.provider` is resolved once below, after
        // QueryVersion, so it can gate on the negotiated version.

        ext._segments = {}; // shmseg XID -> segment object (ShmCompletion routing)

        // Attach a provider segment under a fresh XID via the request that fits
        // the provider's flavor. cb(err|null).
        const attachSegment = (xid, seg, readOnly, cb) => {
            if (ext.provider && ext.provider.flavor === 'shmid')
                ext.Attach(xid, seg.shmid, readOnly, err => { cb(err || null); return true; });
            else
                ext.AttachFd(xid, seg.fd, readOnly, err => { cb(err || null); return true; });
        };

        const makeSegment = (xid, seg) => {
            const api = new EventEmitter();
            api.shmseg = xid;
            api.size = seg.size;
            // Render pixels here. With the built-in provider this is a plain JS
            // buffer that commit() copies into the segment; with a zero-copy
            // provider it aliases the server's memory and commit() is a no-op.
            api.buffer = seg.buffer;
            api.zeroCopy = !!ext.provider.zeroCopy;

            api.commit = (offset, length) => ext.provider.commit(seg, offset, length);
            api.readback = (offset, length) => ext.provider.sync(seg, offset, length);

            // opts: { width, height, depth, format?, srcX?, srcY?, srcWidth?,
            //   srcHeight?, dstX?, dstY?, offset?, totalWidth?, totalHeight?,
            //   sendEvent?, autoCommit? }. Commits the buffer to the segment
            //   first unless autoCommit === false.
            api.putImage = (drawable, gc, opts) => {
                const offset = opts.offset || 0;
                if (opts.autoCommit !== false)
                    api.commit(offset);
                ext.PutImage(drawable, gc, {
                    totalWidth: opts.totalWidth != null ? opts.totalWidth : opts.width,
                    totalHeight: opts.totalHeight != null ? opts.totalHeight : opts.height,
                    srcX: opts.srcX || 0,
                    srcY: opts.srcY || 0,
                    srcWidth: opts.srcWidth != null ? opts.srcWidth : opts.width,
                    srcHeight: opts.srcHeight != null ? opts.srcHeight : opts.height,
                    dstX: opts.dstX || 0,
                    dstY: opts.dstY || 0,
                    depth: opts.depth,
                    format: opts.format != null ? opts.format : ext.ImageFormat.ZPixmap,
                    sendEvent: !!opts.sendEvent,
                    shmseg: xid,
                    offset
                });
            };

            // Read pixels into the segment, then into api.buffer.
            // cb(err, { depth, visual, size }).
            api.getImage = (drawable, x, y, width, height, planeMask, format, offset, cb) => {
                offset = offset || 0;
                ext.GetImage(drawable, x, y, width, height, planeMask >>> 0,
                    format != null ? format : ext.ImageFormat.ZPixmap, xid, offset, (err, rep) => {
                        if (err) return cb(err);
                        api.readback(offset, rep.size);
                        cb(null, rep);
                    });
            };

            api.detach = cb => {
                delete ext._segments[xid];
                ext.Detach(xid, () => {
                    try { ext.provider.destroy(seg); } catch { /* ignore */ }
                    X.ReleaseID(xid);
                    if (cb) cb();
                    return true;
                });
            };

            ext._segments[xid] = api;
            return api;
        };

        // Create and attach a shared segment of `size` bytes.
        // cb(err, segment). Fails (never throws) when no provider is usable, so
        // callers can fall back to core PutImage/GetImage.
        ext.createSegment = (size, cb) => {
            if (!ext.provider)
                return process.nextTick(() => cb(new Error('MIT-SHM: no usable shared-memory provider')));
            let seg;
            try {
                seg = ext.provider.create(size);
            } catch (err) {
                return process.nextTick(() => cb(err));
            }
            const xid = X.AllocID();
            attachSegment(xid, seg, false, err => {
                if (err) {
                    try { ext.provider.destroy(seg); } catch { /* ignore */ }
                    X.ReleaseID(xid);
                    return cb(err);
                }
                cb(null, makeSegment(xid, seg));
            });
        };

        // Behavioral probe. The extension being present — even reporting 1.2 —
        // does not mean a segment will attach: remote servers advertise it and
        // then reject everything, and containers/permissions block it locally.
        // The only reliable test is to attach one and round-trip. Cached.
        // cb(null, boolean); false just means "no shared-memory fast path".
        ext.usable = cb => {
            if (ext._usable !== undefined)
                return process.nextTick(() => cb(null, ext._usable));
            if (!ext.provider) {
                ext._usable = false;
                return process.nextTick(() => cb(null, false));
            }
            let seg;
            try {
                seg = ext.provider.create(4096);
            } catch {
                ext._usable = false;
                return process.nextTick(() => cb(null, false));
            }
            const xid = X.AllocID();
            const finish = ok => {
                try { ext.provider.destroy(seg); } catch { /* ignore */ }
                X.ReleaseID(xid);
                ext._usable = ok;
                cb(null, ok);
            };
            attachSegment(xid, seg, false, err => {
                if (err) return finish(false);
                ext.Detach(xid);
                finish(true);
            });
        };

        ext.QueryVersion((err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers.majorVersion;
            ext.minor = vers.minorVersion;
            ext.sharedPixmaps = vers.sharedPixmaps;
            ext.pixmapFormat = vers.pixmapFormat;
            ext.uid = vers.uid;
            ext.gid = vers.gid;

            // Whether the connection can pass descriptors (needed for the fd
            // flavor), and whether the server speaks SHM 1.2 (AttachFd).
            ext.fdCapable = !!(X.stream && X.stream._fdCapable);
            const serverHasFd = ext.major > 1 || (ext.major === 1 && ext.minor >= 2);

            // Resolve the provider once. options.shm:
            //   undefined / anything truthy non-object -> built-in provider
            //   false / 'off'                          -> disabled
            //   <object>                               -> caller-supplied
            const opt = X.options.shm;
            ext.provider = null;
            if (opt !== false && opt !== 'off') {
                if (opt && typeof opt === 'object') {
                    const flavor = opt.flavor || 'fd';
                    if (flavor !== 'fd' || (serverHasFd && ext.fdCapable))
                        ext.provider = opt;
                } else if (serverHasFd && ext.fdCapable) {
                    ext.provider = createBuiltinProvider();
                }
            }

            // Route ShmCompletion events to the segment that issued them, so a
            // caller can reuse a segment's buffer only once the server is done
            // reading it (segment.on('complete', ...)).
            X.on('event', ev => {
                if (ev.name === 'ShmCompletion') {
                    const s = ext._segments[ev.shmseg];
                    if (s) s.emit('complete', ev.offset, ev);
                }
            });

            callback(null, ext);
        });
    });
}
