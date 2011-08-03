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
 
            var valueList = [ 
                ['repeat', 'C'],
                ['alphaMap', 'L'],
                ['alphaXOrigin', 's'],
                ['alphaYOrigin', 's'],
                ['clipMask', 'L'],
                ['graphicsExposures', 'C'],
                ['subwindowMode', 'C'],
                ['polyEdge', 'C'],
                ['polyMode', 'C'],
                ['dither', 'L'],
                ['componentAlpha', 'C']
            ];

            var argumentLength = {
                C: 1,
                S: 2,
                s: 2,
                L: 4,
                x: 1
            };

            function RenderCreatePicture(pid, drawable, pictformat, values)
            {
                X.seq_num++;
                var mask = 0;           
                var reqLen = 5; // + (values + pad)/4
                var format = 'CCSLLLL';
                var params = [ext.majorOpcode, 4, reqLen, pid, drawable, pictformat, mask];

                if (values)
                {
                    var valuesLength = 0;
                    for (var i=0; i < valueList.length; ++i)
                    {
                        var val = values[valueList[i][0]];
                        if (val) {
                            mask |= (1 << i);
                            params.push(val);
                            var valueFormat = valueList[i][1];
                            format += valueFormat;
                            valuesLength += argumentLength[valueFormat];
                        }
                    }
                    var pad4 = (valuesLength + 3) >> 2;
                    var toPad = (pad4 << 2) - valuesLength;
                    for (var i=0; i < toPad; ++i)
                        format += 'x';
                    reqLen += pad4;
                    params[2] = reqLen;
                    params[6] = mask;
                }
                console.log([format, params]);
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            }

            function floatToFix(f)
            {
                return parseInt(f*(1<<16));
            }

            function RenderLinearGradient(pid, p1, p2, stops)
            {
                X.seq_num++;
                var reqLen = 7+stops.length*3;  //header + params + 1xStopfix+2xColors
                var format = 'CCSLLLLLL';
                var params = [ext.majorOpcode, 34, reqLen, pid];
                params.push(floatToFix(p1[0])); // L
                params.push(floatToFix(p1[1]));
                params.push(floatToFix(p2[0]));
                params.push(floatToFix(p2[1])); // L

                params.push(stops.length);

                // [ [float stopDist, [float r, g, b, a] ], ...]
                // stop distances
                for (var i=0; i < stops.length; ++i)
                {
                    format += 'L';
                    // TODO: we know total params length in advance. ? params[index] = 
                    params.push(floatToFix(stops[i][0]))
                }
                // colors
                for (var i=0; i < stops.length; ++i)
                {
                    format += 'SSSS';
                    for (var j=0; j < 4; ++j)
                        params.push(stops[i][1][j]);
                }
		console.log([format, params]);
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();                
            }

            function RenderFillRectangles(op, pid, color, rects)
            {
                X.seq_num++;
                var reqLen = 5+rects.length*2; 
                var format = 'CCSCxxxLSSSS';
                var params = [ext.majorOpcode, 26, reqLen, op, pid];
                for (var j=0; j < 4; ++j)
                    params.push(color[j]);
                for (var i=0; i < rects.length; i+=4)
                {
                    format += 'ssSS';
                    params.push(rects[i*4]);
                    params.push(rects[i*4 + 1]);
                    params.push(rects[i*4 + 2]);
                    params.push(rects[i*4 + 3]);
                }
		console.log([format, params]);
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();                
            }

            //RenderQueryVersion(0,9, function(serverVersion) { console.log(serverVersion); });
            //RenderQueryFilters(function(resp) { console.log(resp); });
            
            var root = display.screen[0].root;
            var wid = X.AllocID();
            var white = display.screen[0].white_pixel;
            var black = display.screen[0].black_pixel;
            X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: white, eventMask: x11.eventMask.Exposure });
            var pid = X.AllocID();
            RenderCreatePicture(pid, wid, 71, { repeat: 1} ); 
            var pidGrad = X.AllocID();

            //RenderLinearGradient(pidGrad, [0,0], [100,100], [ [0, [0,0,0,0xffff]], [100, [0xffff, 0xffff, 0xffff, 0xffff]]]);

            X.MapWindow(wid);

            X.on('event', function(ev) {
                console.log(ev);
                //RenderFillRectangles(1, pid, [0, 0, 0, 0x8000], [0, 0, 400, 500]);
                RenderFillRectangles(1, pid, [0, 0x8000, 0, 0xffff], [100, 200, 400, 500]);
            });
        });
     }

).on('error', function(err) {
    console.log(err);
});
