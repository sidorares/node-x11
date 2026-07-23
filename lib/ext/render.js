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
      const b = Buffer.alloc(12);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(0, 1);
      b.writeUInt16LE(3, 2);
      b.writeUInt32LE(clientMaj >>> 0, 4);
      b.writeUInt32LE(clientMin >>> 0, 8);
      X.pack_stream.put(b);
      X.replies[X.seq_num] = [
        (buf, opt) => {
          return [buf.readUInt32LE(0), buf.readUInt32LE(4)];
        },
        callback
      ];
      X.pack_stream.flush();
    };

    ext.QueryPictFormat = callback => {
      const b = Buffer.alloc(4);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(1, 1);
      b.writeUInt16LE(1, 2);
      X.pack_stream.put(b);
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
      const b = Buffer.alloc(8);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(29, 1);
      b.writeUInt16LE(2, 2);
      b.writeUInt32LE(display.screen[0].root >>> 0, 4);
      X.pack_stream.put(b);
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

    function writeValueField(buf, off, fmt, val) {
      switch (fmt) {
        case 'Cxxx':
          buf.writeUInt8(val, off);
          break;
        case 'L':
          buf.writeUInt32LE(val >>> 0, off);
          break;
        case 'sxx':
          buf.writeInt16LE(val, off);
          break;
      }
      return off + 4;
    }

    ext.CreatePicture = (pid, drawable, pictformat, values) => {
      let mask = 0;
      let reqLen = 5;
      const selected = [];

      if (values) {
        let valuesLength = 0;
        for (let i = 0; i < valueList.length; ++i) {
          const name = valueList[i][0];
          const val = values[name];
          if (val) {
            mask |= 1 << i;
            selected.push({ fmt: valueList[i][1], val });
            valuesLength += 4;
          }
        }
        const pad4 = (valuesLength + 3) >> 2;
        reqLen += pad4;
      }
      const b = Buffer.alloc(reqLen * 4);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(4, 1);
      b.writeUInt16LE(reqLen, 2);
      b.writeUInt32LE(pid >>> 0, 4);
      b.writeUInt32LE(drawable >>> 0, 8);
      b.writeUInt32LE(pictformat >>> 0, 12);
      b.writeUInt32LE(mask >>> 0, 16);
      let off = 20;
      for (let i = 0; i < selected.length; ++i)
        off = writeValueField(b, off, selected[i].fmt, selected[i].val);
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.FreePicture = pid => {
      const b = Buffer.alloc(8);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(7, 1);
      b.writeUInt16LE(2, 2);
      b.writeUInt32LE(pid >>> 0, 4);
      X.pack_stream.put(b);
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
      if (matrix.length !== 9)
        throw 'Render.SetPictureTransform: incorrect transform matrix. Must be array of 9 numbers';
      const b = Buffer.alloc(44);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(28, 1);
      b.writeUInt16LE(11, 2);
      b.writeUInt32LE(pid >>> 0, 4);
      let off = 8;
      for (let i = 0; i < 9; ++i) {
        if (typeof matrix[i] !== 'number')
          throw 'Render.SetPictureTransform: matrix element must be a number';
        b.writeInt32LE(floatToFix(matrix[i]), off);
        off += 4;
      }
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    // see example of blur filter here: https://github.com/richoH/rxvt-unicode/blob/master/src/background.C
    ext.SetPictureFilter = (pid, name, filterParams) => {
      if (filterParams === 0) filterParams = [0];
      if (!filterParams) filterParams = [];
      if (!Array.isArray(filterParams)) filterParams = [filterParams];

      let reqLen = 2;
      const nameBuf = xutil.padded_string(name);
      reqLen += xutil.padded_length(name.length + 3) / 4;

      const fixedParams = [];
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
        for (let i = 0; i < filterParams.length; ++i)
          fixedParams.push(floatToFix(filterParams[i]));
        reqLen += fixedParams.length;
      } else if (name == 'binomial' || name == 'gaussian') {
        if (filterParams.length !== 1) {
          throw `Render.SetPictureFilter: "${name}" - incorrect number of parameters, must be exactly 1 number, instead got: ${filterParams}`;
        }
        fixedParams.push(floatToFix(filterParams[0]));
        reqLen += 1;
      } else {
        throw `Render.SetPictureFilter: unknown filter "${name}"`;
      }

      const hdr = Buffer.alloc(12);
      hdr.writeUInt8(ext.majorOpcode, 0);
      hdr.writeUInt8(30, 1);
      hdr.writeUInt16LE(reqLen, 2);
      hdr.writeUInt32LE(pid >>> 0, 4);
      hdr.writeUInt16LE(name.length, 8);
      X.pack_stream.put(hdr);
      X.pack_stream.put(nameBuf);
      if (fixedParams.length) {
        const params = Buffer.alloc(fixedParams.length * 4);
        for (let i = 0; i < fixedParams.length; ++i)
          params.writeInt32LE(fixedParams[i], i * 4);
        X.pack_stream.put(params);
      }
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.CreateSolidFill = (pid, r, g, b, a) => {
      const buf = Buffer.alloc(16);
      buf.writeUInt8(ext.majorOpcode, 0);
      buf.writeUInt8(33, 1);
      buf.writeUInt16LE(4, 2);
      buf.writeUInt32LE(pid >>> 0, 4);
      buf.writeUInt16LE(colorToFix(r), 8);
      buf.writeUInt16LE(colorToFix(g), 10);
      buf.writeUInt16LE(colorToFix(b), 12);
      buf.writeUInt16LE(colorToFix(a), 14);
      X.pack_stream.put(buf);
      X.pack_stream.flush();
      X.seq_num++;
    };

    function putGradientRequest(minorOpcode, reqLen, pid, headerFields, stops) {
      const b = Buffer.alloc(reqLen * 4);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(minorOpcode, 1);
      b.writeUInt16LE(reqLen, 2);
      b.writeUInt32LE(pid >>> 0, 4);
      let off = 8;
      for (let i = 0; i < headerFields.length; ++i) {
        b.writeInt32LE(headerFields[i], off);
        off += 4;
      }
      b.writeUInt32LE(stops.length >>> 0, off);
      off += 4;
      for (let i = 0; i < stops.length; ++i) {
        b.writeInt32LE(floatToFix(stops[i][0]), off);
        off += 4;
      }
      for (let i = 0; i < stops.length; ++i) {
        for (let j = 0; j < 4; ++j) {
          b.writeUInt16LE(colorToFix(stops[i][1][j]), off);
          off += 2;
        }
      }
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    }

    ext.RadialGradient = (pid, p1, p2, r1, r2, stops) => {
      const reqLen = 9 + stops.length * 3;
      putGradientRequest(35, reqLen, pid, [
        floatToFix(p1[0]),
        floatToFix(p1[1]),
        floatToFix(p2[0]),
        floatToFix(p2[1]),
        floatToFix(r1),
        floatToFix(r2)
      ], stops);
    };

    ext.LinearGradient = (pid, p1, p2, stops) => {
      const reqLen = 7 + stops.length * 3;
      putGradientRequest(34, reqLen, pid, [
        floatToFix(p1[0]),
        floatToFix(p1[1]),
        floatToFix(p2[0]),
        floatToFix(p2[1])
      ], stops);
    };

    ext.ConicalGradient = (pid, center, angle, stops) => {
      const reqLen = 6 + stops.length * 3;
      putGradientRequest(36, reqLen, pid, [
        floatToFix(center[0]),
        floatToFix(center[1]),
        floatToFix(angle)
      ], stops);
    };

    ext.FillRectangles = (op, pid, color, rects) => {
      const reqLen = 5 + rects.length / 2;
      const b = Buffer.alloc(reqLen * 4);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(26, 1);
      b.writeUInt16LE(reqLen, 2);
      b.writeUInt8(op, 4);
      b.writeUInt32LE(pid >>> 0, 8);
      for (let j = 0; j < 4; ++j)
        b.writeUInt16LE(colorToFix(color[j]), 12 + j * 2);
      let off = 20;
      for (let i = 0; i < rects.length; i += 4) {
        b.writeInt16LE(rects[i * 4], off);
        b.writeInt16LE(rects[i * 4 + 1], off + 2);
        b.writeUInt16LE(rects[i * 4 + 2], off + 4);
        b.writeUInt16LE(rects[i * 4 + 3], off + 6);
        off += 8;
      }
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.Composite = (op, src, mask, dst, srcX, srcY, maskX, maskY, dstX, dstY, width, height) => {
      const b = Buffer.alloc(36);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(8, 1);
      b.writeUInt16LE(9, 2);
      b.writeUInt8(op, 4);
      b.writeUInt32LE(src >>> 0, 8);
      b.writeUInt32LE(mask >>> 0, 12);
      b.writeUInt32LE(dst >>> 0, 16);
      b.writeInt16LE(srcX, 20);
      b.writeInt16LE(srcY, 22);
      b.writeInt16LE(maskX, 24);
      b.writeInt16LE(maskY, 26);
      b.writeInt16LE(dstX, 28);
      b.writeInt16LE(dstY, 30);
      b.writeUInt16LE(width, 32);
      b.writeUInt16LE(height, 34);
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    // note that Trapezoids is considered deprecated by Render extension
    ext.Trapezoids = (op, src, srcX, srcY, dst, maskFormat, trapz) => {
      const reqLen = 6 + trapz.length;
      const b = Buffer.alloc(reqLen * 4);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(10, 1);
      b.writeUInt16LE(reqLen, 2);
      b.writeUInt8(op, 4);
      b.writeUInt32LE(src >>> 0, 8);
      b.writeUInt32LE(dst >>> 0, 12);
      b.writeUInt32LE(maskFormat >>> 0, 16);
      b.writeInt16LE(srcX, 20);
      b.writeInt16LE(srcY, 22);
      let off = 24;
      for (let i = 0; i < trapz.length; i++) {
        for (let j = 0; j < 10; ++j) {
          b.writeInt32LE(floatToFix(trapz[i * 10 + j]), off);
          off += 4;
        }
      }
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.AddTraps = (pic, offX, offY, trapList) => {
      const reqLen = 3 + trapList.length;
      const b = Buffer.alloc(reqLen * 4);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(32, 1);
      b.writeUInt16LE(reqLen, 2);
      b.writeUInt32LE(pic >>> 0, 4);
      b.writeInt16LE(offX, 8);
      b.writeInt16LE(offY, 10);
      let off = 12;
      for (let i = 0; i < trapList.length; i++) {
        b.writeInt32LE(floatToFix(trapList[i]), off);
        off += 4;
      }
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.Triangles = (op, src, srcX, srcY, dst, maskFormat, tris) => {
      const reqLen = 6 + tris.length;
      const b = Buffer.alloc(reqLen * 4);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(11, 1);
      b.writeUInt16LE(reqLen, 2);
      b.writeUInt8(op, 4);
      b.writeUInt32LE(src >>> 0, 8);
      b.writeUInt32LE(dst >>> 0, 12);
      b.writeUInt32LE(maskFormat >>> 0, 16);
      b.writeInt16LE(srcX, 20);
      b.writeInt16LE(srcY, 22);
      let off = 24;
      for (let i = 0; i < tris.length; i += 6) {
        b.writeInt32LE(floatToFix(tris[i + 0]), off);
        b.writeInt32LE(floatToFix(tris[i + 1]), off + 4);
        b.writeInt32LE(floatToFix(tris[i + 2]), off + 8);
        b.writeInt32LE(floatToFix(tris[i + 3]), off + 12);
        b.writeInt32LE(floatToFix(tris[i + 4]), off + 16);
        b.writeInt32LE(floatToFix(tris[i + 5]), off + 20);
        off += 24;
      }
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.CreateGlyphSet = (gsid, format) => {
      const b = Buffer.alloc(12);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(17, 1);
      b.writeUInt16LE(3, 2);
      b.writeUInt32LE(gsid >>> 0, 4);
      b.writeUInt32LE(format >>> 0, 8);
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.ReferenceGlyphSet = (gsid, existing) => {
      const b = Buffer.alloc(12);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(18, 1);
      b.writeUInt16LE(3, 2);
      b.writeUInt32LE(gsid >>> 0, 4);
      b.writeUInt32LE(existing >>> 0, 8);
      X.pack_stream.put(b);
      X.pack_stream.flush();
      X.seq_num++;
    };

    ext.FreeGlyphSet = gsid => {
      const b = Buffer.alloc(8);
      b.writeUInt8(ext.majorOpcode, 0);
      b.writeUInt8(19, 1);
      b.writeUInt16LE(2, 2);
      b.writeUInt32LE(gsid >>> 0, 4);
      X.pack_stream.put(b);
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
      const hdr = Buffer.alloc(16);
      hdr.writeUInt8(ext.majorOpcode, 0);
      hdr.writeUInt8(20, 1);
      hdr.writeUInt16LE(0, 2);
      hdr.writeUInt32LE(len + 1, 4);
      hdr.writeUInt32LE(gsid >>> 0, 8);
      hdr.writeUInt32LE(glyphs.length >>> 0, 12);
      X.pack_stream.put(hdr);

      const ids = Buffer.alloc(numGlyphs * 4);
      for (let i = 0; i < numGlyphs; i++)
        ids.writeUInt32LE(glyphs[i].id >>> 0, i * 4);
      X.pack_stream.put(ids);

      const metrics = Buffer.alloc(numGlyphs * 12);
      for (let i = 0; i < numGlyphs; i++) {
        const off = i * 12;
        metrics.writeUInt16LE(glyphs[i].width, off);
        metrics.writeUInt16LE(glyphs[i].height, off + 2);
        metrics.writeInt16LE(-glyphs[i].x, off + 4);
        metrics.writeInt16LE(glyphs[i].y, off + 6);
        metrics.writeInt16LE(glyphs[i].offX, off + 8);
        metrics.writeInt16LE(glyphs[i].offY, off + 10);
      }
      X.pack_stream.put(metrics);

      for (let i = 0; i < numGlyphs; i++)
        X.pack_stream.put(glyphs[i].image);
      X.pack_stream.flush();
      X.seq_num++;
    };

    // As far as I know this is not implemented in any X server and always retuen "Bad implementation"
    // Also documentation looks misleading as it's not mention glyph ids.
    ext.AddGlyphsFromPicture = (gsid, src, glyphs) => {
      const len = 3 + glyphs.length * 5;
      const hdr = Buffer.alloc(16);
      hdr.writeUInt8(ext.majorOpcode, 0);
      hdr.writeUInt8(21, 1);
      hdr.writeUInt16LE(0, 2);
      hdr.writeUInt32LE(len + 1, 4);
      hdr.writeUInt32LE(gsid >>> 0, 8);
      hdr.writeUInt32LE(src >>> 0, 12);
      X.pack_stream.put(hdr);

      const ids = Buffer.alloc(glyphs.length * 4);
      for (let i = 0; i < glyphs.length; i++)
        ids.writeUInt32LE(glyphs[i].id >>> 0, i * 4);
      X.pack_stream.put(ids);

      const metrics = Buffer.alloc(glyphs.length * 16);
      for (let i = 0; i < glyphs.length; i++) {
        const off = i * 16;
        metrics.writeUInt16LE(glyphs[i].width, off);
        metrics.writeUInt16LE(glyphs[i].height, off + 2);
        metrics.writeInt16LE(-glyphs[i].x, off + 4);
        metrics.writeInt16LE(glyphs[i].y, off + 6);
        metrics.writeInt16LE(glyphs[i].offX, off + 8);
        metrics.writeInt16LE(glyphs[i].offY, off + 10);
        metrics.writeInt16LE(glyphs[i].srcX, off + 12);
        metrics.writeInt16LE(glyphs[i].srcY, off + 14);
      }
      X.pack_stream.put(metrics);
      X.pack_stream.flush();
      X.seq_num++;
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
      const charLength = glyphBits / 8;
      let length = 7;
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
      const hdr = Buffer.alloc(28);
      hdr.writeUInt8(ext.majorOpcode, 0);
      hdr.writeUInt8(opcode, 1);
      hdr.writeUInt16LE(length, 2);
      hdr.writeUInt8(op, 4);
      hdr.writeUInt32LE(src >>> 0, 8);
      hdr.writeUInt32LE(dst >>> 0, 12);
      hdr.writeUInt32LE(maskFormat >>> 0, 16);
      hdr.writeUInt32LE(gsid >>> 0, 20);
      hdr.writeInt16LE(srcX, 24);
      hdr.writeInt16LE(srcY, 26);
      X.pack_stream.put(hdr);
      for (let i = 0; i < glyphs.length; ++i) {
        const g = glyphs[i];
        switch (typeof g) {
          case 'string': {
            const str = wstring(glyphBits, g);
            const ele = Buffer.alloc(8 + str.length);
            ele.writeUInt8(g.length, 0);
            ele.writeInt16LE(0, 4);
            ele.writeInt16LE(0, 6);
            str.copy(ele, 8);
            X.pack_stream.put(ele);
            break;
          }
          case 'object': {
            const str = wstring(glyphBits, g[2]);
            const ele = Buffer.alloc(8 + str.length);
            ele.writeUInt8(g[2].length, 0);
            ele.writeInt16LE(g[0], 4);
            ele.writeInt16LE(g[1], 6);
            str.copy(ele, 8);
            X.pack_stream.put(ele);
            break;
          }
          case 'number': {
            const ele = Buffer.alloc(12);
            ele.writeUInt8(0xff, 0);
            ele.writeUInt16LE(0, 4);
            ele.writeUInt16LE(0, 6);
            ele.writeUInt32LE(g >>> 0, 8);
            X.pack_stream.put(ele);
            break;
          }
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
