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
    return obj[name]
  })
}

module.exports = 
{{each(i, reqName) Object.keys(requests)}}
${getDelim(i)} ${reqName}: 
  [ function(obj, cb) {
      var format = '{{if prePackFirst(requests[reqName])}}C${getBufPack(requests[reqName].field && requests[reqName].field[0])}{{else}}S{{/if}}S{{each(j, field) requests[reqName].field}}{{if !(prePackFirst(requests[reqName]) && j === 0)}}${getBufPack(field)}{{/if}}{{/each}}'
        , args   = parameterOrder({{each(j, field) requests[reqName].field}}{{if field.fieldType == 'field'}} ${getDelim(firstType(requests[reqName].field, 'field') != field, '[')} '${prepPropName(field.name)}'{{/if}}{{/each}} ], obj)
      {{if getValueMask(reqName)}}
        , packed = packMask(valueMask[${reqName}], obj.${getValueMaskName(requests)})
      {{/if}}
    }
  {{if requests[reqName].reply}}
  , function(buf, format) {

    }
  {{/if}}
  ]
{{/each}}
}
