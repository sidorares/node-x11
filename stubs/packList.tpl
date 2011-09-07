{{each(i, field) list}}
{{if isListType(field)}}
  {{if isValueMask(field)}}
var packed = packMask(valueMask['${theName}'], obj.${prepPropName(field['value-mask-name'])})
obj.${field['value-mask-name']} = packed[0]
    {{if !(isListAccountedFor(requests[theName], field))}}
format += "${bufPackType(field['value-mask-type'])}"
    {{/if}}
obj.${field['value-list-name']} = packed[1]
format += new Array(packed[1].length + 1).join("${bufPackType('CARD32')}")

  {{else field.type == 'char' }}
    {{if field.value == null }}
var len = xutil.padded_length(obj.${prepPropName(field.name)}.length)
  , buf_name = new Buffer(len)
obj.${listLengthName(field)} = Buffer.byteLength(obj.${prepPropName(field.name)})
buf_name.write(obj.${field.name})
obj.${field.name} = buf_name
format += 'a'
addSize += (len / 4)
    {{/if}}
  {{/if}}
{{/if}}
{{/each}}
