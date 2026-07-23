function padded_length(len)
{
   return ((len + 3) >> 2) << 2;
}

function padded_string(str)
{
   if (str.length == 0)
       return Buffer.alloc(0);

   const pad = padded_length(str.length) - str.length;
   const buf = Buffer.alloc(str.length + pad);
   buf.write(str, 0, str.length, 'latin1');
   return buf;
}

function readLatin1(buf, offset, n)
{
   return buf.toString('latin1', offset, offset + n);
}

/** X11 STRING8 list: repeated (CARD8 length, length bytes), terminated by length 0. */
function readStringList(buf, offset)
{
   const res = [];
   let off = offset;
   while (off < buf.length)
   {
      let len = buf[off++];
      if (len == 0)
         break;
      if (off + len > buf.length)
      {
         len = buf.length - off;
         if (len <= 0)
            break;
      }
      res.push(readLatin1(buf, off, len));
      off += len;
   }
   return res;
}

module.exports.padded_length = padded_length;
module.exports.padded_string = padded_string;
module.exports.readLatin1 = readLatin1;
module.exports.readStringList = readStringList;
