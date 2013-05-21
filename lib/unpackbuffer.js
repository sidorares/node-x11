// unpack for static buffer
	
// TODO: use as fallback only if v0.5+ fuffer is not available
// TODO: remove duplicate code
var argument_length = {};
argument_length.C = 1;
argument_length.S = 2;
argument_length.s = 2;
argument_length.L = 4;
argument_length.x = 1;

module.exports.addUnpack = function(Buffer)
{
    Buffer.prototype.unpack = function(format, offset)
    {
        if (!offset)
            offset = 0;

        var data = [];
        var current_arg = 0;
        while (current_arg < format.length)
        {
            var arg = format[current_arg];
            switch (arg) {
            case 'C':
                data.push(this.readUInt8(offset++));
                break;
            case 'c':
                data.push(this.readInt8(offset++));
                break;
            case 'S':
                data.push(this.readUInt16LE(offset));
                offset += 2;
                break;
            case 's':
                data.push(this.readInt16LE(offset));
                offset += 2;
                break;
            case 'n':
                data.push(this.readUInt16BE(offset));
                offset += 2;
                break;
            case 'L':
                data.push(this.readUInt32LE(offset));
                offset += 4;
                break;
            case 'l':
                data.push(this.readInt32LE(offset));
                offset += 4;
                break;
            case 'x':
                offset++;
                break;
            }
            current_arg++;
        }
        return data;
    }

    /*  
    Buffer.prototype.skip = function(n)
    {
        offset += n;
    }
    */

    Buffer.prototype.unpackString = function(n, offset)
    {
        var res = '';
        var end = offset + n;
        while(offset < end)
            res += String.fromCharCode(this[offset++]);
        return res;
    }
}
