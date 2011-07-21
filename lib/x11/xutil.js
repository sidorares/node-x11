function padded_length(len)
{
   return ((len + 3) >> 2) << 2;
   /*
   var rem = len % 4;
   var pl = len;
   if (rem)
       return len + 4 - rem;
   return len;
   */
}

// TODO: make it return buffer?
// str += is slow
function padded_string(str)
{
   if (str.length == 0)
       return '';
 
   var pad = padded_length(str.length) - str.length;
   var res = str;
   for (var i=0; i < pad; ++i)
       res += String.fromCharCode(0);

   return res;
}

module.exports.padded_length = padded_length;
module.exports.padded_string = padded_string;
