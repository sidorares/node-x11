var structs = exports
  , xutil = require('../xutil')
  , parameterOrder = xutil.parameterOrder
  , size = xutil.formatSize
  , associate = xutil.associate

{{each(structName, attr) structs}}

structs.${structName} = {}

structs.${structName}.pack = function pack${structName}(obj, format) {
  format = format || ""
  format += '{{each(j, field) structs[structName].field}}${getBufPack(field)}{{/each}}'
  var args = [ {{each(i, field) nonPad(attr.field)}}
              {{if field.fieldType == 'valueparam' && !(isListAccountedFor(structs[structName], field))}}
      ${getDelim(i, "  ", ", ")}'${listLengthName(field)}'
              {{/if}}
      ${getDelim(i, "  ", ", ")}'${fieldName(field)}'
            {{/each}} ]
    , addSize = 0
  {{html packList(1, "args", "format", structs[structName].field, structName)}}
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.${structName}.unpack = function unpack${structName}(buf, offset) {
  offset = offset || 0
  var fields{{if shiftedFirstType(structs[structName].field, 'field')}} =
      {{each(j, field) structs[structName].field}}
      {{if field.fieldType == 'field'}}
      ${getDelim(realIndex(structs[structName].field, field), '[')} '${field.name}'
      {{/if}}
    {{/each}} ]
    {{/if}}
    , format = "{{each(j, field) structs[structName].field}}${getBufPack(field)}{{/each}}"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  {{html unpackList(1, "ret", "buf", "offset", structs[structName].field, structName)}}
  return [ret, offset]
}
{{/each}}
