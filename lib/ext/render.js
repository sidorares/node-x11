const x11 = require('..');
const xutil = require('../xutil');

// adding XRender functions manually from
//     http://cgit.freedesktop.org/xcb/proto/tree/src/render.xml?id=HEAD
// and http://www.x.org/releases/X11R7.6/doc/renderproto/renderproto.txt
// TODO: move to templates
exports.requireExt = (display, callback) => {
  const X = display.client;
  X.QueryExtension('RENDER', (err, ext) => {
    if (!ext.present) {
      return callback(new Error('extension not available'));
    }

    ext.QueryVersion = (clientMaj, clientMin, callback) => {
      X.seq_num++;
      X.pack_stream.pack('CCSLL', [ext.majorOpcode, 0, 3, clientMaj, clientMin]);
      X.replies[X.seq_num] = [
        (buf, opt) => {
          return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
        },
        callback
      ];
      X.pack_stream.flush();
    };

    ext.QueryPictFormat = callback => {
      X.pack_stream.pack('CCS', [ext.majorOpcode, 1, 1]);
      X.seq_num++;
      X.replies[X.seq_num] = [
        (buf, opt) => {
          const res = {};
          const num_formats = buf.readUInt32LE(0);
          const num_screens = buf.readUInt32LE(4);
          const num_depths = buf.readUInt32LE(8);
          const num_visuals = buf.readUInt32LE(12);
          const num_subpixel = buf.readUInt32LE(16);
          // formats list:
          let offset = 24;
          res.formats = [];
          for (let i = 0; i < num_formats; ++i) {
            const format = [
              buf.readUInt32LE(offset),
              buf.readUInt8(offset + 4),
              buf.readUInt8(offset + 5),
              buf.readUInt16LE(offset + 8),
              buf.readUInt16LE(offset + 10),
              buf.readUInt16LE(offset + 12),
              buf.readUInt16LE(offset + 14),
              buf.readUInt16LE(offset + 16),
              buf.readUInt16LE(offset + 18),
              buf.readUInt16LE(offset + 20),
              buf.readUInt16LE(offset + 22),
              buf.readUInt32LE(offset + 24)
            ];
            res.formats.push(format);
            offset += 28;
          }
          return res;
        },
        callback
      ];
      X.pack_stream.flush();
    };

    ext.QueryFilters = callback => {
      X.pack_stream.pack('CCSL', [ext.majorOpcode, 29, 2, display.screen[0].root]);
      X.seq_num++;
      X.replies[X.seq_num] = [
        (buf, opt) => {
          const num_aliases = buf.readUInt32LE(0);
          const num_filters = buf.readUInt32LE(4);
          const aliases = [];
          let offset = 24; // LL + 16 bytes pad
          for (let i = 0; i < num_aliases; ++i) {
            aliases.push(buf.readUInt16LE(offset));
            offset += 2;
          }
          const filters = [];
          for (let i = 0; i < num_filters; ++i) {
            const len = buf.readUInt8(offset);
            //if (!len) break;
            offset++;
            filters.push(buf.toString('ascii', offset, offset + len));
            offset += len;
          }
          return [aliases, filters];
        },
        callback
      ];
      X.pack_stream.flush();
    };

    const valueList = [
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

    const argumentLength = {
      C: 1,
      S: 2,
      s: 2,
      L: 4,
      x: 1
    };

    ext.CreatePicture = (pid, drawable, pictformat, values) => {
      let mask = 0;
      let reqLen = 5; // + (values + pad)/4
      let format = 'CCSLLLL';
      const params = [ext.majorOpcode, 4, reqLen, pid, drawable, pictformat, mask];

      if (values) {
        let valuesLength = 0;
        for (let i = 0; i < valueList.length; ++i) {
          const name = valueList[i][0];
          const val = values[name];
          if (val) {
            mask |= 1 << i;
            params.push(val);
            const valueFormat = valueList[i][1];
            format += valueFormat;
            valuesLength += 4; //argumentLength[valueFormat];
          }
        }
        const pad4 = (valuesLength + 3) >> 2;
        const toPad = (pad4 << 2) - valuesLength;
        for (let i = 0; i < toPad; ++i) format += 'x';
        reqLen += pad4;
        params[2] = reqLen;
        params[6] = mask;
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.FreePicture = pid => {
      X.pack_stream.pack('CCSL', [ext.majorOpcode, 7, 2, pid]);
      X.pack_stream.flush();
      X.seq_num++;
    };

    function floatToFix(f) {
      return parseInt(f * 65536);
    }

    function colorToFix(f) {
      if (f < 0) f = 0;
      if (f > 1) f = 1;
      return parseInt(f * 65535);
    }

    ext.SetPictureTransform = (pid, matrix) => {
      const format = 'CCSLLLLLLLLLL';
      if (matrix.length !== 9)
        throw 'Render.SetPictureTransform: incorrect transform matrix. Must be array of 9 numbers';
      const params = [ext.majorOpcode, 28, 11, pid];
      for (let i = 0; i < 9; ++i) {
        if (typeof matrix[i] !== 'number')
          throw 'Render.SetPictureTransform: matrix element must be a number';
        params.push(floatToFix(matrix[i]));
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    // see example of blur filter here: https://github.com/richoH/rxvt-unicode/blob/master/src/background.C
    ext.SetPictureFilter = (pid, name, filterParams) => {
      if (filterParams === 0) filterParams = [0];
      if (!filterParams) filterParams = [];
      if (!Array.isArray(filterParams)) filterParams = [filterParams];

      let reqLen = 2;
      let format = 'CCSLSxxp';
      const params = [ext.majorOpcode, 30, reqLen, pid, name.length, name];
      reqLen += xutil.padded_length(name.length + 3) / 4 + filterParams.length;

      if (
        name == 'nearest' ||
        name == 'bilinear' ||
        name == 'fast' ||
        name == 'good' ||
        name == 'best'
      ) {
        if (filterParams.length !== 0) {
          throw `Render.SetPictureFilter: "${name}" - unexpected parameters for filters`;
        }
      } else if (name == 'convolution') {
        if (
          filterParams.length < 2 ||
          filterParams[0] * filterParams[1] + 2 !== filterParams.length
        ) {
          throw 'Render.SetPictureFilter: "convolution" - incorrect matrix dimensions. Must be flat array [ w, h, elem1, elem2, ... ]';
        }
        for (let i = 0; i < filterParams.length; ++i) {
          format += 'L';
          params.push(floatToFix(filterParams[i]));
        }
      } else if (name == 'binomial' || name == 'gaussian') {
        if (filterParams.length !== 1) {
          throw `Render.SetPictureFilter: "${name}" - incorrect number of parameters, must be exactly 1 number, instead got: ${filterParams}`;
        }
        format += 'L';
        params.push(floatToFix(filterParams[0]));
      } else {
        throw `Render.SetPictureFilter: unknown filter "${name}"`;
      }
      params[2] = reqLen;
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.CreateSolidFill = (pid, r, g, b, a) => {
      X.pack_stream.pack('CCSLSSSS', [
        ext.majorOpcode,
        33,
        4,
        pid,
        colorToFix(r),
        colorToFix(g),
        colorToFix(b),
        colorToFix(a)
      ]);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.RadialGradient = (pid, p1, p2, r1, r2, stops) => {
      const reqLen = 9 + stops.length * 3; //header + params + 1xStopfix+2xColors
      let format = 'CCSLLLLLLLL';
      const params = [ext.majorOpcode, 35, reqLen, pid];
      params.push(floatToFix(p1[0])); // L
      params.push(floatToFix(p1[1]));
      params.push(floatToFix(p2[0]));
      params.push(floatToFix(p2[1])); // L
      params.push(floatToFix(r1)); // L
      params.push(floatToFix(r2)); // L
      params.push(stops.length);

      // [ [float stopDist, [float r, g, b, a] ], ...]
      // stop distances
      for (let i = 0; i < stops.length; ++i) {
        format += 'L';
        // TODO: we know total params length in advance. ? params[index] =
        params.push(floatToFix(stops[i][0]));
      }
      // colors
      for (let i = 0; i < stops.length; ++i) {
        format += 'SSSS';
        for (let j = 0; j < 4; ++j) params.push(colorToFix(stops[i][1][j]));
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.LinearGradient = (pid, p1, p2, stops) => {
      const reqLen = 7 + stops.length * 3; //header + params + 1xStopfix+2xColors
      let format = 'CCSLLLLLL';
      const params = [ext.majorOpcode, 34, reqLen, pid];
      params.push(floatToFix(p1[0])); // L
      params.push(floatToFix(p1[1]));
      params.push(floatToFix(p2[0]));
      params.push(floatToFix(p2[1])); // L

      params.push(stops.length);

      // [ [float stopDist, [float r, g, b, a] ], ...]
      // stop distances
      for (let i = 0; i < stops.length; ++i) {
        format += 'L';
        // TODO: we know total params length in advance. ? params[index] =
        params.push(floatToFix(stops[i][0]));
      }
      // colors
      for (let i = 0; i < stops.length; ++i) {
        format += 'SSSS';
        for (let j = 0; j < 4; ++j) params.push(colorToFix(stops[i][1][j]));
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.ConicalGradient = (pid, center, angle, stops) => {
      const reqLen = 6 + stops.length * 3; //header + params + 1xStopfix+2xColors
      let format = 'CCSLLLLL';
      const params = [ext.majorOpcode, 36, reqLen, pid];
      params.push(floatToFix(center[0])); // L
      params.push(floatToFix(center[1]));
      params.push(floatToFix(angle)); // L

      params.push(stops.length);

      // [ [float stopDist, [float r, g, b, a] ], ...]
      // stop distances
      for (let i = 0; i < stops.length; ++i) {
        format += 'L';
        // TODO: we know total params length in advance. ? params[index] =
        params.push(floatToFix(stops[i][0]));
      }
      // colors
      for (let i = 0; i < stops.length; ++i) {
        format += 'SSSS';
        for (let j = 0; j < 4; ++j) params.push(colorToFix(stops[i][1][j]));
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.FillRectangles = (op, pid, color, rects) => {
      const reqLen = 5 + rects.length / 2;
      let format = 'CCSCxxxLSSSS';
      const params = [ext.majorOpcode, 26, reqLen, op, pid];
      for (let j = 0; j < 4; ++j) params.push(colorToFix(color[j]));
      for (let i = 0; i < rects.length; i += 4) {
        format += 'ssSS';
        params.push(rects[i * 4]);
        params.push(rects[i * 4 + 1]);
        params.push(rects[i * 4 + 2]);
        params.push(rects[i * 4 + 3]);
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.Composite = (op, src, mask, dst, srcX, srcY, maskX, maskY, dstX, dstY, width, height) => {
      X.pack_stream
        .pack('CCSCxxxLLLssssssSS', [
          ext.majorOpcode,
          8,
          9,
          op,
          src,
          mask,
          dst,
          srcX,
          srcY,
          maskX,
          maskY,
          dstX,
          dstY,
          width,
          height
        ])
        .flush();
      X.seq_num++;
    };

    // note that Trapezoids is considered deprecated by Render extension
    ext.Trapezoids = (op, src, srcX, srcY, dst, maskFormat, trapz) => {
      let format = 'CCSCxxxLLLss';
      const params = [ext.majorOpcode, 10, 6 + trapz.length, op, src, dst, maskFormat, srcX, srcY];
      for (let i = 0; i < trapz.length; i++) {
        format += 'llllllllll';
        for (let j = 0; j < 10; ++j) params.push(floatToFix(trapz[i * 10 + j]));
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.AddTraps = (pic, offX, offY, trapList) => {
      let format = 'CCSLss';
      const params = [ext.majorOpcode, 32, 3 + trapList.length, pic, offX, offY];
      for (let i = 0; i < trapList.length; i++) {
        format += 'l';
        params.push(floatToFix(trapList[i]));
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.Triangles = (op, src, srcX, srcY, dst, maskFormat, tris) => {
      let format = 'CCSCxxxLLLss';
      const params = [ext.majorOpcode, 11, 6 + tris.length, op, src, dst, maskFormat, srcX, srcY];
      for (let i = 0; i < tris.length; i += 6) {
        format += 'llllll';
        //TODO: Array.copy
        params.push(floatToFix(tris[i + 0])); // x1
        params.push(floatToFix(tris[i + 1])); // y1
        params.push(floatToFix(tris[i + 2])); // x2
        params.push(floatToFix(tris[i + 3])); // y2
        params.push(floatToFix(tris[i + 4])); // x3
        params.push(floatToFix(tris[i + 5])); // y3
      }
      X.pack_stream.pack(format, params);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.CreateGlyphSet = (gsid, format) => {
      X.pack_stream.pack('CCSLL', [ext.majorOpcode, 17, 3, gsid, format]);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.ReferenceGlyphSet = (gsid, existing) => {
      X.pack_stream.pack('CCSLL', [ext.majorOpcode, 18, 3, gsid, existing]);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.FreeGlyphSet = gsid => {
      X.pack_stream.pack('CCSL', [ext.majorOpcode, 19, 2, gsid]);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.AddGlyphs = (gsid, glyphs) => {
      const numGlyphs = glyphs.length;
      let imageBytes = 0;
      let glyphLength;
      for (let i = 0; i < numGlyphs; i++) {
        const glyph = glyphs[i];
        if (glyph.width % 4 !== 0) {
          const stride = (glyph.width + 3) & ~3;
          const res = Buffer.alloc(glyph.height * stride);
          res.fill(0);
          for (let y = 0; y < glyph.height; ++y) {
            glyph.image.copy(res, y * stride, y * glyph.width, y * glyph.width + glyph.width);
          }
          glyph.image = res;
          glyph.width = stride;
        }
        glyphLength = glyphs[i].image.length;
        imageBytes += glyphLength;
        glyph.offX = glyph.offX / 64;
        glyph.offY = glyph.offY / 64;
      }
      const len = numGlyphs * 4 + imageBytes / 4 + 3;
      // TODO: check length, use bigReq
      // X.pack_stream.pack('CCSLL', [ext.majorOpcode, 20, len, gsid, glyphs.length]);

      // BigReq: S + [ length ] replaced with SL + [ 0, length+1 ]
      X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 20, 0, len + 1, gsid, glyphs.length]);

      // glyph ids
      for (let i = 0; i < numGlyphs; i++) {
        X.pack_stream.pack('L', [glyphs[i].id]);
      }
      // width + heiht + origin xy + advance xy
      for (let i = 0; i < numGlyphs; i++) {
        X.pack_stream.pack('SSssss', [
          glyphs[i].width,
          glyphs[i].height,
          -glyphs[i].x,
          glyphs[i].y,
          glyphs[i].offX,
          glyphs[i].offY
        ]);
      }
      // image
      for (let i = 0; i < numGlyphs; i++) {
        X.pack_stream.write_queue.push(glyphs[i].image);
      }
      X.pack_stream.flush();
      X.seq_num++;
    };

    // As far as I know this is not implemented in any X server and always retuen "Bad implementation"
    // Also documentation looks misleading as it's not mention glyph ids.
    ext.AddGlyphsFromPicture = (gsid, src, glyphs) => {
      const len = 3 + glyphs.length * 5;
      X.pack_stream.pack('CCSLLL', [ext.majorOpcode, 21, 0, len + 1, gsid, src]);
      for (let i = 0; i < glyphs.length; i++) {
        X.pack_stream.pack('L', [glyphs[i].id]);
      }
      for (let i = 0; i < glyphs.length; i++) {
        X.pack_stream.pack('SSssssss', [
          glyphs[i].width,
          glyphs[i].height,
          -glyphs[i].x,
          glyphs[i].y,
          glyphs[i].offX,
          glyphs[i].offY,
          glyphs[i].srcX,
          glyphs[i].srcY
        ]);
      }
    };

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

    const formatFromBits = [
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      'C',
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      'S',
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      'L'
    ];
    const bufferWriteBits = [
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      'writeUInt8',
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      'writeUInt16LE',
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      'writeUInt32LE'
    ];

    // 8/16/32 bit string + 4-byte pad
    function wstring(bits, s) {
      const charLength = bits / 8;
      const dataLength = s.length * charLength;
      const res = Buffer.alloc(xutil.padded_length(dataLength));
      debugger;
      const write = res[bufferWriteBits[bits]];
      res.fill(0);
      for (let i = 0; i < s.length; i++) write.call(res, s.charCodeAt(i), i * charLength);
      return res;
    }

    const compositeGlyphsOpcodeFromBits = [
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      23,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      24,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      ,
      25
    ];
    ext.CompositeGlyphs = (glyphBits, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs) => {
      const opcode = compositeGlyphsOpcodeFromBits[glyphBits];
      const charFormat = formatFromBits[glyphBits];
      const charLength = glyphBits / 8;
      let length = 7;
      const glyphs_length_split = [];
      for (let i = 0; i < glyphs.length; ++i) {
        const g = glyphs[i];
        switch (typeof g) {
          case 'string':
            length += xutil.padded_length(g.length * charLength) / 4 + 2;
            break;
          case 'object':
            length += xutil.padded_length(g[2].length * charLength) / 4 + 2;
            break;
          case 'number': // glyphset id
            length += 3;
            break;
        }
      }
      X.pack_stream.pack('CCSCxxxLLLLss', [
        ext.majorOpcode,
        opcode,
        length,
        op,
        src,
        dst,
        maskFormat,
        gsid,
        srcX,
        srcY
      ]);
      for (let i = 0; i < glyphs.length; ++i) {
        const g = glyphs[i];
        switch (typeof g) {
          case 'string':
            X.pack_stream.pack('Cxxxssa', [g.length, 0, 0, wstring(glyphBits, g)]);
            break;
          case 'object': // array
            X.pack_stream.pack('Cxxxssa', [g[2].length, g[0], g[1], wstring(glyphBits, g[2])]);
            break;
          case 'number': // glyphset id
            X.pack_stream.pack('CxxxSSL', [0xff, 0, 0, g]);
            break;
        }
      }
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.CompositeGlyphs8 = (op, src, dst, maskFormat, gsid, srcX, srcY, glyphs) => ext.CompositeGlyphs(8, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs);

    ext.CompositeGlyphs16 = (op, src, dst, maskFormat, gsid, srcX, srcY, glyphs) => ext.CompositeGlyphs(16, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs);

    ext.CompositeGlyphs32 = (op, src, dst, maskFormat, gsid, srcX, srcY, glyphs) => ext.CompositeGlyphs(32, op, src, dst, maskFormat, gsid, srcX, srcY, glyphs);

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

    ext.QueryPictFormat((err, formats) => {
      if (err) return callback(err);
      for (let i = 0; i < formats.formats.length; ++i) {
        const f = formats.formats[i];
        if (f[2] == 1 && f[10] == 1) ext.mono1 = f[0];
        if (f[2] == 24 && f[3] == 16 && f[5] == 8 && f[7] == 0) ext.rgb24 = f[0];
        // 1, 32, 16, 255, 8, 255, 0, 255, 24, 255, 0
        if (
          f[2] == 32 &&
          f[3] == 16 &&
          f[4] == 255 &&
          f[5] == 8 &&
          f[6] == 255 &&
          f[7] == 0 &&
          f[9] == 24
        )
          ext.rgba32 = f[0];
        if (f[2] == 8 && f[10] == 255) ext.a8 = f[0];
      }
      callback(null, ext);
    });

    [
      'PICTFORMAT argument does not name a defined PICTFORMAT',
      'PICTURE argument does not name a defined PICTURE',
      'PICTOP argument does not name a defined PICTOP',
      'GLYPHSET argument does not name a defined GLYPHSET',
      'GLYPH argument does not name a defined GLYPH in the glyphset'
    ].forEach((desc, code) => {
      X.errorParsers[ext.firstError + code] = err => {
        err.message = `XRender: a value for a ${desc}`;
      };
    });

    ext.PictOp = {
      Minimum: 0,
      Clear: 0,
      Src: 1,
      Dst: 2,
      Over: 3,
      OverReverse: 4,
      In: 5,
      InReverse: 6,
      Out: 7,
      OutReverse: 8,
      Atop: 9,
      AtopReverse: 10,
      Xor: 11,
      Add: 12,
      Saturate: 13,
      Maximum: 13,

      /*,
       * Operators only available in version 0.2,
       */
      DisjointMinimum: 0x10,
      DisjointClear: 0x10,
      DisjointSrc: 0x11,
      DisjointDst: 0x12,
      DisjointOver: 0x13,
      DisjointOverReverse: 0x14,
      DisjointIn: 0x15,
      DisjointInReverse: 0x16,
      DisjointOut: 0x17,
      DisjointOutReverse: 0x18,
      DisjointAtop: 0x19,
      DisjointAtopReverse: 0x1a,
      DisjointXor: 0x1b,
      DisjointMaximum: 0x1b,

      ConjointMinimum: 0x20,
      ConjointClear: 0x20,
      ConjointSrc: 0x21,
      ConjointDst: 0x22,
      ConjointOver: 0x23,
      ConjointOverReverse: 0x24,
      ConjointIn: 0x25,
      ConjointInReverse: 0x26,
      ConjointOut: 0x27,
      ConjointOutReverse: 0x28,
      ConjointAtop: 0x29,
      ConjointAtopReverse: 0x2a,
      ConjointXor: 0x2b,
      ConjointMaximum: 0x2b,

      /*,
       * Operators only available in version 0.11,
       */
      BlendMinimum: 0x30,
      Multiply: 0x30,
      Screen: 0x31,
      Overlay: 0x32,
      Darken: 0x33,
      Lighten: 0x34,
      ColorDodge: 0x35,
      ColorBurn: 0x36,
      HardLight: 0x37,
      SoftLight: 0x38,
      Difference: 0x39,
      Exclusion: 0x3a,
      HSLHue: 0x3b,
      HSLSaturation: 0x3c,
      HSLColor: 0x3d,
      HSLLuminosity: 0x3e,
      BlendMaximum: 0x3e
    };

    ext.PolyEdge = {
      Sharp: 0,
      Smooth: 1
    };

    ext.PolyMode = {
      Precise: 0,
      Imprecise: 1
    };

    ext.Repeat = {
      None: 0,
      Normal: 1,
      Pad: 2,
      Reflect: 3
    };

    ext.Subpixel = {
      Unknown: 0,
      HorizontalRGB: 1,
      HorizontalBGR: 2,
      VerticalRGB: 3,
      VerticalBGR: 4,
      None: 5
    };

    ext.Filters = {
      Nearest: 'nearest',
      Bilinear: 'bilinear',
      Convolution: 'convolution',
      Fast: 'fast',
      Good: 'good',
      Best: 'best'
    };
  });
};
