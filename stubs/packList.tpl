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
    {{else}}

var buf_name = new Buffer(${field.value})
buffer.write(obj.${field.name})
addSize += ${field.value} / 4
format += 'a'
    {{/if}}
  {{else}}

obj.${prepPropName(field.name)} = Array.isArray(obj.${prepPropName(field.name)}) ? obj.${prepPropName(field.name)} : [obj.${prepPropName(field.name)}]
    {{if bufPackType(field.type)}}
var len = obj.${prepPropName(field.name)}.length
format += new Array(len + 1).join("${bufPackType(field.type)}")
obj.${listLengthName(field)} = len
    {{else}}
var i = 0
  , len = obj.${prepPropName(field.name)}.length
obj.${listLengthName(field)} = len
for (; i < len; ++i) {
  var result = structs.${field.type}.pack(obj.${prepPropName(field.name)}[i], format)
  format = result[0]
  obj.${prepPropName(field.name)}[i] = result[1]
  addSize += result[2]
}
    {{/if}}
  {{/if}}
{{/if}}
{{/each}}
