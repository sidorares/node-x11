// http://www.x.org/releases/X11R7.6/doc/xextproto/dpms.txt

const x11 = require('..');
const dpmsReplies = require('../generated/dpms-replies');

// Reply unpackers generated from autogen/proto/dpms.xml; return arrays for API compat.
exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('DPMS', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.GetVersion = (clientMaj, clientMin, callback) => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(clientMaj, 4);
            b.writeUInt16LE(clientMin, 6);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                buf => {
                    const r = dpmsReplies.GetVersion(buf);
                    return [r.serverMajorVersion, r.serverMinorVersion];
                },
                callback
            ];
            X.pack_stream.flush();
        };

        ext.Capable = callback => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                buf => [dpmsReplies.Capable(buf).capable],
                callback
            ];
            X.pack_stream.flush();
        };

        ext.GetTimeouts = callback => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                buf => {
                    const r = dpmsReplies.GetTimeouts(buf);
                    return [r.standbyTimeout, r.suspendTimeout, r.offTimeout];
                },
                callback
            ];
            X.pack_stream.flush();
        };

        ext.SetTimeouts = (standby_t, suspend_t, off_t) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt16LE(standby_t, 4);
            b.writeUInt16LE(suspend_t, 6);
            b.writeUInt16LE(off_t, 8);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.Enable = () => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(4, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.Disable = () => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(5, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.ForceLevel = // 0 : On, 1 : Standby, 2 : Suspend, 3 : Off
        level => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt16LE(level, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        };

        ext.Info = callback => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(7, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                buf => {
                    const r = dpmsReplies.Info(buf);
                    return [r.powerLevel, r.state];
                },
                callback
            ];
            X.pack_stream.flush();
        };

        callback(null, ext);
    });
};
