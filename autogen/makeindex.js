const sax = require('sax');
const fs = require('fs');

let count = 0;

function addToIndex(dir, index, callback, name) {

  count++;
  let header;

  const parser = sax.createStream(true);
  const stream = fs.createReadStream(`${dir}/${name}`).pipe(parser);
  parser.on('end', () => {
     count--;
     if (count == 0)
         callback(index);
  });
  parser.on('opentag', 
    tag => {
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
    tag => {
       if (tag == 'import')
       {
          index[header].depends.push(parser.lastText);
       }
    }
  );

  parser.on('text', 
    text => { 
       parser.lastText = text;
    }
  );
}


function grep(re, str)
{
   return str.match(re);
}

function makeIndex(dir, callback) {
  const index = {};
  fs.readdirSync(dir)
    .filter(grep.bind(null, /xml$/))
    .forEach(addToIndex.bind(null, dir, index, callback));
}

module.exports = makeIndex;
