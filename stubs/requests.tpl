var packMask = require('./valuemask')
  ,  valueMask = {
{{each(requestName, request) requests}}
{{if getValueMask(requestName) }}
  ${requestName}:
    {{each(i, value) getValueMask(requestName)}}
    ${getDelim(i)} ${value.name}: ${enumVal(value)}
    {{/each}}
  }
{{/if}}
{{/each}}
}

function parameterOrder(params, obj) {
  return params.map(function(name) {
    return name && obj[name]
  })
}

module.exports = 
{{each(i, reqName) Object.keys(requests)}}
${getDelim(i)} ${reqName}: 
  [ function(obj, cb) {
      var format = '{{if prePackFirst(requests[reqName])}}C${getBufPack(requests[reqName].field && requests[reqName].field[0])}{{else}}S{{/if}}S{{each(j, field) requests[reqName].field}}{{if !(prePackFirst(requests[reqName]) && j === 0)}}${getBufPack(field)}{{/if}}{{/each}}'
        , args   = parameterOrder([ null
        {{if prePackFirst(requests[reqName]) && requests[reqName].field && requests[reqName].field[0].name}}
          , '${prepPropName(requests[reqName].field[0].name)}'
        {{/if}}
          , null
        {{each(j, field) requests[reqName].field}}
        {{if field.fieldType == 'field' && !(j === 0 && prePackFirst(requests[reqName]))}}
          , '${prepPropName(field.name)}'
        {{/if}}
        {{/each}}
          ], obj)
      {{each(j, field) requests[reqName].field}}
      {{if isListType(field)}}
      {{if isValueMask(field)}}
        , packed = packMask(valueMask[${reqName}], obj.${prepPropName(field['value-mask-name'])})

        {{if isListAccountedFor(requests[reqName], field)}}
      args[${listLenIndex(requests[reqName], field)}] = packed[0]
        {{else}}
      format += "${bufPackType(field['value-mask-type'])}"
      args.push(packed[0])
        {{/if}}
      args = args.concat(packed[1])
      format += new Array(packed[1].length + 1).join("${bufPackType('CARD32')}")
      {{/if}}
      {{/if}}
      {{/each}}
      args[0] = ${requests[reqName].opcode}
      args[${requestLengthIndex(requests[reqName])}] = 123//get to this later

      return [format, args]
    }
  {{if requests[reqName].reply}}
  , function(buf, format) {

    }
  {{/if}}
  ]
{{/each}}
}
