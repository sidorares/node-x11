var packMask = require('../valuemask')
  , xutil = require('../xutil')
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

function parameterOrder(params, obj) {
  var ret = []
  params.forEach(function(name, i) {
    if (Array.isArray(obj[name])) return ret = ret.concat(obj[name])
    else ret[i] = name && obj[name]
  })
  return ret;
}

function size(str) {
  var i = str.length
    , size = 0
  while(i--) {
    switch(str[i]) {
      case 'C':
      case 'c':
      case 'x':
        size += 1
        break;
      case 'S':
      case 's':
        size += 2
        break;
      case 'L':
      case 'l':
        size += 4
        break;
    }
  }
  return size / 4
}

function associate(arr1, arr2) {
  var ret = {}
  for(var i = 0, len = Math.min(arr1.length, arr2.length); i < len; ++i) {
    ret[arr1[i]] = arr2[i]
  }
  return ret
}

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
        {{if (field.fieldType == 'field' || field.fieldType == 'valueparam' || field.type == 'char') && !(j === 0 && prePackFirst(requests[reqName]))}}
          {{if field.fieldType == 'valueparam'}}
            {{if !(isListAccountedFor(requests[reqName], field))}}
          , '${listLengthName(field)}'
            {{/if}}
          , '${field['value-list-name']}'
          {{else}}
          , '${prepPropName(field.name)}'
          {{/if}}
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
