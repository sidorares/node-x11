// DOUBLE-BUFFER (DBE) extension protocol, version 1.0
// https://xorg.freedesktop.org/releases/X11R7.7/doc/xextproto/dbe.txt

// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('DOUBLE-BUFFER', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.SwapAction = {
            Undefined: 0,
            Background: 1,
            Untouched: 2,
            Copied: 3
        };

        ext.GetVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt8(clientMaj, 4);
            b.writeUInt8(clientMin, 5);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => [buf.readUInt8(0), buf.readUInt8(1)],
                cb
            ];
            X.pack_stream.submit(true);
        }

        // Associate `backBuffer` (a fresh XID) with the back buffer of `window`.
        // The back buffer is a drawable and can be used with core drawing requests.
        ext.AllocateBackBufferName = (window, backBuffer, swapActionHint) => {
            X.seq_num++;
            const b = Buffer.alloc(16);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(4, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(backBuffer >>> 0, 8);
            b.writeUInt8(swapActionHint, 12);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.DeallocateBackBufferName = backBuffer => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(backBuffer >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // swapInfos: array of { window: WINDOW, swapAction: ext.SwapAction.* }
        ext.SwapBuffers = swapInfos => {
            X.seq_num++;
            const n = swapInfos.length;
            const b = Buffer.alloc(8 + n * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(2 + 2 * n, 2);
            b.writeUInt32LE(n, 4);
            let off = 8;
            swapInfos.forEach(info => {
                b.writeUInt32LE(info.window >>> 0, off);
                b.writeUInt8(info.swapAction, off + 4);
                off += 8;
            });
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.BeginIdiom = () => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        ext.EndIdiom = () => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.pack_stream.submit();
        }

        // drawables: array of screen specifiers (any drawable per screen, e.g. root windows).
        // Callback gets an array (one entry per drawable) of arrays of
        // { visual, depth, perfLevel } describing double-buffer capable visuals.
        ext.GetVisualInfo = (drawables, cb) => {
            X.seq_num++;
            const n = drawables.length;
            const b = Buffer.alloc(8 + n * 4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(2 + n, 2);
            b.writeUInt32LE(n, 4);
            drawables.forEach((drawable, i) => {
                b.writeUInt32LE(drawable >>> 0, 8 + i * 4);
            });
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const m = buf.readUInt32LE(0);
                    const screens = [];
                    let off = 24;
                    for (let i = 0; i < m; ++i) {
                        const count = buf.readUInt32LE(off);
                        off += 4;
                        const visuals = [];
                        for (let j = 0; j < count; ++j) {
                            visuals.push({
                                visual: buf.readUInt32LE(off),
                                depth: buf.readUInt8(off + 4),
                                perfLevel: buf.readUInt8(off + 5)
                            });
                            off += 8;
                        }
                        screens.push(visuals);
                    }
                    return screens;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.GetBackBufferAttributes = (backBuffer, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(backBuffer >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                // BUFFER_ATTRIBUTES: the window this back buffer belongs to
                // (None if the window was destroyed)
                (buf, opt) => ({ window: buf.readUInt32LE(0) }),
                cb
            ];
            X.pack_stream.submit(true);
        }

        // The spec requires GetVersion to be issued before any other DBE request
        ext.GetVersion(1, 0, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
