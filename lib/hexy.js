//= hexy.js -- utility to create hex dumps 
//
// `hexy` is a javascript (node) library that's easy to use to create hex
// dumps from within node. It contains a number of options to configure
// how the hex dumb will end up looking.
//
// It should create a pleasant looking hex dumb by default:
//    
//    var hexy = require('hexy.js'),
//           b = new Buffer("\000\001\003\005\037\012\011bcdefghijklmnopqrstuvwxyz0123456789")
//    
//    console.log(hexy.hexy(b))
//
// results in this dump:
//
//    0000000: 00 01 03 05 1f 0a 09 62   63 64 65 66 67 68 69 6a  .......b cdefghij 
//    0000010: 6b 6c 6d 6e 6f 70 71 72   73 74 75 76 77 78 79 7a  klmnopqr stuvwxyz 
//    0000020: 30 31 32 33 34 35 36 37   38 39                    01234567 89
//
// but it's also possible to configure:
//
//  * Line numbering
//  * Line width
//  * Format
//  * Case of hex decimals
//  * Presence of the ASCII annotation in the right column.
//
// This mean you can do exciting dumps like:
//
//    0000000: 0001 0305 1f0a 0962  .... ...b 
//    0000008: 6364 6566 6768 696a  cdef ghij 
//    0000010: 6b6c 6d6e 6f70 7172  klmn opqr 
//    0000018: 7374 7576 7778 797a  stuv wxyz 
//    0000020: 3031 3233 3435 3637  0123 4567 
//    0000028: 3839                 89
//
// or even:
//
//    0000000: 00 01 03 05 1f 0a 09 62   63 64 65 66 67 68 69 6a 
//    0000010: 6b 6c 6d 6e 6f 70 71 72   73 74 75 76 77 78 79 7a 
//    0000020: 30 31 32 33 34 35 36 37   38 39
//
// with hexy!
// 
// Formatting options are configured by passing a `format` object to the `hexy` function:
//
//    var format = {}
//        format.width = width // how many bytes per line, default 16
//        format.numbering = n // ["hex_bytes" | "none"],  default "none"
//        format.format = f    // ["fours"|"twos"|"none"], how many nibbles per group
//                             //                          default "fours"
//        format.caps = c      // ["lower"|"upper"],       default lower
//        format.annotate=a    // ["ascii"|"none"], ascii annotation at end of line?
//                             //                          default "ascii"
//        format.prefix=p      // <string> something pretty to put in front of each line
//                             //                          default ""
//        format.indent=i      // <num> number of spaces to indent
//                             //                          default 0
//
//    console.log(hexy.hexy(buffer, format))
//
// In case you're really nerdy, you'll have noticed that the defaults correspond
// to how `xxd` formats it's output.
//           
//
//== Installing
//
// Either use `npm`:
//  
//    npm install hexy
//
// This will install the lib which you'll be able to use like so:
//    
//    var hexy = require("hexy.js"),
//        buf  = // get Buffer from somewhere,
//        str  = hexy.hexy(buf)
//
// It will also install `hexy.js` into your path in case you're totally fed up
// with using `xxd`.
//        
// 
// If you don't like `npm`, grab the source from github:
//
//    http://github.com/a2800276/hexy.js
//
//== TODOS
//
// The current version only pretty prints Buffers. Which probably means it
// can only be used from within node. What's more important what it
// doesn't support: Strings (which would be nice for the sake of
// completeness) and Streams/series of Buffers which would be nice so you
// don't have to collect the whole things you want to pretty print in
// memory. `hexy` is probably most useful for debugging and getting binary
// protocol stuff working, so that's probably not an too much of an issue.
//
//== History
//
// This is a fairly straightforward port of `hexy.rb` which does more or less the
// same thing. You can find it here: 
// 
//    http://github.com/a2800276/hexy
// 
// in case these sorts of things interest you.
//
//== Mail
//
// In case you discover bugs, spelling errors, offer suggestions for
// improvements or would like to help out with the project, you can contact
// me directly (tim@kuriositaet.de). 

var hexy = function (buffer, config) {
  config = config || {}
  var h = new Hexy(buffer, config)
  return h.toString()
}

var Hexy = function (buffer, config) {
  var self = this
 
  self.buffer    = buffer // magic string conversion here?
  self.width     = config.width || 16
  self.numbering = config.numbering == "none"  ? "none" : "hex_bytes"
  self.groupSpacing = config.groupSpacing || 0
   
  switch (config.format) {
    case "none":
    case "twos":
      self.format = config.format
      break
    default:
      self.format = "fours"
  }
  
  self.caps      = config.caps      == "upper" ? "upper" : "lower"
  self.annotate  = config.annotate  == "none"  ? "none"  : "ascii"
  self.prefix    = config.prefix    || ""
  self.indent    = config.indent    || 0

  for (var i = 0; i!=self.indent; ++i) {
    self.prefix = " "+prefix
  }

  var pos = 0

  this.toString = function () {
    var str = ""
    
    //split up into line of max `self.width`
    var line_arr = lines()
    
    //lines().forEach(function(hex_raw, i){
    for (var i = 0; i!= line_arr.length; ++i) {
      var hex_raw = line_arr[i],
          hex = hex_raw[0],
          raw = hex_raw[1]
      //insert spaces every `self.format.twos` or fours
      var howMany = hex.length
      if (self.format === "fours") {
        howMany = 4
      } else if (self.format === "twos") {
        howMany = 2
      }

      var hex_formatted = ""
      var middle = Math.floor(self.width / 2)-1
      var groupSpaces = (new Array(self.groupSpacing+1)).join(' ');
      for (var j=0; j<hex.length; j+=howMany) {
        var s = hex.substr(j, howMany)
        hex_formatted += s + (j/2 === middle && self.groupSpacing > 0 ? groupSpaces : " ")
      }
      str += self.prefix 

      if (self.numbering === "hex_bytes") {
        str += pad(i*self.width, 8) // padding...
        str += ": "
      }
      
      var padlen = 0
      switch(self.format) {
        case "fours":
          padlen = self.width*2 + self.width/2
          break
        case "twos":
          padlen = self.width*3 + 2
          break
        default:
          padlen = self * 2
      }

      str += rpad(hex_formatted, padlen)
      if (self.annotate === "ascii") {
        str+=" "
        str+=raw.replace(/[\000-\040\177-\377]/g, ".")
      }
      str += "\n"
    }
    return str
  }

  var lines = function() {
    var hex_raw = []
    

    for (var i = 0; i<self.buffer.length ; i+=self.width) {
      var begin = i,
          end   = i+self.width >= buffer.length ? buffer.length : i+self.width,
          slice = buffer.slice(begin, end),
          hex   = self.caps === "upper" ? hexu(slice) : hexl(slice),
          raw   = slice.toString('ascii')

      hex_raw.push([hex,raw])
    }
    return hex_raw

  }

  var hexl = function (buffer) {
    var str = ""
    for (var i=0; i!=buffer.length; ++i) {
      str += pad(buffer[i], 2)
    }
    return str
  }
  var hexu = function (buffer) {
    return hexl(buffer).toUpperCase()
  }

  var pad = function(b, len) {
    var s = b.toString(16)
    
    while (s.length < len) {
      s = "0" + s
    }
    return s
  } 
  var rpad = function(s, len) {
    while(s.length < len) {
      s += " "
    }
    return s
  }

}
/*
var fs = require('fs'),
    file = process.argv[2]


var data = fs.readFileSync(file)
//console.log(hexy(data))
var format = {}
//format.format = "fours"
format.caps   = "upper"
format.annotate = "none"
//format.numbering = "none"
format.width = 8
console.log(hexy(data, format))
console.log("doen")
*/

exports.hexy = hexy