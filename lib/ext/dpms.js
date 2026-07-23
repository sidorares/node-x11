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
            X.pack_stream.pack('CCSSS', [ext.majorOpcode, 0, 2, clientMaj, clientMin]);
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
            X.pack_stream.pack('CCS', [ext.majorOpcode, 1, 1]);
            X.replies[X.seq_num] = [
                buf => [dpmsReplies.Capable(buf).capable],
                callback
            ];
            X.pack_stream.flush();
        };

        ext.GetTimeouts = callback => {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 2, 1]);
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
            X.pack_stream.pack('CCSSSSxx', [ext.majorOpcode, 3, 3, standby_t, suspend_t, off_t]);
            X.pack_stream.flush();
        };

        ext.Enable = () => {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 4, 1]);
            X.pack_stream.flush();
        };

        ext.Disable = () => {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 5, 1]);
            X.pack_stream.flush();
        };

        ext.ForceLevel = // 0 : On, 1 : Standby, 2 : Suspend, 3 : Off
        level => {
            X.seq_num++;
            X.pack_stream.pack('CCSSxx', [ext.majorOpcode, 6, 2, level]);
            X.pack_stream.flush();
        };

        ext.Info = callback => {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 7, 1]);
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
