var packMask = require('../valuemask')
  , xutil = require('../xutil')
  , structs = require('./structs')
  ,  valueMask =
  { CreateWindow:
    { BackPixmap: 1
    , BackPixel: 2
    , BorderPixmap: 4
    , BorderPixel: 8
    , BitGravity: 16
    , WinGravity: 32
    , BackingStore: 64
    , BackingPlanes: 128
    , BackingPixel: 256
    , OverrideRedirect: 512
    , SaveUnder: 1024
    , EventMask: 2048
    , DontPropagate: 4096
    , Colormap: 8192
    , Cursor: 16384
  }
  , CreateGC:
    { Function: 1
    , PlaneMask: 2
    , Foreground: 4
    , Background: 8
    , LineWidth: 16
    , LineStyle: 32
    , CapStyle: 64
    , JoinStyle: 128
    , FillStyle: 256
    , FillRule: 512
    , Tile: 1024
    , Stipple: 2048
    , TileStippleOriginX: 4096
    , TileStippleOriginY: 8192
    , Font: 16384
    , SubwindowMode: 32768
    , GraphicsExposures: 65536
    , ClipOriginX: 131072
    , ClipOriginY: 262144
    , ClipMask: 524288
    , DashOffset: 1048576
    , DashList: 2097152
    , ArcMode: 4194304
  }
}
  , parameterOrder = xutil.parameterOrder
  , size = xutil.formatSize
  , associate = xutil.associate 

function padEnd(form, addSize, index) {
  var s = size(form[0]) + addSize
  form[0] += new Array(s * 4 % 4 + 1).join('x')
  form[1][index] = Math.ceil(s)
  return form
}

module.exports = 
{ CreateWindow: 
  [ function(obj, cb) {
      var format = 'CCSLLssSSSSL'
        , args   = [ null
          , 'depth'
          , null
          , 'wid'
          , 'parent'
          , 'x'
          , 'y'
          , 'width'
          , 'height'
          , 'border_width'
          , '_class'
          , 'visual'
          , 'value_mask'
          , 'value_list'
          ]
        , addSize = 0
      var packed = packMask(valueMask['CreateWindow'], obj.value_mask)
      obj.value_mask = packed[0]
      format += "L"
      obj.value_list = packed[1]
      format += new Array(packed[1].length + 1).join("L")
      args = parameterOrder(args, obj)
      args[0] = 1
      return padEnd([format, args], addSize, 2)
    }
  ]
, ChangeWindowAttributes: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          , 'value_mask'
          , 'value_list'
          ]
        , addSize = 0
      var packed = packMask(valueMask['ChangeWindowAttributes'], obj.value_mask)
      obj.value_mask = packed[0]
      format += "L"
      obj.value_list = packed[1]
      format += new Array(packed[1].length + 1).join("L")
      args = parameterOrder(args, obj)
      args[0] = 2
      return padEnd([format, args], addSize, 1)
    }
  ]
, GetWindowAttributes: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 3
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'visual'
          , 'class'
          , 'bit_gravity'
          , 'win_gravity'
          , 'backing_planes'
          , 'backing_pixel'
          , 'save_under'
          , 'map_is_installed'
          , 'map_state'
          , 'override_redirect'
          , 'colormap'
          , 'all_event_masks'
          , 'your_event_mask'
          , 'do_not_propagate_mask' ]
        , format = "LSCCLLCCCCLLLSxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.backing_store = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, DestroyWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 4
      return padEnd([format, args], addSize, 1)
    }
  ]
, DestroySubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 5
      return padEnd([format, args], addSize, 1)
    }
  ]
, ChangeSaveSet: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = [ null
          , 'mode'
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 6
      return padEnd([format, args], addSize, 2)
    }
  ]
, ReparentWindow: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = [ null
          , null
          , 'window'
          , 'parent'
          , 'x'
          , 'y'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 7
      return padEnd([format, args], addSize, 1)
    }
  ]
, MapWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 8
      return padEnd([format, args], addSize, 1)
    }
  ]
, MapSubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 9
      return padEnd([format, args], addSize, 1)
    }
  ]
, UnmapWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 10
      return padEnd([format, args], addSize, 1)
    }
  ]
, UnmapSubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 11
      return padEnd([format, args], addSize, 1)
    }
  ]
, ConfigureWindow: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = [ null
          , null
          , 'window'
          , 'value_mask'
          , 'value_list'
          ]
        , addSize = 0
      var packed = packMask(valueMask['ConfigureWindow'], obj.value_mask)
      obj.value_mask = packed[0]
      obj.value_list = packed[1]
      format += new Array(packed[1].length + 1).join("L")
      args = parameterOrder(args, obj)
      args[0] = 12
      return padEnd([format, args], addSize, 1)
    }
  ]
, CirculateWindow: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = [ null
          , 'direction'
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 13
      return padEnd([format, args], addSize, 2)
    }
  ]
, GetGeometry: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'drawable'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 14
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'root'
          , 'x'
          , 'y'
          , 'width'
          , 'height'
          , 'border_width' ]
        , format = "LssSSSxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.depth = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, QueryTree: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 15
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'root'
          , 'parent'
          , 'children_len' ]
        , format = "LLSxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = reply.children_len
      reply.children = buf.unpack(new Array(len + 1).join("L"), unpacked.offset)
      unpacked.offset = reply.children.offset
      return reply
      
    }
  ]
, InternAtom: 
  [ function(obj, cb) {
      var format = 'CCSSxx'
        , args   = [ null
          , 'only_if_exists'
          , null
          , 'name_len'
          , 'name'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.name.length)
        , buf_name = new Buffer(len)
      obj.name_len = Buffer.byteLength(obj.name)
      buf_name.write(obj.name)
      obj.name = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 16
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'atom' ]
        , format = "L"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, GetAtomName: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'atom'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 17
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'name_len' ]
        , format = "Sxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      reply.name = buf.slice(unpacked.offset, unpacked.offset + reply.name_len).toString()
      unpacked.offset += reply.name_len
      return reply
      
    }
  ]
, ChangeProperty: 
  [ function(obj, cb) {
      var format = 'CCSLLLCxxxL'
        , args   = [ null
          , 'mode'
          , null
          , 'window'
          , 'property'
          , 'type'
          , 'format'
          , 'data_len'
          , 'data'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.data.length)
        , buf_name = new Buffer(len)
      obj.data_len = Buffer.byteLength(obj.data)
      buf_name.write(obj.data)
      obj.data = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 18
      return padEnd([format, args], addSize, 2)
    }
  ]
, DeleteProperty: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'window'
          , 'property'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 19
      return padEnd([format, args], addSize, 1)
    }
  ]
, GetProperty: 
  [ function(obj, cb) {
      var format = 'CCSLLLLL'
        , args   = [ null
          , '_delete'
          , null
          , 'window'
          , 'property'
          , 'type'
          , 'long_offset'
          , 'long_length'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 20
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'type'
          , 'bytes_after'
          , 'value_len' ]
        , format = "LLLxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.format = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      reply.value = buf.slice(unpacked.offset, unpacked.offset + reply.value_len).toString()
      unpacked.offset += reply.value_len
      return reply
      
    }
  ]
, ListProperties: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 21
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'atoms_len' ]
        , format = "Sxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = reply.atoms_len
      reply.atoms = buf.unpack(new Array(len + 1).join("L"), unpacked.offset)
      unpacked.offset = reply.atoms.offset
      return reply
      
    }
  ]
, SetSelectionOwner: 
  [ function(obj, cb) {
      var format = 'CxSLLL'
        , args   = [ null
          , null
          , 'owner'
          , 'selection'
          , 'time'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 22
      return padEnd([format, args], addSize, 1)
    }
  ]
, GetSelectionOwner: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'selection'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 23
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'owner' ]
        , format = "L"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, ConvertSelection: 
  [ function(obj, cb) {
      var format = 'CxSLLLLL'
        , args   = [ null
          , null
          , 'requestor'
          , 'selection'
          , 'target'
          , 'property'
          , 'time'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 24
      return padEnd([format, args], addSize, 1)
    }
  ]
, SendEvent: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = [ null
          , 'propagate'
          , null
          , 'destination'
          , 'event_mask'
          , 'event'
          ]
        , addSize = 0

      var buf_name = new Buffer(32)
      buffer.write(obj.event)
      addSize += 32 / 4
      format += 'a'
      args = parameterOrder(args, obj)
      args[0] = 25
      return padEnd([format, args], addSize, 2)
    }
  ]
, GrabPointer: 
  [ function(obj, cb) {
      var format = 'CCSLSCCLLL'
        , args   = [ null
          , 'owner_events'
          , null
          , 'grab_window'
          , 'event_mask'
          , 'pointer_mode'
          , 'keyboard_mode'
          , 'confine_to'
          , 'cursor'
          , 'time'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 26
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = ""
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.status = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, UngrabPointer: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'time'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 27
      return padEnd([format, args], addSize, 1)
    }
  ]
, GrabButton: 
  [ function(obj, cb) {
      var format = 'CCSLSCCLLCxS'
        , args   = [ null
          , 'owner_events'
          , null
          , 'grab_window'
          , 'event_mask'
          , 'pointer_mode'
          , 'keyboard_mode'
          , 'confine_to'
          , 'cursor'
          , 'button'
          , 'modifiers'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 28
      return padEnd([format, args], addSize, 2)
    }
  ]
, UngrabButton: 
  [ function(obj, cb) {
      var format = 'CCSLSxx'
        , args   = [ null
          , 'button'
          , null
          , 'grab_window'
          , 'modifiers'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 29
      return padEnd([format, args], addSize, 2)
    }
  ]
, ChangeActivePointerGrab: 
  [ function(obj, cb) {
      var format = 'CxSLLSxx'
        , args   = [ null
          , null
          , 'cursor'
          , 'time'
          , 'event_mask'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 30
      return padEnd([format, args], addSize, 1)
    }
  ]
, GrabKeyboard: 
  [ function(obj, cb) {
      var format = 'CCSLLCCxx'
        , args   = [ null
          , 'owner_events'
          , null
          , 'grab_window'
          , 'time'
          , 'pointer_mode'
          , 'keyboard_mode'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 31
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = ""
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.status = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, UngrabKeyboard: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'time'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 32
      return padEnd([format, args], addSize, 1)
    }
  ]
, GrabKey: 
  [ function(obj, cb) {
      var format = 'CCSLSCCCxxx'
        , args   = [ null
          , 'owner_events'
          , null
          , 'grab_window'
          , 'modifiers'
          , 'key'
          , 'pointer_mode'
          , 'keyboard_mode'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 33
      return padEnd([format, args], addSize, 2)
    }
  ]
, UngrabKey: 
  [ function(obj, cb) {
      var format = 'CCSLSxx'
        , args   = [ null
          , 'key'
          , null
          , 'grab_window'
          , 'modifiers'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 34
      return padEnd([format, args], addSize, 2)
    }
  ]
, AllowEvents: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = [ null
          , 'mode'
          , null
          , 'time'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 35
      return padEnd([format, args], addSize, 2)
    }
  ]
, GrabServer: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 36
      return padEnd([format, args], addSize, 1)
    }
  ]
, UngrabServer: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 37
      return padEnd([format, args], addSize, 1)
    }
  ]
, QueryPointer: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 38
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'root'
          , 'child'
          , 'root_x'
          , 'root_y'
          , 'win_x'
          , 'win_y'
          , 'mask' ]
        , format = "LLssssSxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.same_screen = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, GetMotionEvents: 
  [ function(obj, cb) {
      var format = 'CxSLLL'
        , args   = [ null
          , null
          , 'window'
          , 'start'
          , 'stop'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 39
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'events_len' ]
        , format = "Lxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.events_len
      reply.events = []
      for (; i < len; ++i) {
        var result = structs.TIMECOORD.unpack(buf, unpacked.offset)
        reply.events.push(result[0])
        unpacked.offset = result[1]
      }
      return reply
      
    }
  ]
, TranslateCoordinates: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = [ null
          , null
          , 'src_window'
          , 'dst_window'
          , 'src_x'
          , 'src_y'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 40
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'child'
          , 'dst_x'
          , 'dst_y' ]
        , format = "Lss"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.same_screen = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, WarpPointer: 
  [ function(obj, cb) {
      var format = 'CxSLLssSSss'
        , args   = [ null
          , null
          , 'src_window'
          , 'dst_window'
          , 'src_x'
          , 'src_y'
          , 'src_width'
          , 'src_height'
          , 'dst_x'
          , 'dst_y'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 41
      return padEnd([format, args], addSize, 1)
    }
  ]
, SetInputFocus: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = [ null
          , 'revert_to'
          , null
          , 'focus'
          , 'time'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 42
      return padEnd([format, args], addSize, 2)
    }
  ]
, GetInputFocus: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 43
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'focus' ]
        , format = "L"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.revert_to = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, QueryKeymap: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 44
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = ""
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, OpenFont: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = [ null
          , null
          , 'fid'
          , 'name_len'
          , 'name'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.name.length)
        , buf_name = new Buffer(len)
      obj.name_len = Buffer.byteLength(obj.name)
      buf_name.write(obj.name)
      obj.name = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 45
      return padEnd([format, args], addSize, 1)
    }
  ]
, CloseFont: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'font'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 46
      return padEnd([format, args], addSize, 1)
    }
  ]
, QueryFont: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'font'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 47
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'min_bounds'
          , 'max_bounds'
          , 'min_char_or_byte2'
          , 'max_char_or_byte2'
          , 'default_char'
          , 'properties_len'
          , 'draw_direction'
          , 'min_byte1'
          , 'max_byte1'
          , 'all_chars_exist'
          , 'font_ascent'
          , 'font_descent'
          , 'char_infos_len' ]
        , format = "undefinedxxxxundefinedxxxxSSSSCCCCssL"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.properties_len
      reply.properties = []
      for (; i < len; ++i) {
        var result = structs.FONTPROP.unpack(buf, unpacked.offset)
        reply.properties.push(result[0])
        unpacked.offset = result[1]
      }
      var i = 0
        , len = reply.char_infos_len
      reply.char_infos = []
      for (; i < len; ++i) {
        var result = structs.CHARINFO.unpack(buf, unpacked.offset)
        reply.char_infos.push(result[0])
        unpacked.offset = result[1]
      }
      return reply
      
    }
  ]
, QueryTextExtents: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = [ null
          , 'odd_length'
          , null
          , 'font'
          , 'string'
          ]
        , addSize = 0

      obj.string = Array.isArray(obj.string) ? obj.string : [obj.string]
      var i = 0
        , len = obj.string.length
      obj.string_len = len
      for (; i < len; ++i) {
        var result = structs.CHAR2B.pack(obj.string[i], format)
        format = result[0]
        obj.string[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 48
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'font_ascent'
          , 'font_descent'
          , 'overall_ascent'
          , 'overall_descent'
          , 'overall_width'
          , 'overall_left'
          , 'overall_right' ]
        , format = "sssslll"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.draw_direction = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, ListFonts: 
  [ function(obj, cb) {
      var format = 'CxSSS'
        , args   = [ null
          , null
          , 'max_names'
          , 'pattern_len'
          , 'pattern'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.pattern.length)
        , buf_name = new Buffer(len)
      obj.pattern_len = Buffer.byteLength(obj.pattern)
      buf_name.write(obj.pattern)
      obj.pattern = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 49
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'names_len' ]
        , format = "Sxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.names_len
      reply.names = []
      for (; i < len; ++i) {
        var result = structs.STR.unpack(buf, unpacked.offset)
        reply.names.push(result[0])
        unpacked.offset = result[1]
      }
      return reply
      
    }
  ]
, ListFontsWithInfo: 
  [ function(obj, cb) {
      var format = 'CxSSS'
        , args   = [ null
          , null
          , 'max_names'
          , 'pattern_len'
          , 'pattern'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.pattern.length)
        , buf_name = new Buffer(len)
      obj.pattern_len = Buffer.byteLength(obj.pattern)
      buf_name.write(obj.pattern)
      obj.pattern = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 50
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'min_bounds'
          , 'max_bounds'
          , 'min_char_or_byte2'
          , 'max_char_or_byte2'
          , 'default_char'
          , 'properties_len'
          , 'draw_direction'
          , 'min_byte1'
          , 'max_byte1'
          , 'all_chars_exist'
          , 'font_ascent'
          , 'font_descent'
          , 'replies_hint' ]
        , format = "undefinedxxxxundefinedxxxxSSSSCCCCssL"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.name_len = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.properties_len
      reply.properties = []
      for (; i < len; ++i) {
        var result = structs.FONTPROP.unpack(buf, unpacked.offset)
        reply.properties.push(result[0])
        unpacked.offset = result[1]
      }
      reply.name = buf.slice(unpacked.offset, unpacked.offset + reply.name_len).toString()
      unpacked.offset += reply.name_len
      return reply
      
    }
  ]
, SetFontPath: 
  [ function(obj, cb) {
      var format = 'CxSS'
        , args   = [ null
          , null
          , 'font_qty'
          , 'path'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.path.length)
        , buf_name = new Buffer(len)
      obj.path_len = Buffer.byteLength(obj.path)
      buf_name.write(obj.path)
      obj.path = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 51
      return padEnd([format, args], addSize, 1)
    }
  ]
, GetFontPath: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 52
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'path_len' ]
        , format = "Sxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.path_len
      reply.path = []
      for (; i < len; ++i) {
        var result = structs.STR.unpack(buf, unpacked.offset)
        reply.path.push(result[0])
        unpacked.offset = result[1]
      }
      return reply
      
    }
  ]
, CreatePixmap: 
  [ function(obj, cb) {
      var format = 'CCSLLSS'
        , args   = [ null
          , 'depth'
          , null
          , 'pid'
          , 'drawable'
          , 'width'
          , 'height'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 53
      return padEnd([format, args], addSize, 2)
    }
  ]
, FreePixmap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'pixmap'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 54
      return padEnd([format, args], addSize, 1)
    }
  ]
, CreateGC: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'cid'
          , 'drawable'
          , 'value_mask'
          , 'value_list'
          ]
        , addSize = 0
      var packed = packMask(valueMask['CreateGC'], obj.value_mask)
      obj.value_mask = packed[0]
      format += "L"
      obj.value_list = packed[1]
      format += new Array(packed[1].length + 1).join("L")
      args = parameterOrder(args, obj)
      args[0] = 55
      return padEnd([format, args], addSize, 1)
    }
  ]
, ChangeGC: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'gc'
          , 'value_mask'
          , 'value_list'
          ]
        , addSize = 0
      var packed = packMask(valueMask['ChangeGC'], obj.value_mask)
      obj.value_mask = packed[0]
      format += "L"
      obj.value_list = packed[1]
      format += new Array(packed[1].length + 1).join("L")
      args = parameterOrder(args, obj)
      args[0] = 56
      return padEnd([format, args], addSize, 1)
    }
  ]
, CopyGC: 
  [ function(obj, cb) {
      var format = 'CxSLLL'
        , args   = [ null
          , null
          , 'src_gc'
          , 'dst_gc'
          , 'value_mask'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 57
      return padEnd([format, args], addSize, 1)
    }
  ]
, SetDashes: 
  [ function(obj, cb) {
      var format = 'CxSLSS'
        , args   = [ null
          , null
          , 'gc'
          , 'dash_offset'
          , 'dashes_len'
          , 'dashes'
          ]
        , addSize = 0

      obj.dashes = Array.isArray(obj.dashes) ? obj.dashes : [obj.dashes]
      var len = obj.dashes.length
      format += new Array(len + 1).join("C")
      obj.dashes_len = len
      args = parameterOrder(args, obj)
      args[0] = 58
      return padEnd([format, args], addSize, 1)
    }
  ]
, SetClipRectangles: 
  [ function(obj, cb) {
      var format = 'CCSLss'
        , args   = [ null
          , 'ordering'
          , null
          , 'gc'
          , 'clip_x_origin'
          , 'clip_y_origin'
          , 'rectangles'
          ]
        , addSize = 0

      obj.rectangles = Array.isArray(obj.rectangles) ? obj.rectangles : [obj.rectangles]
      var i = 0
        , len = obj.rectangles.length
      obj.rectangles_len = len
      for (; i < len; ++i) {
        var result = structs.RECTANGLE.pack(obj.rectangles[i], format)
        format = result[0]
        obj.rectangles[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 59
      return padEnd([format, args], addSize, 2)
    }
  ]
, FreeGC: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'gc'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 60
      return padEnd([format, args], addSize, 1)
    }
  ]
, ClearArea: 
  [ function(obj, cb) {
      var format = 'CCSLssSS'
        , args   = [ null
          , 'exposures'
          , null
          , 'window'
          , 'x'
          , 'y'
          , 'width'
          , 'height'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 61
      return padEnd([format, args], addSize, 2)
    }
  ]
, CopyArea: 
  [ function(obj, cb) {
      var format = 'CxSLLLssssSS'
        , args   = [ null
          , null
          , 'src_drawable'
          , 'dst_drawable'
          , 'gc'
          , 'src_x'
          , 'src_y'
          , 'dst_x'
          , 'dst_y'
          , 'width'
          , 'height'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 62
      return padEnd([format, args], addSize, 1)
    }
  ]
, CopyPlane: 
  [ function(obj, cb) {
      var format = 'CxSLLLssssSSL'
        , args   = [ null
          , null
          , 'src_drawable'
          , 'dst_drawable'
          , 'gc'
          , 'src_x'
          , 'src_y'
          , 'dst_x'
          , 'dst_y'
          , 'width'
          , 'height'
          , 'bit_plane'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 63
      return padEnd([format, args], addSize, 1)
    }
  ]
, PolyPoint: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = [ null
          , 'coordinate_mode'
          , null
          , 'drawable'
          , 'gc'
          , 'points'
          ]
        , addSize = 0

      obj.points = Array.isArray(obj.points) ? obj.points : [obj.points]
      var i = 0
        , len = obj.points.length
      obj.points_len = len
      for (; i < len; ++i) {
        var result = structs.POINT.pack(obj.points[i], format)
        format = result[0]
        obj.points[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 64
      return padEnd([format, args], addSize, 2)
    }
  ]
, PolyLine: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = [ null
          , 'coordinate_mode'
          , null
          , 'drawable'
          , 'gc'
          , 'points'
          ]
        , addSize = 0

      obj.points = Array.isArray(obj.points) ? obj.points : [obj.points]
      var i = 0
        , len = obj.points.length
      obj.points_len = len
      for (; i < len; ++i) {
        var result = structs.POINT.pack(obj.points[i], format)
        format = result[0]
        obj.points[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 65
      return padEnd([format, args], addSize, 2)
    }
  ]
, PolySegment: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'segments'
          ]
        , addSize = 0

      obj.segments = Array.isArray(obj.segments) ? obj.segments : [obj.segments]
      var i = 0
        , len = obj.segments.length
      obj.segments_len = len
      for (; i < len; ++i) {
        var result = structs.SEGMENT.pack(obj.segments[i], format)
        format = result[0]
        obj.segments[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 66
      return padEnd([format, args], addSize, 1)
    }
  ]
, PolyRectangle: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'rectangles'
          ]
        , addSize = 0

      obj.rectangles = Array.isArray(obj.rectangles) ? obj.rectangles : [obj.rectangles]
      var i = 0
        , len = obj.rectangles.length
      obj.rectangles_len = len
      for (; i < len; ++i) {
        var result = structs.RECTANGLE.pack(obj.rectangles[i], format)
        format = result[0]
        obj.rectangles[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 67
      return padEnd([format, args], addSize, 1)
    }
  ]
, PolyArc: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'arcs'
          ]
        , addSize = 0

      obj.arcs = Array.isArray(obj.arcs) ? obj.arcs : [obj.arcs]
      var i = 0
        , len = obj.arcs.length
      obj.arcs_len = len
      for (; i < len; ++i) {
        var result = structs.ARC.pack(obj.arcs[i], format)
        format = result[0]
        obj.arcs[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 68
      return padEnd([format, args], addSize, 1)
    }
  ]
, FillPoly: 
  [ function(obj, cb) {
      var format = 'CxSLLCCxx'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'shape'
          , 'coordinate_mode'
          , 'points'
          ]
        , addSize = 0

      obj.points = Array.isArray(obj.points) ? obj.points : [obj.points]
      var i = 0
        , len = obj.points.length
      obj.points_len = len
      for (; i < len; ++i) {
        var result = structs.POINT.pack(obj.points[i], format)
        format = result[0]
        obj.points[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 69
      return padEnd([format, args], addSize, 1)
    }
  ]
, PolyFillRectangle: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'rectangles'
          ]
        , addSize = 0

      obj.rectangles = Array.isArray(obj.rectangles) ? obj.rectangles : [obj.rectangles]
      var i = 0
        , len = obj.rectangles.length
      obj.rectangles_len = len
      for (; i < len; ++i) {
        var result = structs.RECTANGLE.pack(obj.rectangles[i], format)
        format = result[0]
        obj.rectangles[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 70
      return padEnd([format, args], addSize, 1)
    }
  ]
, PolyFillArc: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'arcs'
          ]
        , addSize = 0

      obj.arcs = Array.isArray(obj.arcs) ? obj.arcs : [obj.arcs]
      var i = 0
        , len = obj.arcs.length
      obj.arcs_len = len
      for (; i < len; ++i) {
        var result = structs.ARC.pack(obj.arcs[i], format)
        format = result[0]
        obj.arcs[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 71
      return padEnd([format, args], addSize, 1)
    }
  ]
, PutImage: 
  [ function(obj, cb) {
      var format = 'CCSLLSSssCCxx'
        , args   = [ null
          , 'format'
          , null
          , 'drawable'
          , 'gc'
          , 'width'
          , 'height'
          , 'dst_x'
          , 'dst_y'
          , 'left_pad'
          , 'depth'
          , 'data'
          ]
        , addSize = 0

      obj.data = Array.isArray(obj.data) ? obj.data : [obj.data]
      var len = obj.data.length
      format += new Array(len + 1).join("C")
      obj.data_len = len
      args = parameterOrder(args, obj)
      args[0] = 72
      return padEnd([format, args], addSize, 2)
    }
  ]
, GetImage: 
  [ function(obj, cb) {
      var format = 'CCSLssSSL'
        , args   = [ null
          , 'format'
          , null
          , 'drawable'
          , 'x'
          , 'y'
          , 'width'
          , 'height'
          , 'plane_mask'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 73
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'visual' ]
        , format = "Lxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.depth = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = 4*length
      reply.data = buf.unpack(new Array(len + 1).join("C"), unpacked.offset)
      unpacked.offset = reply.data.offset
      return reply
      
    }
  ]
, PolyText8: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          , 'items'
          ]
        , addSize = 0

      obj.items = Array.isArray(obj.items) ? obj.items : [obj.items]
      var len = obj.items.length
      format += new Array(len + 1).join("C")
      obj.items_len = len
      args = parameterOrder(args, obj)
      args[0] = 74
      return padEnd([format, args], addSize, 1)
    }
  ]
, PolyText16: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = [ null
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          , 'items'
          ]
        , addSize = 0

      obj.items = Array.isArray(obj.items) ? obj.items : [obj.items]
      var len = obj.items.length
      format += new Array(len + 1).join("C")
      obj.items_len = len
      args = parameterOrder(args, obj)
      args[0] = 75
      return padEnd([format, args], addSize, 1)
    }
  ]
, ImageText8: 
  [ function(obj, cb) {
      var format = 'CCSLLss'
        , args   = [ null
          , 'string_len'
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          , 'string'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.string.length)
        , buf_name = new Buffer(len)
      obj.string_len = Buffer.byteLength(obj.string)
      buf_name.write(obj.string)
      obj.string = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 76
      return padEnd([format, args], addSize, 2)
    }
  ]
, ImageText16: 
  [ function(obj, cb) {
      var format = 'CCSLLss'
        , args   = [ null
          , 'string_len'
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          , 'string'
          ]
        , addSize = 0

      obj.string = Array.isArray(obj.string) ? obj.string : [obj.string]
      var i = 0
        , len = obj.string.length
      obj.string_len = len
      for (; i < len; ++i) {
        var result = structs.CHAR2B.pack(obj.string[i], format)
        format = result[0]
        obj.string[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 77
      return padEnd([format, args], addSize, 2)
    }
  ]
, CreateColormap: 
  [ function(obj, cb) {
      var format = 'CCSLLL'
        , args   = [ null
          , 'alloc'
          , null
          , 'mid'
          , 'window'
          , 'visual'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 78
      return padEnd([format, args], addSize, 2)
    }
  ]
, FreeColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'cmap'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 79
      return padEnd([format, args], addSize, 1)
    }
  ]
, CopyColormapAndFree: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'mid'
          , 'src_cmap'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 80
      return padEnd([format, args], addSize, 1)
    }
  ]
, InstallColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'cmap'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 81
      return padEnd([format, args], addSize, 1)
    }
  ]
, UninstallColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'cmap'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 82
      return padEnd([format, args], addSize, 1)
    }
  ]
, ListInstalledColormaps: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'window'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 83
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'cmaps_len' ]
        , format = "Sxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = reply.cmaps_len
      reply.cmaps = buf.unpack(new Array(len + 1).join("L"), unpacked.offset)
      unpacked.offset = reply.cmaps.offset
      return reply
      
    }
  ]
, AllocColor: 
  [ function(obj, cb) {
      var format = 'CxSLSSSxx'
        , args   = [ null
          , null
          , 'cmap'
          , 'red'
          , 'green'
          , 'blue'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 84
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'red'
          , 'green'
          , 'blue'
          , 'pixel' ]
        , format = "SSSxxL"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, AllocNamedColor: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = [ null
          , null
          , 'cmap'
          , 'name_len'
          , 'name'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.name.length)
        , buf_name = new Buffer(len)
      obj.name_len = Buffer.byteLength(obj.name)
      buf_name.write(obj.name)
      obj.name = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 85
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'pixel'
          , 'exact_red'
          , 'exact_green'
          , 'exact_blue'
          , 'visual_red'
          , 'visual_green'
          , 'visual_blue' ]
        , format = "LSSSSSS"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, AllocColorCells: 
  [ function(obj, cb) {
      var format = 'CCSLSS'
        , args   = [ null
          , 'contiguous'
          , null
          , 'cmap'
          , 'colors'
          , 'planes'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 86
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'pixels_len'
          , 'masks_len' ]
        , format = "SSxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = reply.pixels_len
      reply.pixels = buf.unpack(new Array(len + 1).join("L"), unpacked.offset)
      unpacked.offset = reply.pixels.offset
      var len = reply.masks_len
      reply.masks = buf.unpack(new Array(len + 1).join("L"), unpacked.offset)
      unpacked.offset = reply.masks.offset
      return reply
      
    }
  ]
, AllocColorPlanes: 
  [ function(obj, cb) {
      var format = 'CCSLSSSS'
        , args   = [ null
          , 'contiguous'
          , null
          , 'cmap'
          , 'colors'
          , 'reds'
          , 'greens'
          , 'blues'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 87
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'pixels_len'
          , 'red_mask'
          , 'green_mask'
          , 'blue_mask' ]
        , format = "SxxLLLxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = reply.pixels_len
      reply.pixels = buf.unpack(new Array(len + 1).join("L"), unpacked.offset)
      unpacked.offset = reply.pixels.offset
      return reply
      
    }
  ]
, FreeColors: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = [ null
          , null
          , 'cmap'
          , 'plane_mask'
          , 'pixels'
          ]
        , addSize = 0

      obj.pixels = Array.isArray(obj.pixels) ? obj.pixels : [obj.pixels]
      var len = obj.pixels.length
      format += new Array(len + 1).join("L")
      obj.pixels_len = len
      args = parameterOrder(args, obj)
      args[0] = 88
      return padEnd([format, args], addSize, 1)
    }
  ]
, StoreColors: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'cmap'
          , 'items'
          ]
        , addSize = 0

      obj.items = Array.isArray(obj.items) ? obj.items : [obj.items]
      var i = 0
        , len = obj.items.length
      obj.items_len = len
      for (; i < len; ++i) {
        var result = structs.COLORITEM.pack(obj.items[i], format)
        format = result[0]
        obj.items[i] = result[1]
        addSize += result[2]
      }
      args = parameterOrder(args, obj)
      args[0] = 89
      return padEnd([format, args], addSize, 1)
    }
  ]
, StoreNamedColor: 
  [ function(obj, cb) {
      var format = 'CCSLLSxx'
        , args   = [ null
          , 'flags'
          , null
          , 'cmap'
          , 'pixel'
          , 'name_len'
          , 'name'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.name.length)
        , buf_name = new Buffer(len)
      obj.name_len = Buffer.byteLength(obj.name)
      buf_name.write(obj.name)
      obj.name = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 90
      return padEnd([format, args], addSize, 2)
    }
  ]
, QueryColors: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'cmap'
          , 'pixels'
          ]
        , addSize = 0

      obj.pixels = Array.isArray(obj.pixels) ? obj.pixels : [obj.pixels]
      var len = obj.pixels.length
      format += new Array(len + 1).join("L")
      obj.pixels_len = len
      args = parameterOrder(args, obj)
      args[0] = 91
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'colors_len' ]
        , format = "Sxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.colors_len
      reply.colors = []
      for (; i < len; ++i) {
        var result = structs.RGB.unpack(buf, unpacked.offset)
        reply.colors.push(result[0])
        unpacked.offset = result[1]
      }
      return reply
      
    }
  ]
, LookupColor: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = [ null
          , null
          , 'cmap'
          , 'name_len'
          , 'name'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.name.length)
        , buf_name = new Buffer(len)
      obj.name_len = Buffer.byteLength(obj.name)
      buf_name.write(obj.name)
      obj.name = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 92
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'exact_red'
          , 'exact_green'
          , 'exact_blue'
          , 'visual_red'
          , 'visual_green'
          , 'visual_blue' ]
        , format = "SSSSSS"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, CreateCursor: 
  [ function(obj, cb) {
      var format = 'CxSLLLSSSSSSSS'
        , args   = [ null
          , null
          , 'cid'
          , 'source'
          , 'mask'
          , 'fore_red'
          , 'fore_green'
          , 'fore_blue'
          , 'back_red'
          , 'back_green'
          , 'back_blue'
          , 'x'
          , 'y'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 93
      return padEnd([format, args], addSize, 1)
    }
  ]
, CreateGlyphCursor: 
  [ function(obj, cb) {
      var format = 'CxSLLLSSSSSSSS'
        , args   = [ null
          , null
          , 'cid'
          , 'source_font'
          , 'mask_font'
          , 'source_char'
          , 'mask_char'
          , 'fore_red'
          , 'fore_green'
          , 'fore_blue'
          , 'back_red'
          , 'back_green'
          , 'back_blue'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 94
      return padEnd([format, args], addSize, 1)
    }
  ]
, FreeCursor: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'cursor'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 95
      return padEnd([format, args], addSize, 1)
    }
  ]
, RecolorCursor: 
  [ function(obj, cb) {
      var format = 'CxSLSSSSSS'
        , args   = [ null
          , null
          , 'cursor'
          , 'fore_red'
          , 'fore_green'
          , 'fore_blue'
          , 'back_red'
          , 'back_green'
          , 'back_blue'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 96
      return padEnd([format, args], addSize, 1)
    }
  ]
, QueryBestSize: 
  [ function(obj, cb) {
      var format = 'CCSLSS'
        , args   = [ null
          , '_class'
          , null
          , 'drawable'
          , 'width'
          , 'height'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 97
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'width'
          , 'height' ]
        , format = "SS"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, QueryExtension: 
  [ function(obj, cb) {
      var format = 'CxSSxx'
        , args   = [ null
          , null
          , 'name_len'
          , 'name'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.name.length)
        , buf_name = new Buffer(len)
      obj.name_len = Buffer.byteLength(obj.name)
      buf_name.write(obj.name)
      obj.name = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 98
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'present'
          , 'major_opcode'
          , 'first_event'
          , 'first_error' ]
        , format = "CCCC"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, ListExtensions: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 99
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = "xxxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.names_len = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.names_len
      reply.names = []
      for (; i < len; ++i) {
        var result = structs.STR.unpack(buf, unpacked.offset)
        reply.names.push(result[0])
        unpacked.offset = result[1]
      }
      return reply
      
    }
  ]
, ChangeKeyboardMapping: 
  [ function(obj, cb) {
      var format = 'CCSCC'
        , args   = [ null
          , 'keycode_count'
          , null
          , 'first_keycode'
          , 'keysyms_per_keycode'
          , 'keysyms'
          ]
        , addSize = 0

      obj.keysyms = Array.isArray(obj.keysyms) ? obj.keysyms : [obj.keysyms]
      var len = obj.keysyms.length
      format += new Array(len + 1).join("L")
      obj.keysyms_len = len
      args = parameterOrder(args, obj)
      args[0] = 100
      return padEnd([format, args], addSize, 2)
    }
  ]
, GetKeyboardMapping: 
  [ function(obj, cb) {
      var format = 'CxSCC'
        , args   = [ null
          , null
          , 'first_keycode'
          , 'count'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 101
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = "xxxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.keysyms_per_keycode = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = length
      reply.keysyms = buf.unpack(new Array(len + 1).join("L"), unpacked.offset)
      unpacked.offset = reply.keysyms.offset
      return reply
      
    }
  ]
, ChangeKeyboardControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          , 'value_mask'
          , 'value_list'
          ]
        , addSize = 0
      var packed = packMask(valueMask['ChangeKeyboardControl'], obj.value_mask)
      obj.value_mask = packed[0]
      format += "L"
      obj.value_list = packed[1]
      format += new Array(packed[1].length + 1).join("L")
      args = parameterOrder(args, obj)
      args[0] = 102
      return padEnd([format, args], addSize, 1)
    }
  ]
, GetKeyboardControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 103
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'led_mask'
          , 'key_click_percent'
          , 'bell_percent'
          , 'bell_pitch'
          , 'bell_duration' ]
        , format = "LCCSSxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.global_auto_repeat = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, Bell: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = [ null
          , 'percent'
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 104
      return padEnd([format, args], addSize, 2)
    }
  ]
, ChangePointerControl: 
  [ function(obj, cb) {
      var format = 'CxSsssCC'
        , args   = [ null
          , null
          , 'acceleration_numerator'
          , 'acceleration_denominator'
          , 'threshold'
          , 'do_acceleration'
          , 'do_threshold'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 105
      return padEnd([format, args], addSize, 1)
    }
  ]
, GetPointerControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 106
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'acceleration_numerator'
          , 'acceleration_denominator'
          , 'threshold' ]
        , format = "SSSxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, SetScreenSaver: 
  [ function(obj, cb) {
      var format = 'CxSssCC'
        , args   = [ null
          , null
          , 'timeout'
          , 'interval'
          , 'prefer_blanking'
          , 'allow_exposures'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 107
      return padEnd([format, args], addSize, 1)
    }
  ]
, GetScreenSaver: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 108
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'timeout'
          , 'interval'
          , 'prefer_blanking'
          , 'allow_exposures' ]
        , format = "SSCCxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, ChangeHosts: 
  [ function(obj, cb) {
      var format = 'CCSCxS'
        , args   = [ null
          , 'mode'
          , null
          , 'family'
          , 'address_len'
          , 'address'
          ]
        , addSize = 0
      var len = xutil.padded_length(obj.address.length)
        , buf_name = new Buffer(len)
      obj.address_len = Buffer.byteLength(obj.address)
      buf_name.write(obj.address)
      obj.address = buf_name
      format += 'a'
      addSize += (len / 4)
      args = parameterOrder(args, obj)
      args[0] = 109
      return padEnd([format, args], addSize, 2)
    }
  ]
, ListHosts: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 110
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields =
          [ 'hosts_len' ]
        , format = "Sxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.mode = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var i = 0
        , len = reply.hosts_len
      reply.hosts = []
      for (; i < len; ++i) {
        var result = structs.HOST.unpack(buf, unpacked.offset)
        reply.hosts.push(result[0])
        unpacked.offset = result[1]
      }
      return reply
      
    }
  ]
, SetAccessControl: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = [ null
          , 'mode'
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 111
      return padEnd([format, args], addSize, 2)
    }
  ]
, SetCloseDownMode: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = [ null
          , 'mode'
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 112
      return padEnd([format, args], addSize, 2)
    }
  ]
, KillClient: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = [ null
          , null
          , 'resource'
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 113
      return padEnd([format, args], addSize, 1)
    }
  ]
, RotateProperties: 
  [ function(obj, cb) {
      var format = 'CxSLSs'
        , args   = [ null
          , null
          , 'window'
          , 'atoms_len'
          , 'delta'
          , 'atoms'
          ]
        , addSize = 0

      obj.atoms = Array.isArray(obj.atoms) ? obj.atoms : [obj.atoms]
      var len = obj.atoms.length
      format += new Array(len + 1).join("L")
      obj.atoms_len = len
      args = parameterOrder(args, obj)
      args[0] = 114
      return padEnd([format, args], addSize, 1)
    }
  ]
, ForceScreenSaver: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = [ null
          , 'mode'
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 115
      return padEnd([format, args], addSize, 2)
    }
  ]
, SetPointerMapping: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = [ null
          , 'map_len'
          , null
          , 'map'
          ]
        , addSize = 0

      obj.map = Array.isArray(obj.map) ? obj.map : [obj.map]
      var len = obj.map.length
      format += new Array(len + 1).join("C")
      obj.map_len = len
      args = parameterOrder(args, obj)
      args[0] = 116
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = ""
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.status = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, GetPointerMapping: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 117
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = "xxxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.map_len = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = reply.map_len
      reply.map = buf.unpack(new Array(len + 1).join("C"), unpacked.offset)
      unpacked.offset = reply.map.offset
      return reply
      
    }
  ]
, SetModifierMapping: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = [ null
          , 'keycodes_per_modifier'
          , null
          , 'keycodes'
          ]
        , addSize = 0

      obj.keycodes = Array.isArray(obj.keycodes) ? obj.keycodes : [obj.keycodes]
      var len = obj.keycodes.length
      format += new Array(len + 1).join("C")
      obj.keycodes_len = len
      args = parameterOrder(args, obj)
      args[0] = 118
      return padEnd([format, args], addSize, 2)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = ""
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.status = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      return reply
      
    }
  ]
, GetModifierMapping: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 119
      return padEnd([format, args], addSize, 1)
    }
  , function(buf, prop, length) {
      var fields = []
        , format = "xxxxxxxxxxxxxxxxxxxxxxxx"
        , unpacked = buf.unpack(format)
        , reply  = associate(fields, unpacked)
      reply.keycodes_per_modifier = prop
      Object.defineProperty(reply, '_raw', { value: buf, enumerable: false })
      Object.defineProperty(reply, '_offset', { value: unpacked.offset, enumerable: false })
      var len = 8*reply.keycodes_per_modifier
      reply.keycodes = buf.unpack(new Array(len + 1).join("C"), unpacked.offset)
      unpacked.offset = reply.keycodes.offset
      return reply
      
    }
  ]
, NoOperation: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = [ null
          , null
          ]
        , addSize = 0
      args = parameterOrder(args, obj)
      args[0] = 127
      return padEnd([format, args], addSize, 1)
    }
  ]
}