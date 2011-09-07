{{each(i, field) list}}
{{if isListType(field)}}
  {{if field.type == 'char' }}
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
