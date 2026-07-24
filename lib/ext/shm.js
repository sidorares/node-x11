// MIT-SHM (shared memory) extension
// https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/shm.txt
// wire format: autogen/proto/shm.xml
//
// NOTE: Node.js has no built-in binding to SysV shared memory (shmget/shmat),
// and the zero-runtime-dependency rule rules out native addons, so this module
// only implements the wire protocol; creating/attaching real segments is up to
// the caller (e.g. via an optional native module providing a shmid).
//
// AttachFd (minor opcode 6, SHM 1.2) is NOT implemented: it requires passing
// a file descriptor over the unix socket with SCM_RIGHTS ancillary data,
// which plain Node net.Socket cannot do.

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
            X.pack_stream.flush();
        }

        // shmseg: client-allocated XID (X.AllocID()), shmid: SysV segment id
        ext.Attach = (shmseg, shmid, readOnly) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(shmseg >>> 0, 4);
            b.writeUInt32LE(shmid >>> 0, 8);
            b.writeUInt8(readOnly ? 1 : 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.Detach = shmseg => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(shmseg >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
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
            X.pack_stream.flush();
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
            X.pack_stream.flush();
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
            X.pack_stream.flush();
        }

        // AttachFd (minor opcode 6): intentionally not implemented, see note
        // at the top of this file.

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

        ext.QueryVersion((err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers.majorVersion;
            ext.minor = vers.minorVersion;
            ext.sharedPixmaps = vers.sharedPixmaps;
            ext.pixmapFormat = vers.pixmapFormat;
            ext.uid = vers.uid;
            ext.gid = vers.gid;
            callback(null, ext);
        });
    });
}
