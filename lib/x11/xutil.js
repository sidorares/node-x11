function padded_length(len)
{
   var rem = len % 4;
   var padded_length = len;
   if (rem)
       padded_length = len + 4 - rem;
   return padded_length;
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
