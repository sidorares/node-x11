// http://www.x.org/releases/X11R7.6/doc/xcmiscproto/xc-misc.pdf

const x11 = require('..');
// TODO: move to templates

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('XC-MISC', (err, ext) => {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.QueryVersion = (clientMaj, clientMin, cb) => {
            X.seq_num++;
            X.pack_stream.pack('CCSSS', [ext.majorOpcode, 0, 2, clientMaj, clientMin]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const res = buf.unpack('SS');
                    return res;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.GetXIDRange = cb => {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 1, 1]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const res = buf.unpack('LL');
                    return {
                        startId: res[0],
                        count: res[1]
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.GetXIDList = (count, cb) => {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 2, 2, count]);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    const numIds = buf.unpack('L')[0];
                    const res = [];
                    for (let i = 0; i < numIds; ++i)
                        res.push(buf.unpack('L', 24+i*4));
                    return res;
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.QueryVersion(1, 1, (err, vers) => {
            if (err)
                return callback(err);
            ext.major = vers[0];
            ext.minor = vers[1];
            callback(null, ext);
        });
    });
}
