var sax = require('sax');
var fs = require('fs');
var assert = require('assert');
var oe = process.exit;
process.exit = function() {
    console.trace();
    oe(0);
}

var keywords = {
    'class': 'windowClass'
};

function camelcase(name) {
  name = name.split('_').reduce(function(str, word){
    return str + word[0].toUpperCase() + word.slice(1);
  });
  var keyword = keywords[name];
  return keyword ? keyword : name;
}

function camelParam(a)
{
  return a[0].toLowerCase() + a.substr(1);
}

var baseTypeSize = {
   'enum': 1,
   'BOOL': 1,
   'UInt8': 1,
   'Int8': 1,
   'UInt16LE': 2,
   'Int16LE': 2,
   'UInt32LE': 4,
   'Int32LE': 4
}

var types = {
  'BOOL': 'UInt8',
  'BYTE': 'Int8',
  'CARD8': 'UInt8',
  'INT8': 'Int8',
  'CARD16': 'UInt16LE',
  'INT16': 'Int16LE',
  'CARD32': 'UInt32LE',
  'INT32': 'Int32LE'
}

function readProto(index, protoname, structs) {
     
    var name = index[protoname].file;

var structs = {}

var parser = sax.createStream(true);

parser.startStruct = function(name, type) {
   parser.offset = 0;
   if (structs[name]) {
      console.log(structs[name]);
      console.log(name, type);
      //process.exit(0);
   }
   //assert.isUndefinedOrNull(structs[name]);
   parser.struct = structs[name] = {};
   parser.struct.body = [];
   parser.struct.name = name;
   parser.struct.type = type;
   parser.struct.reply = [];
   parser.active = parser.struct.body;   
}

parser.stack = [];

fs.createReadStream(name).pipe(parser);

parser.on('opentag', 
  function(tag) {
    if (parser.inDoc)
      return;
    parser.stack.push(tag.name);
    switch (tag.name) {
    case 'typedef':
       types[tag.attributes.newname] = types[tag.attributes.oldname];
       break;
    case 'xidtype':
    case 'xidunion':
       types[tag.attributes.name] = types.CARD32;
       break;
    case 'reply':
       parser.active = parser.struct.reply;
       break;
    case 'request':
    case 'request':
    case 'struct':
    case 'event':
    case 'error':
    case 'enum':
       if (!tag.attributes.name)
       {
           console.log(['NO NAME!!!', parser.stack, tag.attributes.name, tag]); //process.exit(0);
       }
       parser.startStruct(tag.attributes.name, tag.name);
       if (tag.name == 'request') {
         var op = parser.struct.opcode = parseInt(tag.attributes.opcode);
         assert.strictEqual(op.toString(), tag.attributes.opcode);
       }
       break;
    case 'field':
       var f = {name: camelcase(tag.attributes.name), type: tag.attributes.type };
       // copy all values in this list from attr to result
       ['expression'].forEach(function(ff) { if (tag.attributes[ff]) { f[ff] = tag.attributes[ff] }});
       parser.active.push(f);
       break;
    case 'pad':
       parser.active.push({pad: parseInt(tag.attributes.bytes), type: 'pad' });
       break;
    case 'item':
       parser.active.push({name: tag.attributes.name});
       break;
    case 'valueparam':
       parser.active.push({
           type: 'valueparam', 
           maskRef: camelcase(tag.attributes['value-mask-name']),
           maskType: tag.attributes['value-mask-type'],
           listRef: tag.attributes['value-list-name']
       });
       break;
    case 'list':
       parser.active.push({
           name: tag.attributes.name,
           type: 'list',
           elemType: tag.attributes.type
       });
       break;
    case 'doc':
       parser.inDoc = true;
       break;
    } 
  }
);

parser.on('closetag',
  function(tag) {
    parser.stack.pop();
    if (tag === 'doc')
    {
        parser.inDoc = false;
        return;
    }
    if (parser.inDoc)
      return;
    switch (tag) {
    case 'reply':
        parser.active = parser.struct.body;
        break;
    case 'item':
        parser.struct.body[parser.struct.body.length-1].value = parser.lastValue;
        break;
    case 'value':
        parser.lastValue = parseInt(parser.lastText); 
        break;
    case 'bit':
        parser.lastValue = 1<<parseInt(parser.lastText); 
        break;
    case 'struct':
        break;
    //case 'fieldref':
    //    parser.active[parser.active.length-1].fieldref = parser.lastText;
    //    break;
    case 'xcb':
        //console.log(structs.GetWindowAttributes);
        //console.log(structs.CW);
        //console.log(structs);
        //genWriteReq(structs.CreateWindow);
        //genWriteReq(structs.ConfigureWindow);
        //break;
        console.log("var requests = {");
        var reqsArr = []; //ugly
        for (s in structs) {
          if (structs[s].type == 'request')
            reqsArr.push(structs[s]); 
        }
        for (var i=0; i < reqsArr.length; ++i)
          genReq(reqsArr[i], i+1==reqsArr.length);
        break;
    }
  }
);

parser.on('text', 
  function(text) 
  { 
    parser.lastText = text 
  }
);

function fieldLength(f)
{
   if (f.type === 'pad')
     return f.pad;
   if (f.type === 'valueparam')
     return 0; // depend on actual input, calculation inserted into generated code
   if (f.type === 'list')
     return 0;
   if (f.type === 'STRING8')
     return 0;
   var len = baseTypeSize[types[f.type]]; 
  if (!len)
   {
      console.log('unknown field:', f);
      console.log('at input line: ' + parser._parser.line);
      process.exit(0);
   } 
   return len;
}

function genReply(reply, result)
{
  var offset = 0;
  result.push('  },');
  var rep0 = reply[0];
  if (rep0.type != 'pad') {
    assert.equal(fieldLength(rep0), 1);
    result.push('  function(data, ' + rep0.name + ') {');
    result.push('    var result = {};');
    result.push('    result.' + rep0.name + ' = ' + rep0.name + ';');
  } else {
    result.push('  function(data) {');
    result.push('    var result = {};');
  }
  // de-serealise fields array
  result.push('    // fields here');
  result.push('    return result;');
  result.push('  }');    
  return result; 
}

function genReq(req, last)
{
   var result = [];
   // 1) calculate length
   //console.log(req.body);
   var reqLen = 4; // byte 0 = opcode + 2,3= size (BigReq = off)
   result.push(req.name + ': [');
  
   //
   // special cases for frequent cases: no parama, 1 4 byte param etc.
   // TODO: have a template buffers, copy & update opcode+param?
   // measure performance first
   //
   if (req.body.length == 0)
   {       
       result.push('  function() {');
       result.push('     return new Buffer([' + req.opcode + ', 0, 1, 0]);');
   } else {
   result.push('  function (args) {');
   result.push('    var extraLength = 0;');
   var extraLength = false;
   for (var arg = 1; arg < req.body.length; ++arg) {
      var field = req.body[arg];
      reqLen += fieldLength(field);
      if (field.type === 'valueparam')
      {
          extraLength = true;
          //console.log('valueparam field, ', field);
          // linear search, gives us n^2 performance in the worst case 
          // but for xcore and all extensions we don't have bad cases
          for (var i=arg-1; i > 1; --i) // we don't support param0 as a valuemask
          {
              if (req.body[i].name === field.maskRef)
              {
                 req.body[i].valueList = field;
                 field.mask = req.body[i];
                 break;
              }  
          }

            result.push('    for (var i in ' + field.listRef + ') {');
            result.push('      if (args[i] != undefined) {');
            result.push('        extraLength += 4;'); //TODO: value list value type here
            result.push('      }');
            result.push('    }');

      }
   }
   var reqLen4 = ((reqLen + 3) >> 2);

   if (extraLength)
     result.push('    var data = new Buffer(' + reqLen + ' + extraLength);');
   else {
     result.pop(); 
     result.push('    var data = new Buffer(' + reqLen + ');');
   } 
   result.push('    data[0] = ' + req.opcode + ';');
   if (req.body.length != 0) {
     if (req.body[0].type != 'pad')
        result.push('    data[1] = args[\'' + req.body[0].name + '\'];'); 
     var offset = 4;
     for (var arg = 1; arg < req.body.length; ++arg)
	     {
        var f = req.body[arg];
        if (f.type === 'pad') {
            offset += f.pad;
        } else if (f.valueList) {
            var valueListStruct = structs[f.valueList.listRef];
            assert(valueListStruct, "undefined reference to valueList");
            result.push('    // value mask for ' + valueListStruct.name + ' parameters');
            f.valueList.maskOffset = offset;
            offset += fieldLength(f);
        } else if (f.type === 'valueparam') {
            if (f.mask)
               f.maskType = f.mask.type;
            else {
               f.maskOffset = offset;
               offset += baseTypeSize[types[f.maskType]];
            }

            // TODO: maybe is better to loop args and check if it present in listRef struct? instead of iterating listRef 
            result.push('    // values for ' + f.listRef);
            result.push('    var mask = 0;');
            result.push('    var offset = ' + offset + ';');
            result.push('    for (var i in ' + f.listRef + ') {');
            result.push('      if (args[i] != undefined) {');
            result.push('        mask |= ' + f.listRef + '[i];');
            // TODO: list-item-type? or type for each listRef enum
            // currently hardcoded CARD32           
            result.push('        data.writeUInt32LE(args[i], offset);');
            result.push('        offset +=4;');
            result.push('      }');
            result.push('    }');
            result.push('    data.write' + types[f.maskType] + '(mask, ' + f.maskOffset + ')');
        } else if (f.type === 'STRING8') {
            result.push('    data.write(args[' + f.name + '], offset);');
            result.push('    offset += args[' + f.name + '].lengt');
        } else {
            if (f.expression)
              result.push('    data.write' + types[f.type] + '(' + f.expression + ', ' + offset + ');');
            else
              result.push('    data.write' + types[f.type] + '(args[\'' + req.body[arg].name + '\'], ' + offset + ');');
            offset += fieldLength(f);
        }
     }
   } else {
     result.push('    data[1] = 0;'); 
   }
   if (!extraLength)
     result.push('    data.writeUInt16LE(' + reqLen4 + ', 2);');
   else
     result.push('    data.writeUInt16LE(' + reqLen4 + '+(extraLength+3)>>2, 2);');
   result.push('    return data;');
  
   } // if no params
  
   if (req.reply.length == 0) {
       result.push('  }');
   } else {
       genReply(req.reply, result);
  }
   result.push(']' + (last ? '}' : ','))
   console.log(result.join('\n'));
}

}

var index = require('./makeindex');
index('./proto/', function(index) {
  readProto(index, 'xproto');
});

