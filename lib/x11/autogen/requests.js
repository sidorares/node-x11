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
    return obj[name]
  })
}

module.exports = 
{ CreateWindow: 
  [ function(obj, cb) {
      var format = 'CCSLLssSSSSL'
        , args   = parameterOrder( [ 'depth' , 'wid' , 'parent' , 'x' , 'y' , 'width' , 'height' , 'border_width' , '_class' , 'visual' ], obj)
        , packed = packMask(valueMask[CreateWindow], obj.)
    }
  ]
, ChangeWindowAttributes: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  ]
, GetWindowAttributes: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  , function(buf, format) {

    }
  ]
, DestroyWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  ]
, DestroySubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  ]
, ChangeSaveSet: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = parameterOrder( [ 'mode' , 'window' ], obj)
    }
  ]
, ReparentWindow: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder( [ 'window' , 'parent' , 'x' , 'y' ], obj)
    }
  ]
, MapWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  ]
, MapSubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  ]
, UnmapWindow: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  ]
, UnmapSubwindows: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  ]
, ConfigureWindow: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder( [ 'window' , 'value_mask' ], obj)
    }
  ]
, CirculateWindow: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = parameterOrder( [ 'direction' , 'window' ], obj)
    }
  ]
, GetGeometry: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'drawable' ], obj)
    }
  , function(buf, format) {

    }
  ]
, QueryTree: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  , function(buf, format) {

    }
  ]
, InternAtom: 
  [ function(obj, cb) {
      var format = 'CCSSxx'
        , args   = parameterOrder( [ 'only_if_exists' , 'name_len' ], obj)
    }
  , function(buf, format) {

    }
  ]
, GetAtomName: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'atom' ], obj)
    }
  , function(buf, format) {

    }
  ]
, ChangeProperty: 
  [ function(obj, cb) {
      var format = 'CCSLLLCxxxL'
        , args   = parameterOrder( [ 'mode' , 'window' , 'property' , 'type' , 'format' , 'data_len' ], obj)
    }
  ]
, DeleteProperty: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'window' , 'property' ], obj)
    }
  ]
, GetProperty: 
  [ function(obj, cb) {
      var format = 'CCSLLLLL'
        , args   = parameterOrder( [ '_delete' , 'window' , 'property' , 'type' , 'long_offset' , 'long_length' ], obj)
    }
  , function(buf, format) {

    }
  ]
, ListProperties: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  , function(buf, format) {

    }
  ]
, SetSelectionOwner: 
  [ function(obj, cb) {
      var format = 'CxSLLundefined'
        , args   = parameterOrder( [ 'owner' , 'selection' , 'time' ], obj)
    }
  ]
, GetSelectionOwner: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'selection' ], obj)
    }
  , function(buf, format) {

    }
  ]
, ConvertSelection: 
  [ function(obj, cb) {
      var format = 'CxSLLLLundefined'
        , args   = parameterOrder( [ 'requestor' , 'selection' , 'target' , 'property' , 'time' ], obj)
    }
  ]
, SendEvent: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = parameterOrder( [ 'propagate' , 'destination' , 'event_mask' ], obj)
    }
  ]
, GrabPointer: 
  [ function(obj, cb) {
      var format = 'CCSLSCCLLundefined'
        , args   = parameterOrder( [ 'owner_events' , 'grab_window' , 'event_mask' , 'pointer_mode' , 'keyboard_mode' , 'confine_to' , 'cursor' , 'time' ], obj)
    }
  , function(buf, format) {

    }
  ]
, UngrabPointer: 
  [ function(obj, cb) {
      var format = 'CxSundefined'
        , args   = parameterOrder( [ 'time' ], obj)
    }
  ]
, GrabButton: 
  [ function(obj, cb) {
      var format = 'CCSLSCCLLCxS'
        , args   = parameterOrder( [ 'owner_events' , 'grab_window' , 'event_mask' , 'pointer_mode' , 'keyboard_mode' , 'confine_to' , 'cursor' , 'button' , 'modifiers' ], obj)
    }
  ]
, UngrabButton: 
  [ function(obj, cb) {
      var format = 'CCSLSxx'
        , args   = parameterOrder( [ 'button' , 'grab_window' , 'modifiers' ], obj)
    }
  ]
, ChangeActivePointerGrab: 
  [ function(obj, cb) {
      var format = 'CxSLundefinedSxx'
        , args   = parameterOrder( [ 'cursor' , 'time' , 'event_mask' ], obj)
    }
  ]
, GrabKeyboard: 
  [ function(obj, cb) {
      var format = 'CCSLundefinedCCxx'
        , args   = parameterOrder( [ 'owner_events' , 'grab_window' , 'time' , 'pointer_mode' , 'keyboard_mode' ], obj)
    }
  , function(buf, format) {

    }
  ]
, UngrabKeyboard: 
  [ function(obj, cb) {
      var format = 'CxSundefined'
        , args   = parameterOrder( [ 'time' ], obj)
    }
  ]
, GrabKey: 
  [ function(obj, cb) {
      var format = 'CCSLSCCCxxx'
        , args   = parameterOrder( [ 'owner_events' , 'grab_window' , 'modifiers' , 'key' , 'pointer_mode' , 'keyboard_mode' ], obj)
    }
  ]
, UngrabKey: 
  [ function(obj, cb) {
      var format = 'CCSLSxx'
        , args   = parameterOrder( [ 'key' , 'grab_window' , 'modifiers' ], obj)
    }
  ]
, AllowEvents: 
  [ function(obj, cb) {
      var format = 'CCSundefined'
        , args   = parameterOrder( [ 'mode' , 'time' ], obj)
    }
  ]
, GrabServer: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  ]
, UngrabServer: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  ]
, QueryPointer: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  , function(buf, format) {

    }
  ]
, GetMotionEvents: 
  [ function(obj, cb) {
      var format = 'CxSLundefinedundefined'
        , args   = parameterOrder( [ 'window' , 'start' , 'stop' ], obj)
    }
  , function(buf, format) {

    }
  ]
, TranslateCoordinates: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder( [ 'src_window' , 'dst_window' , 'src_x' , 'src_y' ], obj)
    }
  , function(buf, format) {

    }
  ]
, WarpPointer: 
  [ function(obj, cb) {
      var format = 'CxSLLssSSss'
        , args   = parameterOrder( [ 'src_window' , 'dst_window' , 'src_x' , 'src_y' , 'src_width' , 'src_height' , 'dst_x' , 'dst_y' ], obj)
    }
  ]
, SetInputFocus: 
  [ function(obj, cb) {
      var format = 'CCSLundefined'
        , args   = parameterOrder( [ 'revert_to' , 'focus' , 'time' ], obj)
    }
  ]
, GetInputFocus: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, QueryKeymap: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, OpenFont: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder( [ 'fid' , 'name_len' ], obj)
    }
  ]
, CloseFont: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'font' ], obj)
    }
  ]
, QueryFont: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'font' ], obj)
    }
  , function(buf, format) {

    }
  ]
, QueryTextExtents: 
  [ function(obj, cb) {
      var format = 'CCSL'
        , args   = parameterOrder( [ 'font' ], obj)
    }
  , function(buf, format) {

    }
  ]
, ListFonts: 
  [ function(obj, cb) {
      var format = 'CxSSS'
        , args   = parameterOrder( [ 'max_names' , 'pattern_len' ], obj)
    }
  , function(buf, format) {

    }
  ]
, ListFontsWithInfo: 
  [ function(obj, cb) {
      var format = 'CxSSS'
        , args   = parameterOrder( [ 'max_names' , 'pattern_len' ], obj)
    }
  , function(buf, format) {

    }
  ]
, SetFontPath: 
  [ function(obj, cb) {
      var format = 'CxSS'
        , args   = parameterOrder( [ 'font_qty' ], obj)
    }
  ]
, GetFontPath: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, CreatePixmap: 
  [ function(obj, cb) {
      var format = 'CCSLLSS'
        , args   = parameterOrder( [ 'depth' , 'pid' , 'drawable' , 'width' , 'height' ], obj)
    }
  ]
, FreePixmap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'pixmap' ], obj)
    }
  ]
, CreateGC: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'cid' , 'drawable' ], obj)
        , packed = packMask(valueMask[CreateGC], obj.)
    }
  ]
, ChangeGC: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'gc' ], obj)
    }
  ]
, CopyGC: 
  [ function(obj, cb) {
      var format = 'CxSLLL'
        , args   = parameterOrder( [ 'src_gc' , 'dst_gc' , 'value_mask' ], obj)
    }
  ]
, SetDashes: 
  [ function(obj, cb) {
      var format = 'CxSLSS'
        , args   = parameterOrder( [ 'gc' , 'dash_offset' , 'dashes_len' ], obj)
    }
  ]
, SetClipRectangles: 
  [ function(obj, cb) {
      var format = 'CCSLss'
        , args   = parameterOrder( [ 'ordering' , 'gc' , 'clip_x_origin' , 'clip_y_origin' ], obj)
    }
  ]
, FreeGC: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'gc' ], obj)
    }
  ]
, ClearArea: 
  [ function(obj, cb) {
      var format = 'CCSLssSS'
        , args   = parameterOrder( [ 'exposures' , 'window' , 'x' , 'y' , 'width' , 'height' ], obj)
    }
  ]
, CopyArea: 
  [ function(obj, cb) {
      var format = 'CxSLLLssssSS'
        , args   = parameterOrder( [ 'src_drawable' , 'dst_drawable' , 'gc' , 'src_x' , 'src_y' , 'dst_x' , 'dst_y' , 'width' , 'height' ], obj)
    }
  ]
, CopyPlane: 
  [ function(obj, cb) {
      var format = 'CxSLLLssssSSL'
        , args   = parameterOrder( [ 'src_drawable' , 'dst_drawable' , 'gc' , 'src_x' , 'src_y' , 'dst_x' , 'dst_y' , 'width' , 'height' , 'bit_plane' ], obj)
    }
  ]
, PolyPoint: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = parameterOrder( [ 'coordinate_mode' , 'drawable' , 'gc' ], obj)
    }
  ]
, PolyLine: 
  [ function(obj, cb) {
      var format = 'CCSLL'
        , args   = parameterOrder( [ 'coordinate_mode' , 'drawable' , 'gc' ], obj)
    }
  ]
, PolySegment: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'drawable' , 'gc' ], obj)
    }
  ]
, PolyRectangle: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'drawable' , 'gc' ], obj)
    }
  ]
, PolyArc: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'drawable' , 'gc' ], obj)
    }
  ]
, FillPoly: 
  [ function(obj, cb) {
      var format = 'CxSLLCCxx'
        , args   = parameterOrder( [ 'drawable' , 'gc' , 'shape' , 'coordinate_mode' ], obj)
    }
  ]
, PolyFillRectangle: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'drawable' , 'gc' ], obj)
    }
  ]
, PolyFillArc: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'drawable' , 'gc' ], obj)
    }
  ]
, PutImage: 
  [ function(obj, cb) {
      var format = 'CCSLLSSssCCxx'
        , args   = parameterOrder( [ 'format' , 'drawable' , 'gc' , 'width' , 'height' , 'dst_x' , 'dst_y' , 'left_pad' , 'depth' ], obj)
    }
  ]
, GetImage: 
  [ function(obj, cb) {
      var format = 'CCSLssSSL'
        , args   = parameterOrder( [ 'format' , 'drawable' , 'x' , 'y' , 'width' , 'height' , 'plane_mask' ], obj)
    }
  , function(buf, format) {

    }
  ]
, PolyText8: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder( [ 'drawable' , 'gc' , 'x' , 'y' ], obj)
    }
  ]
, PolyText16: 
  [ function(obj, cb) {
      var format = 'CxSLLss'
        , args   = parameterOrder( [ 'drawable' , 'gc' , 'x' , 'y' ], obj)
    }
  ]
, ImageText8: 
  [ function(obj, cb) {
      var format = 'CCSLLss'
        , args   = parameterOrder( [ 'string_len' , 'drawable' , 'gc' , 'x' , 'y' ], obj)
    }
  ]
, ImageText16: 
  [ function(obj, cb) {
      var format = 'CCSLLss'
        , args   = parameterOrder( [ 'string_len' , 'drawable' , 'gc' , 'x' , 'y' ], obj)
    }
  ]
, CreateColormap: 
  [ function(obj, cb) {
      var format = 'CCSLLL'
        , args   = parameterOrder( [ 'alloc' , 'mid' , 'window' , 'visual' ], obj)
    }
  ]
, FreeColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'cmap' ], obj)
    }
  ]
, CopyColormapAndFree: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'mid' , 'src_cmap' ], obj)
    }
  ]
, InstallColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'cmap' ], obj)
    }
  ]
, UninstallColormap: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'cmap' ], obj)
    }
  ]
, ListInstalledColormaps: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'window' ], obj)
    }
  , function(buf, format) {

    }
  ]
, AllocColor: 
  [ function(obj, cb) {
      var format = 'CxSLSSSxx'
        , args   = parameterOrder( [ 'cmap' , 'red' , 'green' , 'blue' ], obj)
    }
  , function(buf, format) {

    }
  ]
, AllocNamedColor: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder( [ 'cmap' , 'name_len' ], obj)
    }
  , function(buf, format) {

    }
  ]
, AllocColorCells: 
  [ function(obj, cb) {
      var format = 'CCSLSS'
        , args   = parameterOrder( [ 'contiguous' , 'cmap' , 'colors' , 'planes' ], obj)
    }
  , function(buf, format) {

    }
  ]
, AllocColorPlanes: 
  [ function(obj, cb) {
      var format = 'CCSLSSSS'
        , args   = parameterOrder( [ 'contiguous' , 'cmap' , 'colors' , 'reds' , 'greens' , 'blues' ], obj)
    }
  , function(buf, format) {

    }
  ]
, FreeColors: 
  [ function(obj, cb) {
      var format = 'CxSLL'
        , args   = parameterOrder( [ 'cmap' , 'plane_mask' ], obj)
    }
  ]
, StoreColors: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'cmap' ], obj)
    }
  ]
, StoreNamedColor: 
  [ function(obj, cb) {
      var format = 'CCSLLSxx'
        , args   = parameterOrder( [ 'flags' , 'cmap' , 'pixel' , 'name_len' ], obj)
    }
  ]
, QueryColors: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'cmap' ], obj)
    }
  , function(buf, format) {

    }
  ]
, LookupColor: 
  [ function(obj, cb) {
      var format = 'CxSLSxx'
        , args   = parameterOrder( [ 'cmap' , 'name_len' ], obj)
    }
  , function(buf, format) {

    }
  ]
, CreateCursor: 
  [ function(obj, cb) {
      var format = 'CxSLLLSSSSSSSS'
        , args   = parameterOrder( [ 'cid' , 'source' , 'mask' , 'fore_red' , 'fore_green' , 'fore_blue' , 'back_red' , 'back_green' , 'back_blue' , 'x' , 'y' ], obj)
    }
  ]
, CreateGlyphCursor: 
  [ function(obj, cb) {
      var format = 'CxSLLLSSSSSSSS'
        , args   = parameterOrder( [ 'cid' , 'source_font' , 'mask_font' , 'source_char' , 'mask_char' , 'fore_red' , 'fore_green' , 'fore_blue' , 'back_red' , 'back_green' , 'back_blue' ], obj)
    }
  ]
, FreeCursor: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'cursor' ], obj)
    }
  ]
, RecolorCursor: 
  [ function(obj, cb) {
      var format = 'CxSLSSSSSS'
        , args   = parameterOrder( [ 'cursor' , 'fore_red' , 'fore_green' , 'fore_blue' , 'back_red' , 'back_green' , 'back_blue' ], obj)
    }
  ]
, QueryBestSize: 
  [ function(obj, cb) {
      var format = 'CCSLSS'
        , args   = parameterOrder( [ '_class' , 'drawable' , 'width' , 'height' ], obj)
    }
  , function(buf, format) {

    }
  ]
, QueryExtension: 
  [ function(obj, cb) {
      var format = 'CxSSxx'
        , args   = parameterOrder( [ 'name_len' ], obj)
    }
  , function(buf, format) {

    }
  ]
, ListExtensions: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, ChangeKeyboardMapping: 
  [ function(obj, cb) {
      var format = 'CCSCC'
        , args   = parameterOrder( [ 'keycode_count' , 'first_keycode' , 'keysyms_per_keycode' ], obj)
    }
  ]
, GetKeyboardMapping: 
  [ function(obj, cb) {
      var format = 'CxSCC'
        , args   = parameterOrder( [ 'first_keycode' , 'count' ], obj)
    }
  , function(buf, format) {

    }
  ]
, ChangeKeyboardControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  ]
, GetKeyboardControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, Bell: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder( [ 'percent' ], obj)
    }
  ]
, ChangePointerControl: 
  [ function(obj, cb) {
      var format = 'CxSsssCC'
        , args   = parameterOrder( [ 'acceleration_numerator' , 'acceleration_denominator' , 'threshold' , 'do_acceleration' , 'do_threshold' ], obj)
    }
  ]
, GetPointerControl: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, SetScreenSaver: 
  [ function(obj, cb) {
      var format = 'CxSssCC'
        , args   = parameterOrder( [ 'timeout' , 'interval' , 'prefer_blanking' , 'allow_exposures' ], obj)
    }
  ]
, GetScreenSaver: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, ChangeHosts: 
  [ function(obj, cb) {
      var format = 'CCSCxS'
        , args   = parameterOrder( [ 'mode' , 'family' , 'address_len' ], obj)
    }
  ]
, ListHosts: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, SetAccessControl: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder( [ 'mode' ], obj)
    }
  ]
, SetCloseDownMode: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder( [ 'mode' ], obj)
    }
  ]
, KillClient: 
  [ function(obj, cb) {
      var format = 'CxSL'
        , args   = parameterOrder( [ 'resource' ], obj)
    }
  ]
, RotateProperties: 
  [ function(obj, cb) {
      var format = 'CxSLSs'
        , args   = parameterOrder( [ 'window' , 'atoms_len' , 'delta' ], obj)
    }
  ]
, ForceScreenSaver: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder( [ 'mode' ], obj)
    }
  ]
, SetPointerMapping: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder( [ 'map_len' ], obj)
    }
  , function(buf, format) {

    }
  ]
, GetPointerMapping: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, SetModifierMapping: 
  [ function(obj, cb) {
      var format = 'CCS'
        , args   = parameterOrder( [ 'keycodes_per_modifier' ], obj)
    }
  , function(buf, format) {

    }
  ]
, GetModifierMapping: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  , function(buf, format) {

    }
  ]
, NoOperation: 
  [ function(obj, cb) {
      var format = 'CxS'
        , args   = parameterOrder( ], obj)
    }
  ]
}