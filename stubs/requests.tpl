var packMask = require('../valuemask')
  , xutil = require('../xutil')
  , structs = require('./structs')
  ,  valueMask =
{{each(i, requestName) Object.keys(requests)}}
{{if getValueMask(requestName) }}
  ${getDelim(i)} ${requestName}:
    {{each(i, value) getValueMask(requestName)}}
    ${getDelim(i)} ${value.name}: ${enumVal(value)}
    {{/each}}
  }
{{/if}}
{{/each}}
}
  , parameterOrder = xutil.parameterOrder
  , size = xutil.formatSize
  , associate = xutil.associate 


module.exports = 
{{each(i, reqName) Object.keys(requests)}}
${getDelim(i)} ${reqName}: 
  [ function(obj, cb) {
      var format = '{{if prePackFirst(requests[reqName])}}C${getBufPack(requests[reqName].field && requests[reqName].field[0])}{{else}}S{{/if}}S{{each(j, field) requests[reqName].field}}{{if !(prePackFirst(requests[reqName]) && j === 0)}}${getBufPack(field)}{{/if}}{{/each}}'
        , args   = [ null
        {{if prePackFirst(requests[reqName]) && requests[reqName].field && requests[reqName].field[0].name}}
          , '${prepPropName(requests[reqName].field[0].name)}'
        {{/if}}
          , null
        {{each(j, field) requests[reqName].field}}
        {{if field.fieldType != 'pad' && !(j === 0 && prePackFirst(requests[reqName]))}}
          {{if field.fieldType == 'valueparam' && !(isListAccountedFor(requests[reqName], field))}}
          , '${listLengthName(field)}'
          {{/if}}
          , '${fieldName(field)}'
        {{/if}}
        {{/each}}
          ]
        , addSize = 0
      {{html packList(3, "args", "format", requests[reqName].field, reqName)}}
      args = parameterOrder(args, obj)
      args[0] = ${requests[reqName].opcode}
      args[${requestLengthIndex(requests[reqName])}] = size(format) + addSize
      return [format, args]
    }
  {{if requests[reqName].reply}}
  , function(buf, prop) {
      var fields{{if shiftedFirstType(requests[reqName].reply.field, 'field')}} =
          {{each(j, field) requests[reqName].reply.field.slice(1)}}
          {{if field.fieldType == 'field'}}
          ${getDelim(realIndex(requests[reqName].reply.field.slice(1), field), '[')} '${field.name}'
          {{/if}}
        {{/each}} ]
        {{/if}}
        , format = "{{each(j, field) requests[reqName].reply.field.slice(1)}}${getBufPack(field)}{{/each}}"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      {{if isFieldFirst(requests[reqName].reply.field)}}
      reply.${requests[reqName].reply.field[0].name} = prop
      {{/if}}
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      {{html unpackList(3, "reply", "buf", "unpacked.offset", requests[reqName].reply.field, reqName)}}
      return reply
      
    }
  {{/if}}
  ]
{{/each}}
}
