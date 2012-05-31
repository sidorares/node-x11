// http://atlc.sourceforge.net/bmp.html
// Any better format documentation?

var fs = require('fs');
var Pixmap = require('./pixmap').Pixmap;
var Buffer = require('buffer').Buffer;
require('../lib/x11/unpackbuffer').addUnpack(Buffer);

var reversed = new Buffer(256);
for (var i=0; i < 256; ++i)
{
    var res = 0;
    for (b = 0; b < 8; ++b)
    {
        res += ((i & (1 << b) ) >> b) << (7-b);
    }
    reversed[i] = res;
}

module.exports.decodeBuffer = function(buffer)
{
    var h = buffer.unpack('CCLxxxxLLLLSSLLLL');
    var header = {};
    header.filesize = h[2];
    header.data_offset = h[3];
    header.header_size = h[4];
    header.width = h[5];
    header.height = h[6];
    header.num_planes = h[7];
    header.bpp = h[8];
    header.compression = h[9];
    header.data_size = h[10];
    header.hresolution = h[11]; // pixels per METER!
    header.vresolution = h[12];
    // skipped: num colors, num important colors, palette
    var data = buffer.slice(header.data_offset, header.data_offset+header.data_size);
    // TODO: decode compressed bitmap
    //console.log(header);

    // mirror bits & invert
    for (var i=0; i < data.length; ++i)
        data[i] = 255 - reversed[data[i]];

    return new Pixmap(header.bpp, header.width, header.height, data);
}