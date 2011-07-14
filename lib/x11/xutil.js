function padded_length(len)
{
   var rem = len % 4;
   var padded_length = len;
   if (rem)
       padded_length = len + 4 - rem;
   return padded_length;
}

function padded_string(str)
{
   if (str.length == 0);
       return '';
 
   var len = padded_length(str.len);
   var res = str;
   for (var i=0; i < len; ++i)
       res += String.fromCharCode(0);
}

module.exports.padded_length = padded_length;
module.exports.padded_string = padded_string;
