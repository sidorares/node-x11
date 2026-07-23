// http://www.x.org/releases/X11R7.6/doc/bigreqsproto/bigreq.html

// TODO: move to templates
exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('BIG-REQUESTS', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.Enable = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => buf.readUInt32LE(0),
                cb
            ];
            X.pack_stream.flush();
        }
        callback(null, ext);
    });
}
