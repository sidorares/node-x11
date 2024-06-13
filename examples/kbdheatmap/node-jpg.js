/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

// - The JPEG specification can be found in the ITU CCITT Recommendation T.81
//   (www.w3.org/Graphics/JPEG/itu-t81.pdf)
// - The JFIF specification can be found in the JPEG File Interchange Format
//   (www.w3.org/Graphics/JPEG/jfif3.pdf)
// - The Adobe Application-Specific JPEG markers in the Supporting the DCT Filters
//   in PostScript Level 2, Technical Note #5116
//   (partners.adobe.com/public/developer/en/ps/sdk/5116.DCT_Filter.pdf)

var JpegImage = (function () {
  function constructor() {}

  var iDCTTables = (function () {
    var cosTables = [],
      i,
      j;
    for (i = 0; i < 8; i++) {
      cosTables.push(new Float32Array(8));
      for (j = 0; j < 8; j++)
        cosTables[i][j] =
          Math.cos(((2 * i + 1) * j * Math.PI) / 16) *
          (j > 0 ? 1 : 1 / Math.sqrt(2));
    }

    var x, y, u, v;
    var tables = [];
    for (y = 0; y < 8; y++) {
      var cosTable_y = cosTables[y];
      for (x = 0; x < 8; x++) {
        var cosTable_x = cosTables[x];
        var table = new Float32Array(64);
        i = 0;
        for (v = 0; v < 8; v++) {
          for (u = 0; u < 8; u++) table[i++] = cosTable_x[u] * cosTable_y[v];
        }
        tables.push(table);
      }
    }
    return tables;
  })();

  function buildHuffmanTable(codeLengths, values) {
    var k = 0,
      code = [],
      i,
      j,
      length = 16;
    while (length > 0 && !codeLengths[length - 1]) length--;
    code.push({ children: [], index: 0 });
    var p = code[0],
      q;
    for (i = 0; i < length; i++) {
      for (j = 0; j < codeLengths[i]; j++) {
        p = code.pop();
        p.children[p.index] = values[k];
        while (p.index > 0) {
          p = code.pop();
        }
        p.index++;
        code.push(p);
        while (code.length <= i) {
          code.push((q = { children: [], index: 0 }));
          p.children[p.index] = q.children;
          p = q;
        }
        k++;
      }
      if (i + 1 < length) {
        // p here points to last code
        code.push((q = { children: [], index: 0 }));
        p.children[p.index] = q.children;
        p = q;
      }
    }
    return code[0].children;
  }

  function decodeScan(
    data,
    offset,
    frame,
    components,
    resetInterval,
    spectralStart,
    spectralEnd,
    successivePrev,
    successive,
  ) {
    var precision = frame.precision;
    var samplesPerLine = frame.samplesPerLine;
    var scanLines = frame.scanLines;
    var progressive = frame.progressive;
    var maxH = frame.maxH,
      maxV = frame.maxV;

    var startOffset = offset,
      bitsData = 0,
      bitsCount = 0;
    function readBit() {
      if (bitsCount > 0) {
        bitsCount--;
        return (bitsData >> bitsCount) & 1;
      }
      bitsData = data[offset++];
      if (bitsData == 0xff) {
        var nextByte = data[offset++];
        if (nextByte) {
          throw (
            "unexpected marker: " + ((bitsData << 8) | nextByte).toString(16)
          );
        }
        // unstuff 0
      }
      bitsCount = 7;
      return bitsData >>> 7;
    }
    function decodeHuffman(tree) {
      var node = tree,
        bit;
      while ((bit = readBit()) !== null) {
        node = node[bit];
        if (typeof node === "number") return node;
        if (typeof node !== "object") throw "invalid huffman sequence";
      }
      return null;
    }
    function receive(length) {
      var n = 0;
      while (length > 0) {
        var bit = readBit();
        if (bit === null) return;
        n = (n << 1) | bit;
        length--;
      }
      return n;
    }
    function receiveAndExtend(length) {
      var n = receive(length);
      if (n >= 1 << (length - 1)) return n;
      return n + (-1 << length) + 1;
    }
    function decodeBaseline(component) {
      var zz = new Int32Array(64);
      var t = decodeHuffman(component.huffmanTableDC);
      var diff = t === 0 ? 0 : receiveAndExtend(t);
      zz[0] = component.pred += diff;
      var k = 1;
      while (k < 64) {
        var rs = decodeHuffman(component.huffmanTableAC);
        var s = rs & 15,
          r = rs >> 4;
        if (s === 0) {
          if (r != 15) break;
          k += 16;
          continue;
        }
        k += r;
        zz[k] = receiveAndExtend(s);
        k++;
      }
      return zz;
    }
    function quantizeAndInverse(zz, qt) {
      var R = new Int32Array([
        zz[0] * qt[0],
        zz[1] * qt[1],
        zz[5] * qt[5],
        zz[6] * qt[6],
        zz[14] * qt[14],
        zz[15] * qt[15],
        zz[27] * qt[27],
        zz[28] * qt[28],
        zz[2] * qt[2],
        zz[4] * qt[4],
        zz[7] * qt[7],
        zz[13] * qt[13],
        zz[16] * qt[16],
        zz[26] * qt[26],
        zz[29] * qt[29],
        zz[42] * qt[42],
        zz[3] * qt[3],
        zz[8] * qt[8],
        zz[12] * qt[12],
        zz[17] * qt[17],
        zz[25] * qt[25],
        zz[30] * qt[30],
        zz[41] * qt[41],
        zz[43] * qt[43],
        zz[9] * qt[9],
        zz[11] * qt[11],
        zz[18] * qt[18],
        zz[24] * qt[24],
        zz[31] * qt[31],
        zz[40] * qt[40],
        zz[44] * qt[44],
        zz[53] * qt[53],
        zz[10] * qt[10],
        zz[19] * qt[19],
        zz[23] * qt[23],
        zz[32] * qt[32],
        zz[39] * qt[39],
        zz[45] * qt[45],
        zz[52] * qt[52],
        zz[54] * qt[54],
        zz[20] * qt[20],
        zz[22] * qt[22],
        zz[33] * qt[33],
        zz[38] * qt[38],
        zz[46] * qt[46],
        zz[51] * qt[51],
        zz[55] * qt[55],
        zz[60] * qt[60],
        zz[21] * qt[21],
        zz[34] * qt[34],
        zz[37] * qt[37],
        zz[47] * qt[47],
        zz[50] * qt[50],
        zz[56] * qt[56],
        zz[59] * qt[59],
        zz[61] * qt[61],
        zz[35] * qt[35],
        zz[36] * qt[36],
        zz[48] * qt[48],
        zz[49] * qt[49],
        zz[57] * qt[57],
        zz[58] * qt[58],
        zz[62] * qt[62],
        zz[63] * qt[63],
      ]);
      var i, j, y, x, u, v;

      var r = new Uint8Array(64),
        ri;
      for (i = 0; i < 64; i++) {
        var sum = 0;
        var table = iDCTTables[i];
        for (j = 0; j < 64; j++) sum += table[j] * R[j];
        // TODO loosing precision?
        var sample = 128 + ((sum / 4) >> (precision - 8));
        // clamping
        r[i] = sample < 0 ? 0 : sample > 0xff ? 0xff : sample;
      }
      return r;
    }
    function storeMcu(component, r, mcu, row, col) {
      var mcuRow = (mcu / component.mcusPerLine) | 0;
      var mcuCol = mcu % component.mcusPerLine;
      var blockRow = mcuRow * component.v + row;
      var blockCol = mcuCol * component.h + col;

      var scanLine = blockRow << 3,
        sample = blockCol << 3;
      var lines = component.lines;
      while (scanLine + 8 > lines.length) {
        lines.push(new Uint8Array(component.blocksPerLine << 3));
      }

      var i,
        j,
        offset = 0;
      for (j = 0; j < 8; j++) {
        var line = lines[scanLine + j];
        for (i = 0; i < 8; i++) line[sample + i] = r[offset++];
      }
    }
    function storeBlock(component, r, mcu) {
      var blockRow = (mcu / component.mcusPerLine) | 0;
      var blockCol = mcu % component.mcusPerLine;

      var scanLine = blockRow << 3,
        sample = blockCol << 3;
      var lines = component.lines;
      while (scanLine + 8 > lines.length) {
        lines.push(new Uint8Array(component.blocksPerLine << 3));
      }

      var i,
        j,
        offset = 0;
      for (j = 0; j < 8; j++) {
        var line = lines[scanLine + j];
        for (i = 0; i < 8; i++) line[sample + i] = r[offset++];
      }
    }

    var componentsLength = components.length;
    var component, i, j, k, n;
    if (progressive) {
      throw "not implemented: progressive";
    } else {
      for (i = 0; i < componentsLength; i++) {
        component = components[i];
        component.blocksPerLine =
          ((samplesPerLine * component.h) / maxH + 7) >> 3;
        component.mcusPerLine =
          ((component.blocksPerLine + component.h - 1) / component.h) | 0;
        component.decode = decodeBaseline;
      }
    }

    var mcu = 0,
      marker;
    var mcuExpected =
      (0 | ((((samplesPerLine + 7) >> 3) + maxH - 1) / maxH)) *
      (0 | ((((scanLines + 7) >> 3) + maxV - 1) / maxV));
    if (!resetInterval) resetInterval = mcuExpected;

    var zz, r;
    while (mcu < mcuExpected) {
      if (componentsLength == 1) {
        component = components[0];
        for (n = 0; n < resetInterval; n++) {
          zz = component.decode(component);
          r = quantizeAndInverse(zz, component.quantizationTable);
          storeBlock(component, r, mcu);
          mcu++;
        }
      } else {
        for (n = 0; n < resetInterval; n++) {
          for (i = 0; i < componentsLength; i++) {
            component = components[i];
            var h = component.h,
              v = component.v;
            for (j = 0; j < v; j++) {
              for (k = 0; k < h; k++) {
                zz = component.decode(component);
                r = quantizeAndInverse(zz, component.quantizationTable);
                storeMcu(component, r, mcu, j, k);
              }
            }
          }
          mcu++;
        }
      }

      // find marker
      bitsCount = 0;
      marker = (data[offset] << 8) | data[offset + 1];
      if (marker <= 0xff00) {
        throw "marker was not found";
      }

      if (marker >= 0xffd0 && marker <= 0xffd7) {
        // RSTx
        offset += 2;
        for (i = 0; i < componentsLength; i++) components[i].pred = 0;
      } else break;
    }

    return offset - startOffset;
  }

  constructor.prototype = {
    load: function (path) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", path, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = function () {
        // TODO catch parse error
        var data = new Uint8Array(xhr.response || xhr.mozResponseArrayBuffer);
        this.parse(data);
        if (this.onload) this.onload();
      }.bind(this);
      xhr.send(null);
    },
    parse: function (data) {
      var offset = 0,
        length = data.length;
      function readUint16() {
        var value = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        return value;
      }
      function readDataBlock() {
        var length = readUint16();
        //var array = data.subarray(offset, offset + length - 2);
        var array = data.slice(offset, offset + length - 2);
        offset += array.length;
        return array;
      }
      var jfif = null;
      var adobe = null;
      var pixels = null;
      var frame, resetInterval;
      var quantizationTables = [],
        frames = [];
      var huffmanTablesAC = [],
        huffmanTablesDC = [];
      var fileMarker = readUint16();
      if (fileMarker != 0xffd8) {
        // SOI (Start of Image)
        throw "SOI not found";
      }

      fileMarker = readUint16();
      while (fileMarker != 0xffd9) {
        // EOI (End of image)
        var i, j, l;
        switch (fileMarker) {
          case 0xffe0: // APP0 (Application Specific)
          case 0xffe1: // APP1
          case 0xffe2: // APP2
          case 0xffe3: // APP3
          case 0xffe4: // APP4
          case 0xffe5: // APP5
          case 0xffe6: // APP6
          case 0xffe7: // APP7
          case 0xffe8: // APP8
          case 0xffe9: // APP9
          case 0xffea: // APP10
          case 0xffeb: // APP11
          case 0xffec: // APP12
          case 0xffed: // APP13
          case 0xffee: // APP14
          case 0xffef: // APP15
          case 0xfffe: // COM (Comment)
            var appData = readDataBlock();

            if (fileMarker === 0xffe0) {
              if (
                appData[0] === 0x4a &&
                appData[1] === 0x46 &&
                appData[2] === 0x49 &&
                appData[3] === 0x46 &&
                appData[4] === 0
              ) {
                // 'JFIF\x00'
                jfif = {
                  version: { major: appData[5], minor: appData[6] },
                  densityUnits: appData[7],
                  xDensity: (appData[8] << 8) | appData[9],
                  yDensity: (appData[10] << 8) | appData[11],
                  thumbWidth: appData[12],
                  thumbHeight: appData[13],
                  //thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
                  thumbData: appData.slice(
                    14,
                    14 + 3 * appData[12] * appData[13],
                  ),
                };
              }
            }
            // TODO APP1 - Exif
            if (fileMarker === 0xffee) {
              if (
                appData[0] === 0x41 &&
                appData[1] === 0x64 &&
                appData[2] === 0x6f &&
                appData[3] === 0x62 &&
                appData[4] === 65 &&
                appData[5] === 0
              ) {
                // 'Adobe\x00'
                adobe = {
                  version: appData[6],
                  flags0: (appData[7] << 8) | appData[8],
                  flags1: (appData[9] << 8) | appData[10],
                  transformCode: appData[11],
                };
              }
            }
            break;

          case 0xffdb: // DQT (Define Quantization Tables)
            var quantizationTableCount = Math.floor((readUint16() - 2) / 65);
            for (i = 0; i < quantizationTableCount; i++) {
              var quantizationTableSpec = data[offset++];
              var tableData = new Int32Array(64);
              if (quantizationTableSpec >> 4 === 0) {
                // 8 bit values
                for (j = 0; j < 64; j++) tableData[j] = data[offset++];
              } else if (quantizationTableSpec >> 4 === 1) {
                //16 bit
                tableData[j] = readUint16();
              } else throw "DQT: invalid table spec";
              quantizationTables[quantizationTableSpec & 15] = tableData;
            }
            break;

          case 0xffc0: // SOF0 (Start of Frame, Baseline DCT)
          case 0xffc2: // SOF2 (Start of Frame, Progressive DCT)
            readUint16(); // skip data length
            frame = {};
            frame.progressive = fileMarker === 0xffc2;
            frame.precision = data[offset++];
            frame.scanLines = readUint16();
            frame.samplesPerLine = readUint16();
            frame.components = [];
            var componentsCount = data[offset++];
            var maxH = 0,
              maxV = 0;
            for (i = 0; i < componentsCount; i++) {
              var componentId = data[offset];
              var h = data[offset + 1] >> 4;
              var v = data[offset + 1] & 15;
              var qId = data[offset + 2];
              frame.components[componentId] = {
                h: h,
                v: v,
                quantizationTable: quantizationTables[qId],
                pred: 0,
                lines: [],
              };
              offset += 3;
              if (maxH < h) maxH = h;
              if (maxV < v) maxV = v;
            }
            frame.maxH = maxH;
            frame.maxV = maxV;
            frames.push(frame);
            break;

          case 0xffc4: // DHT (Define Huffman Tables)
            var huffmanLength = readUint16();
            for (i = 2; i < huffmanLength; ) {
              var huffmanTableSpec = data[offset++];
              var codeLengths = new Uint8Array(16);
              var codeLengthSum = 0;
              for (j = 0; j < 16; j++, offset++)
                codeLengthSum += codeLengths[j] = data[offset];
              var huffmanValues = new Uint8Array(codeLengthSum);
              for (j = 0; j < codeLengthSum; j++, offset++)
                huffmanValues[j] = data[offset];
              i += 17 + codeLengthSum;

              (huffmanTableSpec >> 4 === 0 ? huffmanTablesDC : huffmanTablesAC)[
                huffmanTableSpec & 15
              ] = buildHuffmanTable(codeLengths, huffmanValues);
            }
            break;

          case 0xffdd: // DRI (Define Restart Interval)
            readUint16(); // skip data length
            resetInterval = readUint16();
            break;

          case 0xffda: // SOS (Start of Scan)
            var scanLength = readUint16();
            var selectorsCount = data[offset++];
            var components = [],
              component;
            for (i = 0; i < selectorsCount; i++) {
              component = frame.components[data[offset++]];
              var tableSpec = data[offset++];
              component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4];
              component.huffmanTableAC = huffmanTablesAC[tableSpec & 15];
              components.push(component);
            }
            var spectralStart = data[offset++];
            var spectralEnd = data[offset++];
            var successiveApproximation = data[offset++];
            var processed = decodeScan(
              data,
              offset,
              frame,
              components,
              resetInterval,
              spectralStart,
              spectralEnd,
              successiveApproximation >> 4,
              successiveApproximation & 15,
            );
            offset += processed;
            break;
          default:
            throw "unknown JPEG marker " + fileMarker.toString(16);
        }
        fileMarker = readUint16();
      }
      if (frames.length != 1) throw "only single frame JPEGs supported";

      this.width = frame.samplesPerLine;
      this.height = frame.scanLines;
      this.jfif = jfif;
      this.adobe = adobe;
      this.components = [];
      for (var id in frame.components) {
        if (frame.components.hasOwnProperty(id)) {
          this.components.push({
            lines: frame.components[id].lines,
            scaleX: frame.components[id].h / frame.maxH,
            scaleY: frame.components[id].v / frame.maxV,
          });
        }
      }
    },
    copyToImageData: function (imageData) {
      var width = imageData.width,
        height = imageData.height;
      var scaleX = this.width / width,
        scaleY = this.height / height;

      var component1, component2, component3, component4;
      var component1Line, component2Line, component3Line, component4Line;
      var x, y;
      var offset = 0,
        data = imageData.data;
      var Y, Cb, Cr, K, C, M, Ye;
      switch (this.components.length) {
        case 1:
          component1 = this.components[0];
          for (y = 0; y < height; y++) {
            component1Line =
              component1.lines[0 | (y * component1.scaleY * scaleY)];
            for (x = 0; x < width; x++) {
              Y = component1Line[0 | (x * component1.scaleX * scaleX)];

              data[offset++] = Y;
              data[offset++] = Y;
              data[offset++] = Y;
              data[offset++] = 255;
            }
          }
          break;
        case 3:
          component1 = this.components[0];
          component2 = this.components[1];
          component3 = this.components[2];
          for (y = 0; y < height; y++) {
            component1Line =
              component1.lines[0 | (y * component1.scaleY * scaleY)];
            component2Line =
              component2.lines[0 | (y * component2.scaleY * scaleY)];
            component3Line =
              component3.lines[0 | (y * component3.scaleY * scaleY)];
            for (x = 0; x < width; x++) {
              Y = component1Line[0 | (x * component1.scaleX * scaleX)];
              Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
              Cr = component3Line[0 | (x * component3.scaleX * scaleX)];

              data[offset++] = Y + 1.402 * (Cr - 128);
              data[offset++] =
                Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128);
              data[offset++] = Y + 1.772 * (Cb - 128);
              data[offset++] = 255;
            }
          }
          break;
        case 4:
          component1 = this.components[0];
          component2 = this.components[1];
          component3 = this.components[2];
          component4 = this.components[3];
          for (y = 0; y < height; y++) {
            component1Line =
              component1.lines[0 | (y * component1.scaleY * scaleY)];
            component2Line =
              component2.lines[0 | (y * component2.scaleY * scaleY)];
            component3Line =
              component3.lines[0 | (y * component3.scaleY * scaleY)];
            component4Line =
              component4.lines[0 | (y * component4.scaleY * scaleY)];
            for (x = 0; x < width; x++) {
              Y = component1Line[0 | (x * component1.scaleX * scaleX)];
              Cb = component2Line[0 | (x * component2.scaleX * scaleX)];
              Cr = component3Line[0 | (x * component3.scaleX * scaleX)];
              K = component4Line[0 | (x * component4.scaleX * scaleX)];

              C = 255 - (Y + 1.402 * (Cr - 128));
              M = 255 - (Y - 0.3441363 * (Cb - 128) - 0.71413636 * (Cr - 128));
              Ye = 255 - (Y + 1.772 * (Cb - 128));

              data[offset++] = 255 - Math.min(255, C * (1 - K / 255) + K);
              data[offset++] = 255 - Math.min(255, M * (1 - K / 255) + K);
              data[offset++] = 255 - Math.min(255, Ye * (1 - K / 255) + K);
              data[offset++] = 255;
            }
          }
          break;
      }
    },
  };

  return constructor;
})();

var Buffer = require("buffer").Buffer;
var fs = require("fs");

module.exports.readJpeg = function (path) {
  var jpgData = fs.readFileSync(path);
  var j = new JpegImage();
  j.parse(jpgData);
  var imageData = {};
  imageData.width = j.width;
  imageData.height = j.height;
  imageData.data = Buffer.from(j.width * j.height * 4);
  j.copyToImageData(imageData);
  return imageData;
};
