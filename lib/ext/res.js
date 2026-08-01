// X-Resource extension protocol, version 1.2
// https://xorg.freedesktop.org/releases/X11R7.7/doc/resourceproto/resproto.txt
// wire format: autogen/proto/res.xml (v1.0) + xcb-proto res.xml (v1.2)

// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('X-Resource', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.ClientIdMask = {
            ClientXID: 1,
            LocalClientPID: 2
        };

        ext.QueryVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt8(clientMaj, 4);
            b.writeUInt8(clientMin, 5);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => [buf.readUInt16LE(0), buf.readUInt16LE(2)],
                cb
            ];
            X.pack_stream.submit(true);
        }

        // Lists all connected clients as { resourceBase, resourceMask } XID ranges
        ext.QueryClients = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numClients = buf.readUInt32LE(0);
                    const clients = [];
                    for (let i = 0; i < numClients; ++i) {
                        const off = 24 + i * 8;
                        clients.push({
                            resourceBase: buf.readUInt32LE(off),
                            resourceMask: buf.readUInt32LE(off + 4)
                        });
                    }
                    return clients;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // xid: any XID in the client's resource range. Returns a list of
        // { resourceType (atom), count } for each resource type the client owns.
        ext.QueryClientResources = (xid, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(xid >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numTypes = buf.readUInt32LE(0);
                    const types = [];
                    for (let i = 0; i < numTypes; ++i) {
                        const off = 24 + i * 8;
                        types.push({
                            resourceType: buf.readUInt32LE(off),
                            count: buf.readUInt32LE(off + 4)
                        });
                    }
                    return types;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        // Estimated pixmap memory usage of the client owning `xid`, in bytes.
        // The 64-bit bytes/bytesOverflow pair is composed into a plain JS number,
        // exact only up to 2^53 - 1 bytes.
        ext.QueryClientPixmapBytes = (xid, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(xid >>> 0, 4);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(4) * 0x100000000 + buf.readUInt32LE(0),
                cb
            ];
            X.pack_stream.submit(true);
        }

        // Since 1.2. specs: array of { client: XID or 0 (all clients),
        // mask: SETof ext.ClientIdMask or 0 (all methods) }.
        // Callback gets an array of { client, mask, value } where value is a
        // list of CARD32s (a single PID for LocalClientPID, empty for ClientXID).
        ext.QueryClientIds = (specs, cb) => {
            X.seq_num++;
            const n = specs.length;
            const b = Buffer.alloc(8 + n * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(2 + 2 * n, 2);
            b.writeUInt32LE(n, 4);
            specs.forEach((spec, i) => {
                b.writeUInt32LE(spec.client >>> 0, 8 + i * 8);
                b.writeUInt32LE(spec.mask >>> 0, 12 + i * 8);
            });
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numIds = buf.readUInt32LE(0);
                    const ids = [];
                    let off = 24;
                    for (let i = 0; i < numIds; ++i) {
                        const id = {
                            client: buf.readUInt32LE(off),
                            mask: buf.readUInt32LE(off + 4),
                            value: []
                        };
                        const length = buf.readUInt32LE(off + 8); // in bytes
                        off += 12;
                        for (let j = 0; j < length >> 2; ++j) {
                            id.value.push(buf.readUInt32LE(off));
                            off += 4;
                        }
                        ids.push(id);
                    }
                    return ids;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        const parseResourceSizeSpec = (buf, off) => ({
            resource: buf.readUInt32LE(off),
            type: buf.readUInt32LE(off + 4),
            bytes: buf.readUInt32LE(off + 8),
            refCount: buf.readUInt32LE(off + 12),
            useCount: buf.readUInt32LE(off + 16)
        });

        // Since 1.2. client: XID of a client to restrict the query to, or 0.
        // specs: array of { resource: XID or 0 (all), type: atom or 0 (any type) }.
        // Callback gets an array of size records; each has the fields of the
        // main resource ({ resource, type, bytes, refCount, useCount }) plus
        // crossReferences: a list of the same shape for referenced resources.
        ext.QueryResourceBytes = (client, specs, cb) => {
            X.seq_num++;
            const n = specs.length;
            const b = Buffer.alloc(12 + n * 8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(3 + 2 * n, 2);
            b.writeUInt32LE(client >>> 0, 4);
            b.writeUInt32LE(n, 8);
            specs.forEach((spec, i) => {
                b.writeUInt32LE(spec.resource >>> 0, 12 + i * 8);
                b.writeUInt32LE(spec.type >>> 0, 16 + i * 8);
            });
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numSizes = buf.readUInt32LE(0);
                    const sizes = [];
                    let off = 24;
                    for (let i = 0; i < numSizes; ++i) {
                        const size = parseResourceSizeSpec(buf, off);
                        const numCrossReferences = buf.readUInt32LE(off + 20);
                        off += 24;
                        size.crossReferences = [];
                        for (let j = 0; j < numCrossReferences; ++j) {
                            size.crossReferences.push(parseResourceSizeSpec(buf, off));
                            off += 20;
                        }
                        sizes.push(size);
                    }
                    return sizes;
                },
                cb
            ];
            X.pack_stream.submit(true);
        }

        ext.QueryVersion(1, 2, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
