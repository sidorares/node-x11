{{each(i, field) list}}
{{if isListType(field)}}
  {{if field.type == 'char' || field.type == 'void' }}
${obj}.${prepPropName(field.name)} = ${buf}.slice(${offset}, ${offset} + ${obj}.${listLengthName(field)}).toString()
${offset} += ${obj}.${listLengthName(field)}
  {{else}}
    {{if field.value != null}}
    {{else bufPackType(field.type)}}
var len = ${obj}.${listLengthName(field)}
${obj}.${prepPropName(field.name)} = ${buf}.unpack(new Array(len + 1).join("${bufPackType(field.type)}"), ${offset})
${offset} = ${obj}.${prepPropName(field.name)}.offset
    {{else}}
var i = 0
  , len = ${obj}.${listLengthName(field)}
${obj}.${prepPropName(field.name)} = []
for (; i < len; ++i) {
  var result = structs.${field.type}.unpack(${buf}, ${offset})
  ${obj}.${prepPropName(field.name)}.push(result[0])
  ${offset} = result[1]
}
    {{/if}}
  {{/if}}
{{/if}}
{{/each}}
