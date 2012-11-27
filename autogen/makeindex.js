var sax = require('sax');
var fs = require('fs');
var xml2js = require('xml2js')
var assert = require('assert');

var count = 0;

function addToIndex(dir, index, callback, name) {

  count++;
  var header;

  var parser = sax.createStream(true);
  var stream = fs.createReadStream(dir + '/' + name).pipe(parser);
  parser.on('end', function() {
     count--;
     if (count == 0)
         callback(index);
  });
  parser.on('opentag', 
    function(tag) {
       if (tag.name == 'xcb') {
          header = tag.attributes.header;
          index[header] = tag.attributes;
          index[header].file = dir + name;
          index[header].depends = []; 
          return;
       }  
    }
  );
  parser.on('closetag',
    function(tag) {
       if (tag == 'import')
       {
          index[header].depends.push(parser.lastText);
       }
    }
  );

  parser.on('text', 
    function(text) { 
       parser.lastText = text;
    }
  );
}


function grep(re, str)
{
   return str.match(re);
}

function makeIndex(dir, callback) {
  var index = {};
  fs.readdirSync(dir)
    .filter(grep.bind(null, /xml$/))
    .forEach(addToIndex.bind(null, dir, index, callback));
}

module.exports = makeIndex;
