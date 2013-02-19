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
		data.push(this[offset++]);
                break;
            case 'S':
            case 's': //TODO: 16bit signed unpack
                var b1 = this[offset++];
                var b2 = this[offset++];
                data.push(b2*256+b1);
                break;
            case 'n':
                var b1 = this[offset++];
                var b2 = this[offset++];
                data.push(b1*256+b2);
                break;
            case 'L':
            case 'l': //TODO: 32bit signed unpack
                var b1 = this[offset++];
                var b2 = this[offset++];
                var b3 = this[offset++];
                var b4 = this[offset++];
                data.push(((b4*256+b3)*256 + b2)*256 + b1);
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
