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
           , isValueMask: isValueMask
           , isListAccountedFor: isListAccountedFor
           , bufPackType: bufPackType
           , requestLengthIndex: requestLengthIndex
           , listLenIndex: listLenIndex
           , realIndex: realIndex
           }

;['requests'].forEach(function(name) {
  var tplFile = fs.readFileSync('stubs/' + name + '.tpl').toString().replace(/\n\s*{{/g, '{{').replace(/}}\s*$/g, '}}')
  fs.writeFileSync('lib/x11/autogen/' + name + '.js', jqtpl.tmpl(tplFile, data))
})

function getValueMask(requestName) {
  return typeLookup.valuemaskEnum[requestName] && xProto.enum[typeLookup.valuemaskEnum[requestName]].field
}

function getDelim(i, ch) {
  return i == 0 ? (ch != null ? ch : '{') : ','
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

function bufPackType(type) {
  return typeLookup.packTypes[type]
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

function prePackFirst(request, j) {
  if (j != null) console.log(request.opcode < 128, j, request.field[0])
  return request.opcode < 128
}

function requestLengthIndex(request) {
  return prePackFirst(request) && request.field && request.field[0].fieldType != 'pad' ? 2 : 1
}

function isValueMask(field) {
  return field.fieldType == 'valueparam'
}

function listLenName(field) {
    return field.fieldType == 'list' ? field.name + '_len'
      : field['value-mask-name']
}

function isListAccountedFor(request, field) {
  var name = listLenName(field)
  return field.name == 'keysyms'
  || field.name == 'keycodes'
  || field.name == 'event'
  || !request.field.every(function(f) {
    return name != f.name
  })
}

function listLenIndex(request, field) {
  var index = 1
    , name = listLenName(field)
  for (var i = 0, len = request.field.length; i < len; ++i) {
    if (request.field[i].name == name) return index
    if (request.field[i].fieldType == 'field') index++;
  }
}

function realIndex(request, field) {
  var index = 0
  for (var i = 0, len = request.field.length; i < len; ++i) {
    if (request.field[i] == field) return index
    if (request.field[i].fieldType == 'field') index++;
  }
}
