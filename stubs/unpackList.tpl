{{each(i, field) list}}
  {{if isListType(field)}}
    {{if field.type == 'char' }}
${obj}.${prepPropName(field.name)} = ${buf}.slice(${offset}, ${offset} + ${obj}.${listLengthName(field)}).toString()
${offset} += ${obj}.${listLengthName(field)}

    {{/if}}
  {{/if}}
{{/each}}
