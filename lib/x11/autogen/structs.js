var structs = exports
  , xutil = require('../xutil')
  , parameterOrder = xutil.parameterOrder
  , size = xutil.formatSize
  , associate = xutil.associate

structs.CHAR2B = {}

structs.CHAR2B.pack = function packCHAR2B(obj, format) {
  format = format || ""
  format += 'CC'
  var args = [ 
        'byte1'
      , 'byte2' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.CHAR2B.unpack = function unpackCHAR2B(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'byte1'
      , 'byte2' ]
    , format = "CC"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.POINT = {}

structs.POINT.pack = function packPOINT(obj, format) {
  format = format || ""
  format += 'ss'
  var args = [ 
        'x'
      , 'y' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.POINT.unpack = function unpackPOINT(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'x'
      , 'y' ]
    , format = "ss"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.RECTANGLE = {}

structs.RECTANGLE.pack = function packRECTANGLE(obj, format) {
  format = format || ""
  format += 'ssSS'
  var args = [ 
        'x'
      , 'y'
      , 'width'
      , 'height' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.RECTANGLE.unpack = function unpackRECTANGLE(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'x'
      , 'y'
      , 'width'
      , 'height' ]
    , format = "ssSS"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.ARC = {}

structs.ARC.pack = function packARC(obj, format) {
  format = format || ""
  format += 'ssSSss'
  var args = [ 
        'x'
      , 'y'
      , 'width'
      , 'height'
      , 'angle1'
      , 'angle2' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.ARC.unpack = function unpackARC(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'x'
      , 'y'
      , 'width'
      , 'height'
      , 'angle1'
      , 'angle2' ]
    , format = "ssSSss"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.FORMAT = {}

structs.FORMAT.pack = function packFORMAT(obj, format) {
  format = format || ""
  format += 'CCCxxxxx'
  var args = [ 
        'depth'
      , 'bits_per_pixel'
      , 'scanline_pad' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.FORMAT.unpack = function unpackFORMAT(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'depth'
      , 'bits_per_pixel'
      , 'scanline_pad' ]
    , format = "CCCxxxxx"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.VISUALTYPE = {}

structs.VISUALTYPE.pack = function packVISUALTYPE(obj, format) {
  format = format || ""
  format += 'LCCSLLLxxxx'
  var args = [ 
        'visual_id'
      , '_class'
      , 'bits_per_rgb_value'
      , 'colormap_entries'
      , 'red_mask'
      , 'green_mask'
      , 'blue_mask' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.VISUALTYPE.unpack = function unpackVISUALTYPE(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'visual_id'
      , 'class'
      , 'bits_per_rgb_value'
      , 'colormap_entries'
      , 'red_mask'
      , 'green_mask'
      , 'blue_mask' ]
    , format = "LCCSLLLxxxx"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.DEPTH = {}

structs.DEPTH.pack = function packDEPTH(obj, format) {
  format = format || ""
  format += 'CxSxxxx'
  var args = [ 
        'depth'
      , 'visuals_len'
      , 'visuals' ]
    , addSize = 0
  var i = 0
    , len = obj.visuals.length
  obj.visuals_len = len
  for (; i < len; ++i) {
    var result = structs.VISUALTYPE.pack(obj.visuals[i], format)
    format = result[0]
    obj.visuals[i] = result[1]
    addSize += result[2]
  }
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.DEPTH.unpack = function unpackDEPTH(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'depth'
      , 'visuals_len' ]
    , format = "CxSxxxx"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  var i = 0
    , len = ret.visuals_len
  ret.visuals = []
  for (; i < len; ++i) {
    var result = structs.VISUALTYPE.unpack(buf, offset)
    ret.visuals.push(result[0])
    offset = result[1]
  }
  return [ret, offset]
}

structs.SCREEN = {}

structs.SCREEN.pack = function packSCREEN(obj, format) {
  format = format || ""
  format += 'LLLLLSSSSSSLCCCC'
  var args = [ 
        'root'
      , 'default_colormap'
      , 'white_pixel'
      , 'black_pixel'
      , 'current_input_masks'
      , 'width_in_pixels'
      , 'height_in_pixels'
      , 'width_in_millimeters'
      , 'height_in_millimeters'
      , 'min_installed_maps'
      , 'max_installed_maps'
      , 'root_visual'
      , 'backing_stores'
      , 'save_unders'
      , 'root_depth'
      , 'allowed_depths_len'
      , 'allowed_depths' ]
    , addSize = 0
  var i = 0
    , len = obj.allowed_depths.length
  obj.allowed_depths_len = len
  for (; i < len; ++i) {
    var result = structs.DEPTH.pack(obj.allowed_depths[i], format)
    format = result[0]
    obj.allowed_depths[i] = result[1]
    addSize += result[2]
  }
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.SCREEN.unpack = function unpackSCREEN(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'root'
      , 'default_colormap'
      , 'white_pixel'
      , 'black_pixel'
      , 'current_input_masks'
      , 'width_in_pixels'
      , 'height_in_pixels'
      , 'width_in_millimeters'
      , 'height_in_millimeters'
      , 'min_installed_maps'
      , 'max_installed_maps'
      , 'root_visual'
      , 'backing_stores'
      , 'save_unders'
      , 'root_depth'
      , 'allowed_depths_len' ]
    , format = "LLLLLSSSSSSLCCCC"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  var i = 0
    , len = ret.allowed_depths_len
  ret.allowed_depths = []
  for (; i < len; ++i) {
    var result = structs.DEPTH.unpack(buf, offset)
    ret.allowed_depths.push(result[0])
    offset = result[1]
  }
  return [ret, offset]
}

structs.SetupRequest = {}

structs.SetupRequest.pack = function packSetupRequest(obj, format) {
  format = format || ""
  format += 'CxSSSSxx'
  var args = [ 
        'byte_order'
      , 'protocol_major_version'
      , 'protocol_minor_version'
      , 'authorization_protocol_name_len'
      , 'authorization_protocol_data_len'
      , 'authorization_protocol_name'
      , 'authorization_protocol_data' ]
    , addSize = 0
  var len = xutil.padded_length(obj.authorization_protocol_name.length)
    , buf_name = new Buffer(len)
  obj.authorization_protocol_name_len = Buffer.byteLength(obj.authorization_protocol_name)
  buf_name.write(obj.authorization_protocol_name)
  obj.authorization_protocol_name = buf_name
  format += 'a'
  addSize += (len / 4)
  var len = xutil.padded_length(obj.authorization_protocol_data.length)
    , buf_name = new Buffer(len)
  obj.authorization_protocol_data_len = Buffer.byteLength(obj.authorization_protocol_data)
  buf_name.write(obj.authorization_protocol_data)
  obj.authorization_protocol_data = buf_name
  format += 'a'
  addSize += (len / 4)
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.SetupRequest.unpack = function unpackSetupRequest(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'byte_order'
      , 'protocol_major_version'
      , 'protocol_minor_version'
      , 'authorization_protocol_name_len'
      , 'authorization_protocol_data_len' ]
    , format = "CxSSSSxx"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  ret.authorization_protocol_name = buf.slice(offset, offset + ret.authorization_protocol_name_len).toString()
  offset += ret.authorization_protocol_name_len
  ret.authorization_protocol_data = buf.slice(offset, offset + ret.authorization_protocol_data_len).toString()
  offset += ret.authorization_protocol_data_len
  return [ret, offset]
}

structs.SetupFailed = {}

structs.SetupFailed.pack = function packSetupFailed(obj, format) {
  format = format || ""
  format += 'CCSSS'
  var args = [ 
        'status'
      , 'reason_len'
      , 'protocol_major_version'
      , 'protocol_minor_version'
      , 'length'
      , 'reason' ]
    , addSize = 0
  var len = xutil.padded_length(obj.reason.length)
    , buf_name = new Buffer(len)
  obj.reason_len = Buffer.byteLength(obj.reason)
  buf_name.write(obj.reason)
  obj.reason = buf_name
  format += 'a'
  addSize += (len / 4)
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.SetupFailed.unpack = function unpackSetupFailed(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'status'
      , 'reason_len'
      , 'protocol_major_version'
      , 'protocol_minor_version'
      , 'length' ]
    , format = "CCSSS"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  ret.reason = buf.slice(offset, offset + ret.reason_len).toString()
  offset += ret.reason_len
  return [ret, offset]
}

structs.SetupAuthenticate = {}

structs.SetupAuthenticate.pack = function packSetupAuthenticate(obj, format) {
  format = format || ""
  format += 'CxxxxxS'
  var args = [ 
        'status'
      , 'length'
      , 'reason' ]
    , addSize = 0
  var len = xutil.padded_length(obj.reason.length)
    , buf_name = new Buffer(len)
  obj.reason_len = Buffer.byteLength(obj.reason)
  buf_name.write(obj.reason)
  obj.reason = buf_name
  format += 'a'
  addSize += (len / 4)
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.SetupAuthenticate.unpack = function unpackSetupAuthenticate(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'status'
      , 'length' ]
    , format = "CxxxxxS"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  ret.reason = buf.slice(offset, offset + ret.reason_len).toString()
  offset += ret.reason_len
  return [ret, offset]
}

structs.Setup = {}

structs.Setup.pack = function packSetup(obj, format) {
  format = format || ""
  format += 'CxSSSLLLLSSCCCCCCCCxxxx'
  var args = [ 
        'status'
      , 'protocol_major_version'
      , 'protocol_minor_version'
      , 'length'
      , 'release_number'
      , 'resource_id_base'
      , 'resource_id_mask'
      , 'motion_buffer_size'
      , 'vendor_len'
      , 'maximum_request_length'
      , 'roots_len'
      , 'pixmap_formats_len'
      , 'image_byte_order'
      , 'bitmap_format_bit_order'
      , 'bitmap_format_scanline_unit'
      , 'bitmap_format_scanline_pad'
      , 'min_keycode'
      , 'max_keycode'
      , 'vendor'
      , 'pixmap_formats'
      , 'roots' ]
    , addSize = 0
  var len = xutil.padded_length(obj.vendor.length)
    , buf_name = new Buffer(len)
  obj.vendor_len = Buffer.byteLength(obj.vendor)
  buf_name.write(obj.vendor)
  obj.vendor = buf_name
  format += 'a'
  addSize += (len / 4)
  var i = 0
    , len = obj.pixmap_formats.length
  obj.pixmap_formats_len = len
  for (; i < len; ++i) {
    var result = structs.FORMAT.pack(obj.pixmap_formats[i], format)
    format = result[0]
    obj.pixmap_formats[i] = result[1]
    addSize += result[2]
  }
  var i = 0
    , len = obj.roots.length
  obj.roots_len = len
  for (; i < len; ++i) {
    var result = structs.SCREEN.pack(obj.roots[i], format)
    format = result[0]
    obj.roots[i] = result[1]
    addSize += result[2]
  }
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.Setup.unpack = function unpackSetup(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'status'
      , 'protocol_major_version'
      , 'protocol_minor_version'
      , 'length'
      , 'release_number'
      , 'resource_id_base'
      , 'resource_id_mask'
      , 'motion_buffer_size'
      , 'vendor_len'
      , 'maximum_request_length'
      , 'roots_len'
      , 'pixmap_formats_len'
      , 'image_byte_order'
      , 'bitmap_format_bit_order'
      , 'bitmap_format_scanline_unit'
      , 'bitmap_format_scanline_pad'
      , 'min_keycode'
      , 'max_keycode' ]
    , format = "CxSSSLLLLSSCCCCCCCCxxxx"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  ret.vendor = buf.slice(offset, offset + ret.vendor_len).toString()
  offset += ret.vendor_len
  var i = 0
    , len = ret.pixmap_formats_len
  ret.pixmap_formats = []
  for (; i < len; ++i) {
    var result = structs.FORMAT.unpack(buf, offset)
    ret.pixmap_formats.push(result[0])
    offset = result[1]
  }
  var i = 0
    , len = ret.roots_len
  ret.roots = []
  for (; i < len; ++i) {
    var result = structs.SCREEN.unpack(buf, offset)
    ret.roots.push(result[0])
    offset = result[1]
  }
  return [ret, offset]
}

structs.TIMECOORD = {}

structs.TIMECOORD.pack = function packTIMECOORD(obj, format) {
  format = format || ""
  format += 'Lss'
  var args = [ 
        'time'
      , 'x'
      , 'y' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.TIMECOORD.unpack = function unpackTIMECOORD(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'time'
      , 'x'
      , 'y' ]
    , format = "Lss"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.FONTPROP = {}

structs.FONTPROP.pack = function packFONTPROP(obj, format) {
  format = format || ""
  format += 'LL'
  var args = [ 
        'name'
      , 'value' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.FONTPROP.unpack = function unpackFONTPROP(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'name'
      , 'value' ]
    , format = "LL"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.CHARINFO = {}

structs.CHARINFO.pack = function packCHARINFO(obj, format) {
  format = format || ""
  format += 'sssssS'
  var args = [ 
        'left_side_bearing'
      , 'right_side_bearing'
      , 'character_width'
      , 'ascent'
      , 'descent'
      , 'attributes' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.CHARINFO.unpack = function unpackCHARINFO(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'left_side_bearing'
      , 'right_side_bearing'
      , 'character_width'
      , 'ascent'
      , 'descent'
      , 'attributes' ]
    , format = "sssssS"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.STR = {}

structs.STR.pack = function packSTR(obj, format) {
  format = format || ""
  format += 'C'
  var args = [ 
        'name_len'
      , 'name' ]
    , addSize = 0
  var len = xutil.padded_length(obj.name.length)
    , buf_name = new Buffer(len)
  obj.name_len = Buffer.byteLength(obj.name)
  buf_name.write(obj.name)
  obj.name = buf_name
  format += 'a'
  addSize += (len / 4)
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.STR.unpack = function unpackSTR(buf, offset) {
  offset = offset || 0
  var fields
    , format = "C"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  ret.name = buf.slice(offset, offset + ret.name_len).toString()
  offset += ret.name_len
  return [ret, offset]
}

structs.SEGMENT = {}

structs.SEGMENT.pack = function packSEGMENT(obj, format) {
  format = format || ""
  format += 'ssss'
  var args = [ 
        'x1'
      , 'y1'
      , 'x2'
      , 'y2' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.SEGMENT.unpack = function unpackSEGMENT(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'x1'
      , 'y1'
      , 'x2'
      , 'y2' ]
    , format = "ssss"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.COLORITEM = {}

structs.COLORITEM.pack = function packCOLORITEM(obj, format) {
  format = format || ""
  format += 'LSSSCx'
  var args = [ 
        'pixel'
      , 'red'
      , 'green'
      , 'blue'
      , 'flags' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.COLORITEM.unpack = function unpackCOLORITEM(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'pixel'
      , 'red'
      , 'green'
      , 'blue'
      , 'flags' ]
    , format = "LSSSCx"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.RGB = {}

structs.RGB.pack = function packRGB(obj, format) {
  format = format || ""
  format += 'SSSxx'
  var args = [ 
        'red'
      , 'green'
      , 'blue' ]
    , addSize = 0
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.RGB.unpack = function unpackRGB(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'red'
      , 'green'
      , 'blue' ]
    , format = "SSSxx"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  return [ret, offset]
}

structs.HOST = {}

structs.HOST.pack = function packHOST(obj, format) {
  format = format || ""
  format += 'CxS'
  var args = [ 
        'family'
      , 'address_len'
      , 'address' ]
    , addSize = 0
  var len = obj.address.length
  format += new Array(len + 1).join("C")
  obj.address_len = len
  args = parameterOrder(args, obj)
  return [format, args, addSize]
}

structs.HOST.unpack = function unpackHOST(buf, offset) {
  offset = offset || 0
  var fields =
      [ 'family'
      , 'address_len' ]
    , format = "CxS"
    , unpacked = buf.unpack(format, offset)
    , ret = associate(fields, unpacked)
  offset = unpacked.offset
  var len = ret.address_len
  ret.address = buf.unpack(new Array(len + 1).join("C"), offset)
  offset = ret.address.offset
  return [ret, offset]
}