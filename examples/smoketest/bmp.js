// http://atlc.sourceforge.net/bmp.html
// Any better format documentation?

const Pixmap = require('./pixmap').Pixmap;

const reversed = Buffer.alloc(256);
for (let i=0; i < 256; ++i)
{
    let res = 0;
    for (b = 0; b < 8; ++b)
    {
        res += ((i & (1 << b) ) >> b) << (7-b);
    }
    reversed[i] = res;
}

module.exports.decodeBuffer = buffer => {
    // CCLxxxxLLLLSSLLLL
    const header = {};
    header.filesize = buffer.readUInt32LE(2);
    header.data_offset = buffer.readUInt32LE(10);
    header.header_size = buffer.readUInt32LE(14);
    header.width = buffer.readUInt32LE(18);
    header.height = buffer.readUInt32LE(22);
    header.num_planes = buffer.readUInt16LE(26);
    header.bpp = buffer.readUInt16LE(28);
    header.compression = buffer.readUInt32LE(30);
    header.data_size = buffer.readUInt32LE(34);
    header.hresolution = buffer.readUInt32LE(38); // pixels per METER!
    header.vresolution = buffer.readUInt32LE(42);
    // skipped: num colors, num important colors, palette
    const data = buffer.slice(header.data_offset, header.data_offset+header.data_size);
    // TODO: decode compressed bitmap

    // mirror bits & invert
    for (let i=0; i < data.length; ++i)
        data[i] = 255 - reversed[data[i]];

    return new Pixmap(header.bpp, header.width, header.height, data);
}
