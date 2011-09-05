var fs = require('fs')
  , jqtpl = require("jqtpl")
  , typeLookup = JSON.parse(fs.readFileSync('protocols/xTypes.json'))
  , xProto = JSON.parse(fs.readFileSync('protocols/xProtocol.json'))
  , data = { requests: xProto.request
           , getValueMask: getValueMask
           , getDelim: getDelim
           , enumVal: enumVal
           , getBufPack: getBufPack
           , isListType: isListType
           , prepPropName: prepPropName
           , firstType: firstType
           , prePackFirst: prePackFirst
           }

;['requests'].forEach(function(name) {
  var tplFile = fs.readFileSync('stubs/' + name + '.tpl').toString().replace(/\n\s*{{/g, '{{').replace(/}}\s*$/g, '}}')
  fs.writeFileSync('lib/x11/autogen/' + name + '.js', jqtpl.tmpl(tplFile, data))
})

function getValueMask(requestName) {
  return typeLookup.valuemaskEnum[requestName] && xProto.enum[typeLookup.valuemaskEnum[requestName]].field
}

function getDelim(i, ch) {
  return i == 0 ? (ch || '{') : ','
}

function enumVal(val) {
  return val.value ? val.value
  : val.bit ? 1 << val.bit
  : 0
}

function isListType(field) {
  return field.fieldType === 'list' || field.fieldType === 'valueparam'
}

function getBufPack(field) {
  return !field ? 'x'
  : field.fieldType === 'pad' ? new Array(parseInt(field.bytes) + 1).join('x')
  : isListType(field) ? ''
  : typeLookup.packTypes[field.type]
}

function prepPropName(short) {
  return short === 'new' ? '_new' 
  : short === 'class' ? '_class'
  : short === 'delete' ? '_delete'
  : short
}

function firstType(field, type) {
  var f
  return field.some(function(field) {
    f = field
    return field.fieldType == type 
  }) && f
}

function prePackFirst(request) {
  return request.opcode < 128
}
