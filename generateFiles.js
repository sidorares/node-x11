var fs = require('fs')
  , jqtpl = require("jqtpl")
  , typeLookup = JSON.parse(fs.readFileSync('protocols/xTypes.json'))
  , xProto = JSON.parse(fs.readFileSync('protocols/xProtocol.json'))
  , data = { requests: xProto.request
           , structs: xProto.struct
           , getValueMask: getValueMask
           , getDelim: getDelim
           , enumVal: enumVal
           , getBufPack: getBufPack
           , isListType: isListType
           , prepPropName: prepPropName
           , firstType: firstType
           , shiftedFirstType: shiftedFirstType
           , prePackFirst: prePackFirst
           , isValueMask: isValueMask
           , isListAccountedFor: isListAccountedFor
           , bufPackType: bufPackType
           , requestLengthIndex: requestLengthIndex
           , listLenIndex: listLenIndex
           , realIndex: realIndex
           , unpackList: unpackList
           , packList: packList
           , getFieldRef: getFieldRef
           , isFieldFirst: isFieldFirst
           , listLengthName: listLengthName
           , fieldName: fieldName
           , nonPad: nonPad
           }

;['requests', 'structs'].forEach(function(name) {
  var tplFile = fs.readFileSync('stubs/' + name + '.tpl').toString().replace(/\n\s*{{/g, '{{').replace(/}}\s*$/g, '}}')
  fs.writeFileSync('lib/x11/autogen/' + name + '.js', jqtpl.tmpl(tplFile, data))
})

function getValueMask(requestName) {
  return typeLookup.valuemaskEnum[requestName] && xProto.enum[typeLookup.valuemaskEnum[requestName]].field
}

function getDelim(i, first, rest) {
  return i == 0 ? (first != null ? first : '{') : (rest != null ? rest : ',')
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

function shiftedFirstType(field, type) {
  return firstType(field.slice(1), 'field')
}

function prePackFirst(request) {
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
  for (var i = 0, len = request.length; i < len; ++i) {
    if (request[i] == field) return index
    if (request[i].fieldType == 'field') index++;
  }
}

function unpackList(indents, obj, buf, offset, list, name) {
  var subData = {} //Object.create(data)
    , key
  for (key in data) subData[key] = data[key]
  subData.buf = buf
  subData.offset = offset
  subData.obj = obj
  subData.list = list
  subData.theName = name
  var tplFile = fs.readFileSync('stubs/unpackList.tpl').toString().replace(/\n\s*{{/g, '{{').replace(/}}\s*$/g, '}}')
  return indent(indents, jqtpl.tmpl(tplFile, subData))
}

function packList(indents, args, format, list, name) {
  var subData = {} //Object.create(data)
    , key
  for (key in data) subData[key] = data[key]
  subData.args = args
  subData.format = format
  subData.list = list
  subData.theName = name
  var tplFile = fs.readFileSync('stubs/packList.tpl').toString().replace(/\n\s*{{/g, '{{').replace(/}}\s*$/g, '}}')
  return indent(indents, jqtpl.tmpl(tplFile, subData))
}

function indent(num, lines) {
  var indent = new Array(num + 1).join('  ')
  return lines.split('\n').map(function(line) {
    return line ? indent + line : ''
  }).join('\n')
}

function getFieldRef(name, field, obj) { //todo read operators appropriately
  return field.fieldType == 'valueparam' ? field['value-mask-name']
  : field.fieldref ? field.fieldref
  : field.value ? field.value
  : name == 'GetProperty' ? obj + ".format / 8 * " + obj  + ".value_len"
  : name == 'GetModifierMapping' ? obj + ".keycodes_per_modifier * 8"
  : "0"
}

function listLengthName(field) {
  return field.fieldType == 'valueparam' ? field['value-mask-name']
  : field.fieldref ? field.fieldref
  : field.value ? field.value
  : field.name + '_len'
}

function isFieldFirst(fields) {
  return fields[0].fieldType == 'field'
}

function fieldName(field) {
  return prepPropName(
    field.fieldType == 'valueparam' ? field['value-list-name']
    : field.name
  )
}

function nonPad(fields){
  return fields.filter(function(field){
    return field.fieldType != 'pad'
  })
}
