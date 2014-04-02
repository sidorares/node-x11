var x11 = require('..');
var xutil = require('../xutil');

// adding XRender functions manually from
//     http://cgit.freedesktop.org/xcb/proto/tree/src/render.xml?id=HEAD
// and http://www.x.org/releases/X11R7.6/doc/renderproto/renderproto.txt
// TODO: move to templates
exports.requireExt = function(display, callback)
{

        var X = display.client;
        X.QueryExtension('RENDER', function(err, ext) {

            if (!ext.present)
            {
                return callback(new Error('extension not available'));
            }

            ext.QueryVersion = function(clientMaj, clientMin, callback)
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

            ext.QueryPictFormat = function(callback)
            {
                X.seq_num++;
                X.pack_stream.pack('CCS', [ext.majorOpcode, 1, 1]);
                X.replies[X.seq_num] = [
                    function (buf, opt) {
                        var res = {};
                        var res1 = buf.unpack('LLLLL');
                        var num_formats = res1[0];
                        var num_screens = res1[1];
                        var num_depths = res1[2];
                        var num_visuals = res1[3];
	                var num_subpixel = res1[4];
                        // formats list:
                        var offset = 24;
                        res.formats = [];
                        for (var i=0; i < num_formats; ++i)
                        {
                            var format = {};
                            var f = buf.unpack('LCCxxSSSSSSSSL', offset);
                            res.formats.push(f);
                            offset += 28;
                        }
                        return res;
                    },
                    callback
                ];
                X.pack_stream.flush();
            }

            ext.QueryFilters = function(callback)
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
                ['repeat', 'Cxxx'],
                ['alphaMap', 'L'],
                ['alphaXOrigin', 'sxx'],
                ['alphaYOrigin', 'sxx'],
                ['clipXOrigin', 'sxx'],
                ['clipYOrigin', 'sxx'],
                ['clipMask', 'L'],
                ['graphicsExposures', 'Cxxx'],
                ['subwindowMode', 'Cxxx'],
                ['polyEdge', 'Cxxx'],
                ['polyMode', 'Cxxx'],
                ['dither', 'L'],
                ['componentAlpha', 'Cxxx']
            ];

            var argumentLength = {
                C: 1,
                S: 2,
                s: 2,
                L: 4,
                x: 1
            };

            ext.CreatePicture = function(pid, drawable, pictformat, values)
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
                        var name = valueList[i][0];
                        var val = values[name];
                        if (val) {
                            mask |= (1 << i);
                            params.push(val);
                            var valueFormat = valueList[i][1];
                            format += valueFormat;
                            valuesLength += 4; //argumentLength[valueFormat];
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
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            }

            function floatToFix(f)
            {
                return parseInt(f*65536);
            }

            // see example of blur filter here: https://github.com/richoH/rxvt-unicode/blob/master/src/background.C
            // TODO: not ready yet.
            ext.SetPictureFilter = function(pid, name, filterParams)
            {
                X.seq_num++;
                var reqLen = 2;  //header + params + 1xStopfix+2xColors
                var format = 'CCSLa';
                var params = [ext.majorOpcode, 30, reqLen, pid];
                /*
                if (name == 'convolution')
                {
                    reqLen += 2;
                    format += 'L';
                    params.push(floatToFix(filterParams));
                } else {
                    throw 'Not implemented filter ' + name;
                }
                */
                params[2] = reqLen;
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            };

            ext.CreateSolidFill = function(pid, r, g, b, a)
            {
                X.seq_num++;
                X.pack_stream.pack('CCSLSSSS', [ext.majorOpcode, 33, 4, pid, floatToFix(r), floatToFix(g), floatToFix(b), floatToFix(a)]);
                X.pack_stream.flush();
            };

            ext.RadialGradient = function(pid, p1, p2, r1, r2, stops)
            {
                // TODO: merge with linear gradient
                X.seq_num++;
                var reqLen = 9+stops.length*3;  //header + params + 1xStopfix+2xColors
                var format = 'CCSLLLLLLLL';
                var params = [ext.majorOpcode, 35, reqLen, pid];
                params.push(floatToFix(p1[0])); // L
                params.push(floatToFix(p1[1]));
                params.push(floatToFix(p2[0]));
                params.push(floatToFix(p2[1])); // L
                params.push(floatToFix(r1)); // L
                params.push(floatToFix(r2)); // L
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
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            };

            ext.LinearGradient = function(pid, p1, p2, stops)
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
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            }

            ext.ConicalGradient = function(pid, center, angle, stops)
            {
                X.seq_num++;
                var reqLen = 6+stops.length*3;  //header + params + 1xStopfix+2xColors
                var format = 'CCSLLLLL';
                var params = [ext.majorOpcode, 36, reqLen, pid];
                params.push(floatToFix(center[0])); // L
                params.push(floatToFix(center[1]));
                params.push(floatToFix(angle)); // L

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
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            }

            ext.FillRectangles = function(op, pid, color, rects)
            {
                X.seq_num++;
                var reqLen = 5+rects.length/2;
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
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            }

            ext.Composite = function(op, src, mask, dst, srcX, srcY, maskX, maskY, dstX, dstY, width, height)
            {
                X.seq_num++;
                X.pack_stream.pack(
                    'CCSCxxxLLLssssssSS',
                    [ext.majorOpcode, 8, 9, op, src, mask, dst, srcX, srcY, maskX, maskY, dstX, dstY, width, height]
                )
                .flush();
            }

            ext.Trapezoids = function(op, src, srcX, srcY, dst, maskFormat, trapz)
            {
                X.seq_num++;
                var format = 'CCSCxxxLLLss';
                var params = [ext.majorOpcode, 10, 6+trapz.length, op, src, dst, maskFormat, srcX, srcY];
                for (var i=0; i < trapz.length; i+=10)
                {
                    format += 'llllllllll';
                    for (var j=0; j < 10; ++j)
                        params.push(floatToFix(trapz[i*10 + j]));
                }
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            }

            ext.Triangles = function(op, src, srcX, srcY, dst, maskFormat, tris)
            {
                X.seq_num++;
                var format = 'CCSCxxxLLLss';
                var params = [ext.majorOpcode, 11, 6+tris.length, op, src, dst, maskFormat, srcX, srcY];
                for (var i=0; i < tris.length; i+=6)
                {
                    format += 'llllll';
                    //TODO: Array.copy
                    params.push(floatToFix(tris[i*6 + 0])); // x1
                    params.push(floatToFix(tris[i*6 + 1])); // y1
                    params.push(floatToFix(tris[i*6 + 2])); // x2
                    params.push(floatToFix(tris[i*6 + 3])); // y2
                    params.push(floatToFix(tris[i*6 + 4])); // x3
                    params.push(floatToFix(tris[i*6 + 5])); // y3
                }
                X.pack_stream.pack(format, params);
                X.pack_stream.flush();
            }

            ext.CreateGlyphSet = function(gsid, format) {
                X.seq_num++;
                X.pack_stream.pack('CCSLL', [ext.majorOpcode, 17, 3, gsid, format]);
                X.pack_stream.flush();
            }

            ext.ReferenceGlyphSet = function(gsid, existing) {
                X.seq_num++;
                X.pack_stream.pack('CCSLL', [ext.majorOpcode, 18, 3, gsid, existing]);
                X.pack_stream.flush();
            }

            ext.FreeGlyphSet = function(gsid) {
                X.seq_num++;
                X.pack_stream.pack('CCSL', [ext.majorOpcode, 19, 2, gsid]);
                X.pack_stream.flush();
            }

            ext.AddGlyphs = function(gsid, glyphs) {
                X.seq_num++;
                var numGlyphs = glyphs.length;
                var imageBytes = 0;
                var glyphPaddedLength;
                var glyphLength;
                for (var i = 0; i < numGlyphs; i++) {
                  glyphLength = glyphs[i].image.length;
                  if (glyphLength % 4 !== 0)
                  throw new Error('Glyph image length must be divisible by 4!');
                  imageBytes += glyphLength;
                }
                var len = numGlyphs * 4 + imageBytes/4 + 3;
                // TODO: check length, use bigReq
                // X.pack_stream.pack('CCSLL', [ext.majorOpcode, 20, len, gsid, glyphs.length]);

                // BigReq: S + [ length ] replaced with SL + [ 0, length+1 ]
                X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 20, 0, len+1, gsid, glyphs.length]);

                // glyph ids
                for (i = 0; i < numGlyphs; i++) {
                  X.pack_stream.pack('L', [glyphs[i].id]);
                }
                // width + heiht + origin xy + advance xy
                for (i = 0; i < numGlyphs; i++) {
                  X.pack_stream.pack('SSssss', [glyphs[i].width, glyphs[i].height, -glyphs[i].x, glyphs[i].y, glyphs[i].offX, glyphs[i].offY]);
                }
                // image
                for (i = 0; i < numGlyphs; i++) {
                  X.pack_stream.write_queue.push(glyphs[i].image);
                }
                X.pack_stream.flush();
            }

            //AddGlyphsFromPicture, opcode=21 (not in spec)
            // FreeGlyps - opcode 22
            // gsid(L) , glyphs.length (L) + each glyph id (L)
            //

            // each GlyphEle:
            // 1 byte - number of glyphs
            // xxx
            // int16 deltax, deltay
            // + list of 8/16/32 byte indexesext.CompositeGlyphs
            //  OR
            //  255 + 0 + 0 + glyphsetId / font:
            //  CxxxssL, [255, 0, 0, glyphable]
            //
            //  Each GlyphEle must be padded to 4 byte boundary
            //
            // glyphs as input:
            // [ "just string (0,0) offset is used", [ 10, 10, "string offseted 10,10 from previous pen position" ], 1234567 ] 1234567 is glypfset id or FONT


            // TODO: pre-process input so strings larger than 254 chars are supported
            // (split them into multiple entries with 0,0 offset)

            var formatFromBits = [,,,,,,,,'C',,,,,,,,'S',,,,,,,,,,,,,,,,'L'];
            var bufferWriteBits = [,,,,,,,,'writeUInt8',,,,,,,,'writeUInt16LE',,,,,,,,,,,,,,,,'writeUInt32LE'];

            // 8/16/32 bit string + 4-byte pad
            function wstring(bits, s) {
              var charLength = bits / 8;
              var dataLength = s.length*charLength;
              var res = new Buffer(xutil.padded_length(dataLength));
              debugger;
              var write = res[bufferWriteBits[bits]]
              res.fill(0);
              for(var i=0; i < s.length; i++)
                write.call(res, s.charCodeAt(i), i*charLength);
              return res;
            }

            var compositeGlyphsOpcodeFromBits = [,,,,,,,,23,,,,,,,,24,,,,,,,,,,,,,,,,25];
            ext.CompositeGlyphs = function(glyphBits, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs)
            {
                var opcode = compositeGlyphsOpcodeFromBits[glyphBits];
                var charFormat = formatFromBits[glyphBits];
                var charLength = glyphBits / 8;
                X.seq_num++;
                var length = 7;
                for (var i=0; i < glyphs.length; ++i) {
                  var g = glyphs[i];
                  switch (typeof g) {
                    case 'string':
                      length += xutil.padded_length(g.length*charLength)/4 + 2;
                      break;
                    case 'object':
                      length += xutil.padded_length(g[2].length*charLength)/4 + 2;
                      break;
                    case 'number': // glyphset id
                      length += 2;
                      break;
                  }
                }
                X.pack_stream.pack(
                    'CCSCxxxLLLLss',
                    [ext.majorOpcode, opcode, length, op, src, dst, maskFormat, gsid, srcX, srcY]
                );
                for (var i=0; i < glyphs.length; ++i) {
                  var g = glyphs[i];
                  switch (typeof g) {
                    case 'string':
                      X.pack_stream.pack('Cxxxssa', [g.length, 0, 0, wstring(glyphBits, g)]);
                      break;
                    case 'object': // array
                      X.pack_stream.pack('Cxxxssa', [g[2].length, g[0], g[1], wstring(glyphBits, g[2])]);
                      break;
                    case 'number': // glyphset id
                      X.pack_stream.pack('CxxxL', [0xff, g]);
                      break;
                  }
                }
                X.pack_stream.flush();
            };

      ext.CompositeGlyphs8 = function(op, src, dst, maskFormat, gsid, srcX, srcY, glyphs)
      {
         return ext.CompositeGlyphs(8, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs);
      };

      ext.CompositeGlyphs16 = function(op, src, dst, maskFormat, gsid, srcX, srcY, glyphs)
      {
         return ext.CompositeGlyphs(16, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs);
      };

      ext.CompositeGlyphs32 = function(op, src, dst, maskFormat, gsid, srcX, srcY, glyphs)
      {
         return ext.CompositeGlyphs(32, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs);
      };

            // TODO: implement xutil-like code https://github.com/alexer/python-xlib-render/blob/master/xutil.py

            // TODO: name format fields
            // 0 - id
            // 1 - type ( direct / ? /)
            // 2 - depth
            //
            // 3 - red shift
            // 4 - red mask
            // 5 - green shift
            // 6 - green mask
            // 7 - blue shift
            // 8 - blue mask
            // 9 - alpha shift
            // 10 - alpha mask

            // 11 - colormap or none

            ext.QueryPictFormat(function(err, formats) {
                for (var i=0; i < formats.formats.length; ++i) {
                    var f = formats.formats[i];
                    if (f[2] == 1 && f[10] == 1)
                        ext.mono1 = f[0] ;
                    if (f[2] == 24 && f[3] == 16 && f[5] == 8 && f[7] == 0)
                        ext.rgb24 = f[0];
                    // 1, 32, 16, 255, 8, 255, 0, 255, 24, 255, 0
                    if (f[2] == 32 && f[3] == 16 && f[4] == 255 && f[5] == 8 && f[6] == 255 && f[7] == 0 && f[9] == 24)
                        ext.rgba32 = f[0] ;
                    if (f[2] == 8 && f[10] == 255)
                        ext.a8 = f[0];
                }
                callback(ext);
            });

            [
              "PICTFORMAT argument does not name a defined PICTFORMAT",
              "PICTURE argument does not name a defined PICTURE",
              "PICTOP argument does not name a defined PICTOP",
              "GLYPHSET argument does not name a defined GLYPHSET",
              "GLYPH argument does not name a defined GLYPH in the glyphset"
            ].forEach(function(desc, code) {
              X.errorParsers[ext.firstError + code] = function(err) {
                err.message = "XRender: a value for a " + desc;
              };
            });

      });
}
