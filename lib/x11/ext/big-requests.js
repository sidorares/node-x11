// http://www.x.org/releases/X11R7.6/doc/bigreqsproto/bigreq.html

// TODO: move to templates
exports.requireExt = function(display, callback) 
{
    var X = display.client;
    X.QueryExtension('BIG_REQUESTS', function(ext) {  

        if (!ext.present)
            callback(new Error('extension not available'));

        ext.Enable = function( callback )
        {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 0, 1]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    // max packet size in reply
                    console.log([buf, opt]);
                },
                callback
            ];
            X.pack_stream.flush();
        }

        callback(ext);
    });
}
