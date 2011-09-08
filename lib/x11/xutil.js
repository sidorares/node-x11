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

function parameterOrder(params, obj) {
  var ret = []
  params.forEach(function(name, i) {
    if (Array.isArray(obj[name])) return ret = ret.concat(obj[name])
    else ret[i] = name && obj[name]
  })
  return ret;
}

function size(str) {
  var i = str.length
    , size = 0
  while(i--) {
    switch(str[i]) {
      case 'C':
      case 'c':
      case 'x':
        size += 1
        break;
      case 'S':
      case 's':
        size += 2
        break;
      case 'L':
      case 'l':
        size += 4
        break;
    }
  }
  return size / 4
}

function associate(arr1, arr2) {
  var ret = {}
  for(var i = 0, len = Math.min(arr1.length, arr2.length); i < len; ++i) {
    ret[arr1[i]] = arr2[i]
  }
  return ret
}

module.exports.padded_length = padded_length;
module.exports.padded_string = padded_string;
module.exports.formatSize = size;
module.exports.associate = associate;
module.exports.parameterOrder = parameterOrder;
