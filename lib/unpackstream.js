var Buffer = require('buffer').Buffer;
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var xutil = require('./xutil');

var argument_length = {};
argument_length.C = 1;
argument_length.S = 2;
argument_length.s = 2;
argument_length.L = 4;
argument_length.l = 4;
argument_length.x = 1;

function ReadFormatRequest(format, callback)
{
    this.format = format;
    this.current_arg = 0;
    this.data = [];
    this.callback = callback;
}

function ReadFixedRequest(length, callback)
{
    this.length = length;
    this.callback = callback;
    this.data = new Buffer(length);
    this.received_bytes = 0;
}

ReadFixedRequest.prototype.execute = function(bufferlist, aa, bb, cc, dd)
{
    // TODO: this is a brute force version
    // replace with Buffer.slice calls
    var to_receive = this.length - this.received_bytes;
    for(var i=0 ; i < to_receive; ++i)
    {
        if (bufferlist.length == 0)
            return false;
        this.data[this.received_bytes++] = bufferlist.getbyte();
    }
    this.callback(this.data);
    return true;
}

ReadFormatRequest.prototype.execute = function(bufferlist, tag1, tag2)
{
    while (this.current_arg < this.format.length)
    {
        var arg = this.format[this.current_arg];
        if (bufferlist.length < argument_length[arg])
            return false; // need to wait for more data to prcess this argument

        // TODO: measure Buffer.readIntXXX performance and use them if faster
        // note: 4 and 2-byte values may cross chunk border & split. need to handle this correctly
        // maybe best approach is to wait all data required for format and then process fixed buffer
        // TODO: byte order!!!
        switch (arg) {
        case 'C':
            this.data.push(bufferlist.getbyte());
            break;
        case 'S':
        case 's':
            var b1 = bufferlist.getbyte();
            var b2 = bufferlist.getbyte();
            this.data.push(b2*256+b1);
            break;
        case 'l':
        case 'L':
            var b1 = bufferlist.getbyte();
            var b2 = bufferlist.getbyte();
            var b3 = bufferlist.getbyte();
            var b4 = bufferlist.getbyte();
            this.data.push(((b4*256+b3)*256 + b2)*256 + b1);
            break;
        case 'x':
            bufferlist.getbyte();
            break;
        }
        this.current_arg++;
    }
    this.callback(this.data);
    return true;
}

function UnpackStream()
{
    EventEmitter.call(this);

    this.readlist = [];
    this.length = 0;
    this.offset = 0;
    this.read_queue = [];
    this.write_queue = [];
    this.write_length = 0;
}
util.inherits(UnpackStream, EventEmitter);

UnpackStream.prototype.write = function(buf)
{
    this.readlist.push(buf);
    this.length += buf.length;
    this.resume();
}

UnpackStream.prototype.pipe = function(stream)
{
    // TODO: ondrain & pause
    this.on('data', function(data)
    {
        stream.write(data);
    });
}

UnpackStream.prototype.unpack = function(format, callback)
{
    this.read_queue.push(new ReadFormatRequest(format, callback));
    this.resume();
}

UnpackStream.prototype.unpackTo = function(destination, names_formats, callback)
{
    var names = [];
    var format = '';

    for (var i=0; i < names_formats.length; ++i)
    {
        var off = 0;
        while(off < names_formats[i].length && names_formats[i][off] == 'x')
        {
            format += 'x';
            off++;
        }

        if (off < names_formats[i].length)
        {
            format += names_formats[i][off];
            var name = names_formats[i].substr(off+2);
            names.push(name);
        }
    }

    this.unpack(format, function(data) {
        if (data.length != names.length)
            throw 'Number of arguments mismatch, ' + names.length + ' fields and ' + data.length + ' arguments';
        for (var fld = 0; fld < data.length; ++fld)
        {
            destination[names[fld]] = data[fld];
        }
        callback(destination);
    });
}

UnpackStream.prototype.get = function(length, callback)
{
    this.read_queue.push(new ReadFixedRequest(length, callback));
    this.resume();
}

UnpackStream.prototype.resume = function()
{
    if (this.resumed)
         return;
    this.resumed = true;
    // process all read requests until enough data in the buffer
    while(this.read_queue[0].execute(this))
    {
        this.read_queue.shift();
        if (this.read_queue.length == 0)
            return;
    }
    this.resumed = false;
}

UnpackStream.prototype.getbyte = function()
{
    var res = 0;
    var b = this.readlist[0];
    if (this.offset + 1 < b.length)
    {
        res = b[this.offset];
        this.offset++;
        this.length--;

    } else {

        // last byte in current buffer, shift read list
        res = b[this.offset];
        this.readlist.shift();
        this.length--;
        this.offset = 0;
    }
    return res;
}

/*

// write padded string
// at the moment replaced with pack('p', [ 'padded_string' ])
UnpackStream.prototype.pstr = function(str)
{
    var len = xutil.padded_length(str.length);
    if (len == 0)
        return; // nothing to write
    var buf = new Buffer(len);
    buf.write(str, 'binary');
    this.write_queue.push(buf);
}
*/

// TODO: measure node 0.5+ buffer serialisers performance
UnpackStream.prototype.pack = function(format, args)
{
    var packetlength = 0;

    var arg = 0;
    for (var i = 0; i < format.length; ++i)
    {
        var f = format[i];
        if (f == 'x')
        {
            packetlength++;
        } else if (f == 'p') {
            packetlength += xutil.padded_length(args[arg++].length);
        } else if (f == 'a') {
            packetlength += args[arg].length;
            arg++;
        } else {
            // this is a fixed-length format, get length from argument_length table
            packetlength += argument_length[f];
            arg++;
        }
    }

    var buf = new Buffer(packetlength);
    var offset = 0;
    var arg = 0;
    for (var i = 0; i < format.length; ++i)
    {
        switch(format[i])
        {
            case 'x':
                buf[offset++] = 0;
                break;
            case 'C':
                var n = args[arg++];
                buf[offset++] = n;
                break;
            case 's':
                var n = args[arg++];
                buf.writeInt16LE(n, offset);
                offset += 2;
                break;

            case 'S':
                var n = args[arg++];
                buf[offset++] = n & 0xff;
                buf[offset++] = (n >> 8) & 0xff;
                break;
            case 'l':
                var n = args[arg++];
                buf.writeInt32LE(n, offset);
                offset += 4;
                break;

            case 'L':
                var n = args[arg++];
                buf[offset++] = n & 0xff;
                buf[offset++] = (n >> 8) & 0xff;
                buf[offset++] = (n >> 16) & 0xff;
                buf[offset++] = (n >> 24) & 0xff;
                break;
            case 'a':  // string or buffer
                var str = args[arg++];
                if (Buffer.isBuffer(str))
                {
                    str.copy(buf, offset);
                    offset += str.length;
                } else {
                    // TODO: buffer.write could be faster
                    for (var c = 0; c < str.length; ++c)
                        buf[offset++] = str.charCodeAt(c);
                }
                break;
            case 'p':  // padded string
                var str = args[arg++];
                var len = xutil.padded_length(str.length);
                // TODO: buffer.write could be faster
                var c = 0;
                for (; c < str.length; ++c)
                    buf[offset++] = str.charCodeAt(c);
                for (; c < len; ++c)
                    buf[offset++] = 0;
                break;
        }
    }
    this.write_queue.push(buf);
    this.write_length += buf.length;
    return this;
}

UnpackStream.prototype.flush = function(stream)
{
    // TODO: measure performance benefit of
    // creating and writing one big concatenated buffer

    // TODO: check write result
    // pause/resume streaming
    for (var i=0; i < this.write_queue.length; ++i)
    {
         //stream.write(this.write_queue[i])
         this.emit('data', this.write_queue[i]);
    }
    this.write_queue = [];
    this.write_length = 0;
}

module.exports = UnpackStream;
