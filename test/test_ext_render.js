var x11 = require('../lib/x11');

// adding XRender functions manually from
//     http://cgit.freedesktop.org/xcb/proto/tree/src/render.xml?id=HEAD
// and http://www.x.org/releases/X11R7.6/doc/renderproto/renderproto.txt
// TODO: move to templates
x11.createClient(
    function(display) {
        var X = display.client;
        X.QueryExtension('RENDER', function(ext) {          

            function RenderQueryVersion(clientMaj, clientMin, callback)
            {
                X.seq_num++;
                X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 3, clientMaj, clientMin]);
                X.replies[X.seq_num] = [
                    function(buf, opt) {
                        var res = buf.unpack('LL');                 
                        return res;
                    },
                    callback
                ];
                X.pack_stream.flush();
            }
             
            function RenderQueryFilters(callback)
            {
                X.seq_num++;
                X.pack_stream.pack('CCSL', [ext.majorOpcode, 29, 2, display.screen[0].root]);
                X.replies[X.seq_num] = [
                    function(buf, opt) {
                        var h = buf.unpack('LL');                 
                        var num_aliases = h[0];
                        var num_filters = h[1];
                        var aliases = [];
                        var offset = 24; // LL + 16 bytes pad
                        for (var i=0; i < num_aliases; ++i)
                        {
                            aliases.push(buf.unpack('S', offset)[0]);
                            offset+=2;
                        }
                        var filters = [];
                        for (var i=0; i < num_filters; ++i)
                        {
                            var len = buf.unpack('C', offset)[0];
                            //if (!len) break;
                            offset++;
                            filters.push(buf.toString('ascii', offset, offset+len));
                            offset+=len;
                        }
                        return [aliases, filters];
                    },
                    callback
                ];
                X.pack_stream.flush();
            }

            RenderQueryVersion(0,9, function(serverVersion) { console.log(serverVersion); });
            RenderQueryFilters(function(resp) { console.log(resp); });
             
        });
     }

).on('error', function(err) {
    console.log(err);
});
