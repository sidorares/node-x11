var packMask = require('./valuemask')
  ,  valueMask = {
  CreateWindow:
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
  CreateGC:
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

function parameterOrder(params, obj) {
  return params.map(function(name) {
    return name && obj[name]
  })
}

module.exports = 
{ CreateWindow: 
  [ function(obj, cb) {
      var format = 'CCSLLssSSSSL'
        , args   = parameterOrder([ null
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
          ], obj)
        , packed = packMask(valueMask[CreateWindow], obj.value_mask)
      format += "L"
      args.push(packed[0])
      args = args.concat(packed[1])
      format += new Array(packed[1].length + 1).join("L")
      args[0] = 1
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, ChangeWindowAttributes: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
        , packed = packMask(valueMask[ChangeWindowAttributes], obj.value_mask)
      format += "L"
      args.push(packed[0])
      args = args.concat(packed[1])
      format += new Array(packed[1].length + 1).join("L")
      args[0] = 2
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GetWindowAttributes: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 3
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, DestroyWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 4
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, DestroySubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 5
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, ChangeSaveSet: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = parameterOrder([ null
          , 'mode'
          , null
          , 'window'
          ], obj)
      args[0] = 6
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, ReparentWindow: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder([ null
          , null
          , 'window'
          , 'parent'
          , 'x'
          , 'y'
          ], obj)
      args[0] = 7
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, MapWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 8
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, MapSubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 9
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, UnmapWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 10
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, UnmapSubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 11
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, ConfigureWindow: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder([ null
          , null
          , 'window'
          , 'value_mask'
          ], obj)
        , packed = packMask(valueMask[ConfigureWindow], obj.value_mask)
      args[2] = packed[0]
      args = args.concat(packed[1])
      format += new Array(packed[1].length + 1).join("L")
      args[0] = 12
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, CirculateWindow: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = parameterOrder([ null
          , 'direction'
          , null
          , 'window'
          ], obj)
      args[0] = 13
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, GetGeometry: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          ], obj)
      args[0] = 14
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, QueryTree: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 15
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, InternAtom: 
  [ function(obj, cb) {
      var format = 'CCSSxx'
        , args   = parameterOrder([ null
          , 'only_if_exists'
          , null
          , 'name_len'
          ], obj)
      args[0] = 16
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, GetAtomName: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'atom'
          ], obj)
      args[0] = 17
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ChangeProperty: 
  [ function(obj, cb) {
      var format = 'CCSLLLCxxxL'
        , args   = parameterOrder([ null
          , 'mode'
          , null
          , 'window'
          , 'property'
          , 'type'
          , 'format'
          , 'data_len'
          ], obj)
      args[0] = 18
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, DeleteProperty: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          , 'property'
          ], obj)
      args[0] = 19
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GetProperty: 
  [ function(obj, cb) {
      var format = 'CCSLLLLL'
        , args   = parameterOrder([ null
          , '_delete'
          , null
          , 'window'
          , 'property'
          , 'type'
          , 'long_offset'
          , 'long_length'
          ], obj)
      args[0] = 20
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ListProperties: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 21
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, SetSelectionOwner: 
  [ function(obj, cb) {
      var format = 'CxSLLundefined'
        , args   = parameterOrder([ null
          , null
          , 'owner'
          , 'selection'
          , 'time'
          ], obj)
      args[0] = 22
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GetSelectionOwner: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'selection'
          ], obj)
      args[0] = 23
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ConvertSelection: 
  [ function(obj, cb) {
      var format = 'CxSLLLLundefined'
        , args   = parameterOrder([ null
          , null
          , 'requestor'
          , 'selection'
          , 'target'
          , 'property'
          , 'time'
          ], obj)
      args[0] = 24
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, SendEvent: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = parameterOrder([ null
          , 'propagate'
          , null
          , 'destination'
          , 'event_mask'
          ], obj)
      args[0] = 25
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, GrabPointer: 
  [ function(obj, cb) {
      var format = 'CCSLSCCLLundefined'
        , args   = parameterOrder([ null
          , 'owner_events'
          , null
          , 'grab_window'
          , 'event_mask'
          , 'pointer_mode'
          , 'keyboard_mode'
          , 'confine_to'
          , 'cursor'
          , 'time'
          ], obj)
      args[0] = 26
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, UngrabPointer: 
  [ function(obj, cb) {
      var format = 'CxSundefined'
        , args   = parameterOrder([ null
          , null
          , 'time'
          ], obj)
      args[0] = 27
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GrabButton: 
  [ function(obj, cb) {
      var format = 'CCSLSCCLLCxS'
        , args   = parameterOrder([ null
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
          ], obj)
      args[0] = 28
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, UngrabButton: 
  [ function(obj, cb) {
      var format = 'CCSLSxx'
        , args   = parameterOrder([ null
          , 'button'
          , null
          , 'grab_window'
          , 'modifiers'
          ], obj)
      args[0] = 29
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, ChangeActivePointerGrab: 
  [ function(obj, cb) {
      var format = 'CxSLundefinedSxx'
        , args   = parameterOrder([ null
          , null
          , 'cursor'
          , 'time'
          , 'event_mask'
          ], obj)
      args[0] = 30
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GrabKeyboard: 
  [ function(obj, cb) {
      var format = 'CCSLundefinedCCxx'
        , args   = parameterOrder([ null
          , 'owner_events'
          , null
          , 'grab_window'
          , 'time'
          , 'pointer_mode'
          , 'keyboard_mode'
          ], obj)
      args[0] = 31
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, UngrabKeyboard: 
  [ function(obj, cb) {
      var format = 'CxSundefined'
        , args   = parameterOrder([ null
          , null
          , 'time'
          ], obj)
      args[0] = 32
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GrabKey: 
  [ function(obj, cb) {
      var format = 'CCSLSCCCxxx'
        , args   = parameterOrder([ null
          , 'owner_events'
          , null
          , 'grab_window'
          , 'modifiers'
          , 'key'
          , 'pointer_mode'
          , 'keyboard_mode'
          ], obj)
      args[0] = 33
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, UngrabKey: 
  [ function(obj, cb) {
      var format = 'CCSLSxx'
        , args   = parameterOrder([ null
          , 'key'
          , null
          , 'grab_window'
          , 'modifiers'
          ], obj)
      args[0] = 34
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, AllowEvents: 
  [ function(obj, cb) {
      var format = 'CCSundefined'
        , args   = parameterOrder([ null
          , 'mode'
          , null
          , 'time'
          ], obj)
      args[0] = 35
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, GrabServer: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 36
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, UngrabServer: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 37
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, QueryPointer: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 38
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, GetMotionEvents: 
  [ function(obj, cb) {
      var format = 'CxSLundefinedundefined'
        , args   = parameterOrder([ null
          , null
          , 'window'
          , 'start'
          , 'stop'
          ], obj)
      args[0] = 39
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, TranslateCoordinates: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder([ null
          , null
          , 'src_window'
          , 'dst_window'
          , 'src_x'
          , 'src_y'
          ], obj)
      args[0] = 40
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, WarpPointer: 
  [ function(obj, cb) {
      var format = 'CxSLLssSSss'
        , args   = parameterOrder([ null
          , null
          , 'src_window'
          , 'dst_window'
          , 'src_x'
          , 'src_y'
          , 'src_width'
          , 'src_height'
          , 'dst_x'
          , 'dst_y'
          ], obj)
      args[0] = 41
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, SetInputFocus: 
  [ function(obj, cb) {
      var format = 'CCSLundefined'
        , args   = parameterOrder([ null
          , 'revert_to'
          , null
          , 'focus'
          , 'time'
          ], obj)
      args[0] = 42
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, GetInputFocus: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 43
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, QueryKeymap: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 44
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, OpenFont: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder([ null
          , null
          , 'fid'
          , 'name_len'
          ], obj)
      args[0] = 45
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, CloseFont: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'font'
          ], obj)
      args[0] = 46
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, QueryFont: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'font'
          ], obj)
      args[0] = 47
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, QueryTextExtents: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = parameterOrder([ null
          , 'odd_length'
          , null
          , 'font'
          ], obj)
      args[0] = 48
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ListFonts: 
  [ function(obj, cb) {
      var format = 'CxSSS'
        , args   = parameterOrder([ null
          , null
          , 'max_names'
          , 'pattern_len'
          ], obj)
      args[0] = 49
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ListFontsWithInfo: 
  [ function(obj, cb) {
      var format = 'CxSSS'
        , args   = parameterOrder([ null
          , null
          , 'max_names'
          , 'pattern_len'
          ], obj)
      args[0] = 50
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, SetFontPath: 
  [ function(obj, cb) {
      var format = 'CxSS'
        , args   = parameterOrder([ null
          , null
          , 'font_qty'
          ], obj)
      args[0] = 51
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GetFontPath: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 52
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, CreatePixmap: 
  [ function(obj, cb) {
      var format = 'CCSLLSS'
        , args   = parameterOrder([ null
          , 'depth'
          , null
          , 'pid'
          , 'drawable'
          , 'width'
          , 'height'
          ], obj)
      args[0] = 53
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, FreePixmap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'pixmap'
          ], obj)
      args[0] = 54
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, CreateGC: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'cid'
          , 'drawable'
          ], obj)
        , packed = packMask(valueMask[CreateGC], obj.value_mask)
      format += "L"
      args.push(packed[0])
      args = args.concat(packed[1])
      format += new Array(packed[1].length + 1).join("L")
      args[0] = 55
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, ChangeGC: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'gc'
          ], obj)
        , packed = packMask(valueMask[ChangeGC], obj.value_mask)
      format += "L"
      args.push(packed[0])
      args = args.concat(packed[1])
      format += new Array(packed[1].length + 1).join("L")
      args[0] = 56
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, CopyGC: 
  [ function(obj, cb) {
      var format = 'CxSLLL'
        , args   = parameterOrder([ null
          , null
          , 'src_gc'
          , 'dst_gc'
          , 'value_mask'
          ], obj)
      args[0] = 57
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, SetDashes: 
  [ function(obj, cb) {
      var format = 'CxSLSS'
        , args   = parameterOrder([ null
          , null
          , 'gc'
          , 'dash_offset'
          , 'dashes_len'
          ], obj)
      args[0] = 58
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, SetClipRectangles: 
  [ function(obj, cb) {
      var format = 'CCSLss'
        , args   = parameterOrder([ null
          , 'ordering'
          , null
          , 'gc'
          , 'clip_x_origin'
          , 'clip_y_origin'
          ], obj)
      args[0] = 59
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, FreeGC: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'gc'
          ], obj)
      args[0] = 60
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, ClearArea: 
  [ function(obj, cb) {
      var format = 'CCSLssSS'
        , args   = parameterOrder([ null
          , 'exposures'
          , null
          , 'window'
          , 'x'
          , 'y'
          , 'width'
          , 'height'
          ], obj)
      args[0] = 61
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, CopyArea: 
  [ function(obj, cb) {
      var format = 'CxSLLLssssSS'
        , args   = parameterOrder([ null
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
          ], obj)
      args[0] = 62
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, CopyPlane: 
  [ function(obj, cb) {
      var format = 'CxSLLLssssSSL'
        , args   = parameterOrder([ null
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
          ], obj)
      args[0] = 63
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, PolyPoint: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = parameterOrder([ null
          , 'coordinate_mode'
          , null
          , 'drawable'
          , 'gc'
          ], obj)
      args[0] = 64
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, PolyLine: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = parameterOrder([ null
          , 'coordinate_mode'
          , null
          , 'drawable'
          , 'gc'
          ], obj)
      args[0] = 65
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, PolySegment: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          ], obj)
      args[0] = 66
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, PolyRectangle: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          ], obj)
      args[0] = 67
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, PolyArc: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          ], obj)
      args[0] = 68
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, FillPoly: 
  [ function(obj, cb) {
      var format = 'CxSLLCCxx'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          , 'shape'
          , 'coordinate_mode'
          ], obj)
      args[0] = 69
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, PolyFillRectangle: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          ], obj)
      args[0] = 70
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, PolyFillArc: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          ], obj)
      args[0] = 71
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, PutImage: 
  [ function(obj, cb) {
      var format = 'CCSLLSSssCCxx'
        , args   = parameterOrder([ null
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
          ], obj)
      args[0] = 72
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, GetImage: 
  [ function(obj, cb) {
      var format = 'CCSLssSSL'
        , args   = parameterOrder([ null
          , 'format'
          , null
          , 'drawable'
          , 'x'
          , 'y'
          , 'width'
          , 'height'
          , 'plane_mask'
          ], obj)
      args[0] = 73
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, PolyText8: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          ], obj)
      args[0] = 74
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, PolyText16: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder([ null
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          ], obj)
      args[0] = 75
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, ImageText8: 
  [ function(obj, cb) {
      var format = 'CCSLLss'
        , args   = parameterOrder([ null
          , 'string_len'
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          ], obj)
      args[0] = 76
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, ImageText16: 
  [ function(obj, cb) {
      var format = 'CCSLLss'
        , args   = parameterOrder([ null
          , 'string_len'
          , null
          , 'drawable'
          , 'gc'
          , 'x'
          , 'y'
          ], obj)
      args[0] = 77
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, CreateColormap: 
  [ function(obj, cb) {
      var format = 'CCSLLL'
        , args   = parameterOrder([ null
          , 'alloc'
          , null
          , 'mid'
          , 'window'
          , 'visual'
          ], obj)
      args[0] = 78
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, FreeColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          ], obj)
      args[0] = 79
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, CopyColormapAndFree: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'mid'
          , 'src_cmap'
          ], obj)
      args[0] = 80
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, InstallColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          ], obj)
      args[0] = 81
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, UninstallColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          ], obj)
      args[0] = 82
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, ListInstalledColormaps: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'window'
          ], obj)
      args[0] = 83
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, AllocColor: 
  [ function(obj, cb) {
      var format = 'CxSLSSSxx'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          , 'red'
          , 'green'
          , 'blue'
          ], obj)
      args[0] = 84
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, AllocNamedColor: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          , 'name_len'
          ], obj)
      args[0] = 85
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, AllocColorCells: 
  [ function(obj, cb) {
      var format = 'CCSLSS'
        , args   = parameterOrder([ null
          , 'contiguous'
          , null
          , 'cmap'
          , 'colors'
          , 'planes'
          ], obj)
      args[0] = 86
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, AllocColorPlanes: 
  [ function(obj, cb) {
      var format = 'CCSLSSSS'
        , args   = parameterOrder([ null
          , 'contiguous'
          , null
          , 'cmap'
          , 'colors'
          , 'reds'
          , 'greens'
          , 'blues'
          ], obj)
      args[0] = 87
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, FreeColors: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          , 'plane_mask'
          ], obj)
      args[0] = 88
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, StoreColors: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          ], obj)
      args[0] = 89
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, StoreNamedColor: 
  [ function(obj, cb) {
      var format = 'CCSLLSxx'
        , args   = parameterOrder([ null
          , 'flags'
          , null
          , 'cmap'
          , 'pixel'
          , 'name_len'
          ], obj)
      args[0] = 90
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, QueryColors: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          ], obj)
      args[0] = 91
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, LookupColor: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder([ null
          , null
          , 'cmap'
          , 'name_len'
          ], obj)
      args[0] = 92
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, CreateCursor: 
  [ function(obj, cb) {
      var format = 'CxSLLLSSSSSSSS'
        , args   = parameterOrder([ null
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
          ], obj)
      args[0] = 93
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, CreateGlyphCursor: 
  [ function(obj, cb) {
      var format = 'CxSLLLSSSSSSSS'
        , args   = parameterOrder([ null
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
          ], obj)
      args[0] = 94
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, FreeCursor: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'cursor'
          ], obj)
      args[0] = 95
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, RecolorCursor: 
  [ function(obj, cb) {
      var format = 'CxSLSSSSSS'
        , args   = parameterOrder([ null
          , null
          , 'cursor'
          , 'fore_red'
          , 'fore_green'
          , 'fore_blue'
          , 'back_red'
          , 'back_green'
          , 'back_blue'
          ], obj)
      args[0] = 96
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, QueryBestSize: 
  [ function(obj, cb) {
      var format = 'CCSLSS'
        , args   = parameterOrder([ null
          , '_class'
          , null
          , 'drawable'
          , 'width'
          , 'height'
          ], obj)
      args[0] = 97
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, QueryExtension: 
  [ function(obj, cb) {
      var format = 'CxSSxx'
        , args   = parameterOrder([ null
          , null
          , 'name_len'
          ], obj)
      args[0] = 98
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ListExtensions: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 99
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ChangeKeyboardMapping: 
  [ function(obj, cb) {
      var format = 'CCSCC'
        , args   = parameterOrder([ null
          , 'keycode_count'
          , null
          , 'first_keycode'
          , 'keysyms_per_keycode'
          ], obj)
      args[0] = 100
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, GetKeyboardMapping: 
  [ function(obj, cb) {
      var format = 'CxSCC'
        , args   = parameterOrder([ null
          , null
          , 'first_keycode'
          , 'count'
          ], obj)
      args[0] = 101
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ChangeKeyboardControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
        , packed = packMask(valueMask[ChangeKeyboardControl], obj.value_mask)
      format += "L"
      args.push(packed[0])
      args = args.concat(packed[1])
      format += new Array(packed[1].length + 1).join("L")
      args[0] = 102
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GetKeyboardControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 103
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, Bell: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder([ null
          , 'percent'
          , null
          ], obj)
      args[0] = 104
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, ChangePointerControl: 
  [ function(obj, cb) {
      var format = 'CxSsssCC'
        , args   = parameterOrder([ null
          , null
          , 'acceleration_numerator'
          , 'acceleration_denominator'
          , 'threshold'
          , 'do_acceleration'
          , 'do_threshold'
          ], obj)
      args[0] = 105
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GetPointerControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 106
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, SetScreenSaver: 
  [ function(obj, cb) {
      var format = 'CxSssCC'
        , args   = parameterOrder([ null
          , null
          , 'timeout'
          , 'interval'
          , 'prefer_blanking'
          , 'allow_exposures'
          ], obj)
      args[0] = 107
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, GetScreenSaver: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 108
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, ChangeHosts: 
  [ function(obj, cb) {
      var format = 'CCSCxS'
        , args   = parameterOrder([ null
          , 'mode'
          , null
          , 'family'
          , 'address_len'
          ], obj)
      args[0] = 109
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, ListHosts: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 110
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, SetAccessControl: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder([ null
          , 'mode'
          , null
          ], obj)
      args[0] = 111
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, SetCloseDownMode: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder([ null
          , 'mode'
          , null
          ], obj)
      args[0] = 112
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, KillClient: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder([ null
          , null
          , 'resource'
          ], obj)
      args[0] = 113
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, RotateProperties: 
  [ function(obj, cb) {
      var format = 'CxSLSs'
        , args   = parameterOrder([ null
          , null
          , 'window'
          , 'atoms_len'
          , 'delta'
          ], obj)
      args[0] = 114
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
, ForceScreenSaver: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder([ null
          , 'mode'
          , null
          ], obj)
      args[0] = 115
      args[2] = 123//get to this later

      return [format, args]
    }
  ]
, SetPointerMapping: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder([ null
          , 'map_len'
          , null
          ], obj)
      args[0] = 116
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, GetPointerMapping: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 117
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, SetModifierMapping: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder([ null
          , 'keycodes_per_modifier'
          , null
          ], obj)
      args[0] = 118
      args[2] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, GetModifierMapping: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 119
      args[1] = 123//get to this later

      return [format, args]
    }
  , function(buf, format) {

    }
  ]
, NoOperation: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder([ null
          , null
          ], obj)
      args[0] = 127
      args[1] = 123//get to this later

      return [format, args]
    }
  ]
}