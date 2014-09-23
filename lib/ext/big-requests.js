// http://www.x.org/releases/X11R7.6/doc/bigreqsproto/bigreq.html

// TODO: move to templates
exports.requireExt = function(display, callback)
{
    var X = display.client;
    X.QueryExtension('BIG-REQUESTS', function(err, ext) {

        if (!ext.present)
            return callback(new Error('extension not available'));

        ext.Enable = function( cb )
        {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 0, 1]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    return buf.unpack('L')[0];
                },
                cb
            ];
            X.pack_stream.flush();
        }
        callback(null, ext);
    });
}
