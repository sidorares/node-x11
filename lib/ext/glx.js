/*
  GLX extension — OpenGL rendering over the X protocol (indirect rendering).

  references:
  - /opt/X11/include/GL/glxproto.h (canonical request/reply encodings)
  - https://registry.khronos.org/OpenGL/specs/gl/glxproto.pdf
  - http://cgit.freedesktop.org/xcb/proto/tree/src/glx.xml
  - mesa src/glx (indirect.c, glxcmds.c) for vendor-private encodings

  NOTE: modern X servers (Xorg >= 1.17, XQuartz, Xvfb) ship with indirect GLX
  contexts DISABLED; CreateContext then fails with BadValue (value 0).
  Start the server with `+iglx` (see docs/ext/glx.md).
*/

// GLX attribute codes used in visual/fbconfig/drawable/context attribute
// lists (GLX_* names minus the prefix).
const glxAttrib = {
    USE_GL: 1,
    BUFFER_SIZE: 2,
    LEVEL: 3,
    RGBA: 4,
    DOUBLEBUFFER: 5,
    STEREO: 6,
    AUX_BUFFERS: 7,
    RED_SIZE: 8,
    GREEN_SIZE: 9,
    BLUE_SIZE: 10,
    ALPHA_SIZE: 11,
    DEPTH_SIZE: 12,
    STENCIL_SIZE: 13,
    ACCUM_RED_SIZE: 14,
    ACCUM_GREEN_SIZE: 15,
    ACCUM_BLUE_SIZE: 16,
    ACCUM_ALPHA_SIZE: 17,
    CONFIG_CAVEAT: 0x20,           // aka VISUAL_CAVEAT_EXT
    X_VISUAL_TYPE: 0x22,
    TRANSPARENT_TYPE: 0x23,
    TRANSPARENT_INDEX_VALUE: 0x24,
    TRANSPARENT_RED_VALUE: 0x25,
    TRANSPARENT_GREEN_VALUE: 0x26,
    TRANSPARENT_BLUE_VALUE: 0x27,
    TRANSPARENT_ALPHA_VALUE: 0x28,
    VISUAL_ID: 0x800B,
    SCREEN: 0x800C,
    DRAWABLE_TYPE: 0x8010,
    RENDER_TYPE: 0x8011,
    X_RENDERABLE: 0x8012,
    FBCONFIG_ID: 0x8013,
    RGBA_TYPE: 0x8014,
    COLOR_INDEX_TYPE: 0x8015,
    MAX_PBUFFER_WIDTH: 0x8016,
    MAX_PBUFFER_HEIGHT: 0x8017,
    MAX_PBUFFER_PIXELS: 0x8018,
    OPTIMAL_PBUFFER_WIDTH_SGIX: 0x8019,
    OPTIMAL_PBUFFER_HEIGHT_SGIX: 0x801A,
    PRESERVED_CONTENTS: 0x801B,
    LARGEST_PBUFFER: 0x801C,
    WIDTH: 0x801D,
    HEIGHT: 0x801E,
    EVENT_MASK: 0x801F,
    DAMAGED: 0x8020,
    SAVED: 0x8021,
    WINDOW: 0x8022,
    PBUFFER: 0x8023,
    VISUAL_SELECT_GROUP_SGIX: 0x8028,
    // creation-time size attributes for CreatePbuffer
    PBUFFER_HEIGHT: 0x8040,
    PBUFFER_WIDTH: 0x8041,
    SWAP_METHOD_OML: 0x8060,
    SAMPLE_BUFFERS: 100000,
    SAMPLES: 100001,
    // GLX_EXT_texture_from_pixmap
    BIND_TO_TEXTURE_RGB_EXT: 0x20D0,
    BIND_TO_TEXTURE_RGBA_EXT: 0x20D1,
    BIND_TO_MIPMAP_TEXTURE_EXT: 0x20D2,
    BIND_TO_TEXTURE_TARGETS_EXT: 0x20D3,
    Y_INVERTED_EXT: 0x20D4,
    TEXTURE_FORMAT_EXT: 0x20D5,
    TEXTURE_TARGET_EXT: 0x20D6,
    MIPMAP_TEXTURE_EXT: 0x20D7,
    // GLX_ARB_create_context (attributes for CreateContextAttribsARB)
    CONTEXT_MAJOR_VERSION_ARB: 0x2091,
    CONTEXT_MINOR_VERSION_ARB: 0x2092,
    CONTEXT_FLAGS_ARB: 0x2094,
    CONTEXT_PROFILE_MASK_ARB: 0x9126,
    // GLX_ARB_create_context_robustness
    CONTEXT_RESET_NOTIFICATION_STRATEGY_ARB: 0x8256
};

// value constants (bitmasks and enum values used with the attributes above)
const glxConst = {
    NONE: 0x8000,
    DONT_CARE: 0xFFFFFFFF,
    WINDOW_BIT: 0x1,
    PIXMAP_BIT: 0x2,
    PBUFFER_BIT: 0x4,
    RGBA_BIT: 0x1,
    COLOR_INDEX_BIT: 0x2,
    // QueryServerString names
    VENDOR: 0x1,
    VERSION: 0x2,
    EXTENSIONS: 0x3,
    // CONFIG_CAVEAT values
    SLOW_CONFIG: 0x8001,
    NON_CONFORMANT_CONFIG: 0x800D,
    // X_VISUAL_TYPE values
    TRUE_COLOR: 0x8002,
    DIRECT_COLOR: 0x8003,
    PSEUDO_COLOR: 0x8004,
    STATIC_COLOR: 0x8005,
    GRAY_SCALE: 0x8006,
    STATIC_GRAY: 0x8007,
    // TRANSPARENT_TYPE values
    TRANSPARENT_RGB: 0x8008,
    TRANSPARENT_INDEX: 0x8009,
    // event mask + PbufferClobber decode
    PBUFFER_CLOBBER_MASK: 0x08000000,
    DAMAGED_VALUE: 0x8020,
    SAVED_VALUE: 0x8021,
    WINDOW_VALUE: 0x8022,
    PBUFFER_VALUE: 0x8023,
    FRONT_LEFT_BUFFER_BIT: 0x1,
    FRONT_RIGHT_BUFFER_BIT: 0x2,
    BACK_LEFT_BUFFER_BIT: 0x4,
    BACK_RIGHT_BUFFER_BIT: 0x8,
    AUX_BUFFERS_BIT: 0x10,
    DEPTH_BUFFER_BIT: 0x20,
    STENCIL_BUFFER_BIT: 0x40,
    ACCUM_BUFFER_BIT: 0x80,
    // GLX_ARB_create_context values
    CONTEXT_DEBUG_BIT_ARB: 0x1,
    CONTEXT_FORWARD_COMPATIBLE_BIT_ARB: 0x2,
    CONTEXT_ROBUST_ACCESS_BIT_ARB: 0x4,
    CONTEXT_CORE_PROFILE_BIT_ARB: 0x1,
    CONTEXT_COMPATIBILITY_PROFILE_BIT_ARB: 0x2,
    CONTEXT_ES2_PROFILE_BIT_EXT: 0x4,
    NO_RESET_NOTIFICATION_ARB: 0x8261,
    LOSE_CONTEXT_ON_RESET_ARB: 0x8252,
    // GLX_EXT_texture_from_pixmap values
    TEXTURE_FORMAT_NONE_EXT: 0x20D8,
    TEXTURE_FORMAT_RGB_EXT: 0x20D9,
    TEXTURE_FORMAT_RGBA_EXT: 0x20DA,
    TEXTURE_1D_BIT_EXT: 0x1,
    TEXTURE_2D_BIT_EXT: 0x2,
    TEXTURE_RECTANGLE_BIT_EXT: 0x4,
    TEXTURE_1D_EXT: 0x20DB,
    TEXTURE_2D_EXT: 0x20DC,
    TEXTURE_RECTANGLE_EXT: 0x20DD,
    FRONT_LEFT_EXT: 0x20DE,
    FRONT_RIGHT_EXT: 0x20DF,
    BACK_LEFT_EXT: 0x20E0,
    BACK_RIGHT_EXT: 0x20E1,
    AUX0_EXT: 0x20E2,
    // GLX_OML_swap_method values
    SWAP_EXCHANGE_OML: 0x8061,
    SWAP_COPY_OML: 0x8062,
    SWAP_UNDEFINED_OML: 0x8063
};

// vendor-private opcodes (X_GLXvop_*)
const vop = {
    BindTexImageEXT: 1330,
    ReleaseTexImageEXT: 1331,
    MakeCurrentReadSGI: 65537,
    GetFBConfigsSGIX: 65540,
    CreateContextWithConfigSGIX: 65541,
    CreateGLXPixmapWithConfigSGIX: 65542,
    CreateGLXPbufferSGIX: 65543,
    DestroyGLXPbufferSGIX: 65544,
    ChangeDrawableAttributesSGIX: 65545,
    GetDrawableAttributesSGIX: 65546,
    CopySubBufferMESA: 5154
};

const attribNameByCode = {};
for (const name in glxAttrib)
    attribNameByCode[glxAttrib[name]] = name;

// decode a list of (attribute, value) CARD32 pairs into an object keyed by
// attribute name (unknown attributes keep their numeric code as key)
function decodeAttribPairs(buf, offset, numPairs) {
    const res = {};
    for (let i = 0; i < numPairs; ++i) {
        const code = buf.readUInt32LE(offset + i * 8);
        const value = buf.readUInt32LE(offset + i * 8 + 4);
        res[attribNameByCode[code] || code] = value;
    }
    return res;
}

// strip trailing NUL padding from protocol strings
function cstr(buf, offset, len) {
    let end = offset + len;
    if (end > buf.length)
        end = buf.length;
    while (end > offset && buf[end - 1] === 0)
        end--;
    return buf.toString('latin1', offset, end);
}

function paddedLength(len) {
    return (len + 3) & ~3;
}

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('GLX', (err, ext) => {
        if (err)
            return callback(err);
        if (!ext.present)
            return callback(new Error('extension not available'));

        const constants = require('./glxconstants');
        for (const i in constants)
            ext[i] = constants[i];
        ext.glxAttrib = glxAttrib;
        ext.glxConst = glxConst;

        // ---- request helpers -------------------------------------------------

        // allocate a request buffer with GLX header; byteLength must be a
        // multiple of 4 and include the 4 header bytes
        function req(minor, byteLength) {
            X.seq_num++;
            const b = Buffer.alloc(byteLength);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(minor, 1);
            b.writeUInt16LE(byteLength / 4, 2);
            return b;
        }

        function send(b) {
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        // reply unpackers get the reply starting at byte 8 of the raw 32-byte
        // header: buf[0..24) = header bytes 8..32, variable data from buf[24]
        function sendWithReply(b, unpack, callback) {
            X.replies[X.seq_num] = [unpack, callback];
            send(b);
        }

        function writeAttribs(b, offset, attribs) {
            for (let i = 0; i < attribs.length; ++i)
                b.writeUInt32LE(attribs[i] >>> 0, offset + i * 4);
        }

        // ---- GLX core requests (minor opcode order) --------------------------

        // opcode 1
        ext.Render = (ctx, data) => {
            X.seq_num++;
            let length = 0;
            if (Buffer.isBuffer(data))
                length = 2 + data.length / 4;
            else if (Array.isArray(data)) {
                length = 2;
                for (let i = 0; i < data.length; ++i)
                    length += data[i].length / 4;
            } else
                throw new Error('invalid data, expected Buffer or array of Buffers');
            const hdr = Buffer.alloc(8);
            hdr.writeUInt8(ext.majorOpcode, 0);
            hdr.writeUInt8(1, 1);
            hdr.writeUInt16LE(length, 2);
            hdr.writeUInt32LE(ctx >>> 0, 4);
            X.pack_stream.put(hdr);
            if (Buffer.isBuffer(data))
                X.pack_stream.put(data);
            else
                for (let i = 0; i < data.length; ++i)
                    X.pack_stream.put(data[i]);
            X.pack_stream.flush();
        };

        // opcode 2
        ext.RenderLarge = (ctx, requestNum, requestTotal, data) => {
            const padLength = paddedLength(data.length) - data.length;
            const b = req(2, 16);
            b.writeUInt16LE(4 + (data.length + padLength) / 4, 2);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt16LE(requestNum, 8);
            b.writeUInt16LE(requestTotal, 10);
            b.writeUInt32LE(data.length >>> 0, 12);
            X.pack_stream.put(b);
            X.pack_stream.put(data);
            if (padLength)
                X.pack_stream.put(Buffer.alloc(padLength));
            X.pack_stream.flush();
        };

        // opcode 3
        ext.CreateContext = (ctx, visual, screen, shareListCtx, isDirect) => {
            const b = req(3, 24);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(visual >>> 0, 8);
            b.writeUInt32LE(screen >>> 0, 12);
            b.writeUInt32LE(shareListCtx >>> 0, 16);
            b.writeUInt8(isDirect ? 1 : 0, 20);
            send(b);
        };

        // opcode 4
        ext.DestroyContext = ctx => {
            const b = req(4, 8);
            b.writeUInt32LE(ctx >>> 0, 4);
            send(b);
        };

        // opcode 5
        ext.MakeCurrent = (drawable, ctx, oldContextTag, callback) => {
            const b = req(5, 16);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(ctx >>> 0, 8);
            b.writeUInt32LE(oldContextTag >>> 0, 12);
            sendWithReply(b, buf => buf.readUInt32LE(0), callback);
        };

        // opcode 6
        ext.IsDirect = (ctx, callback) => {
            const b = req(6, 8);
            b.writeUInt32LE(ctx >>> 0, 4);
            sendWithReply(b, buf => !!buf.readUInt8(0), callback);
        };

        // opcode 7
        ext.QueryVersion = (clientMaj, clientMin, callback) => {
            const b = req(7, 12);
            b.writeUInt32LE(clientMaj >>> 0, 4);
            b.writeUInt32LE(clientMin >>> 0, 8);
            sendWithReply(b, buf => [buf.readUInt32LE(0), buf.readUInt32LE(4)], callback);
        };

        // opcode 8
        ext.WaitGL = contextTag => {
            const b = req(8, 8);
            b.writeUInt32LE(contextTag >>> 0, 4);
            send(b);
        };

        // opcode 9
        ext.WaitX = contextTag => {
            const b = req(9, 8);
            b.writeUInt32LE(contextTag >>> 0, 4);
            send(b);
        };

        // opcode 10
        ext.CopyContext = (src, dest, mask, srcContextTag) => {
            const b = req(10, 20);
            b.writeUInt32LE(src >>> 0, 4);
            b.writeUInt32LE(dest >>> 0, 8);
            b.writeUInt32LE(mask >>> 0, 12);
            b.writeUInt32LE(srcContextTag >>> 0, 16);
            send(b);
        };

        // opcode 11
        ext.SwapBuffers = (contextTag, drawable) => {
            const b = req(11, 12);
            b.writeUInt32LE(contextTag >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            send(b);
        };

        // opcode 12
        ext.UseXFont = (contextTag, font, first, count, listBase) => {
            const b = req(12, 24);
            b.writeUInt32LE(contextTag >>> 0, 4);
            b.writeUInt32LE(font >>> 0, 8);
            b.writeUInt32LE(first >>> 0, 12);
            b.writeUInt32LE(count >>> 0, 16);
            b.writeUInt32LE(listBase >>> 0, 20);
            send(b);
        };

        // opcode 13
        ext.CreateGLXPixmap = (screen, visual, pixmap, glxpixmap) => {
            const b = req(13, 20);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(visual >>> 0, 8);
            b.writeUInt32LE(pixmap >>> 0, 12);
            b.writeUInt32LE(glxpixmap >>> 0, 16);
            send(b);
        };

        // opcode 14
        // base properties per __glXInitializeVisualConfigFromTags in
        // mesa/src/glx/glxext.c; extra properties come as (tag, value) pairs
        ext.GetVisualConfigs = (screen, callback) => {
            const b = req(14, 8);
            b.writeUInt32LE(screen >>> 0, 4);
            sendWithReply(b, buf => {
                const numConfigs = buf.readUInt32LE(0);
                const numProps = buf.readUInt32LE(4);
                const names = ('visualID visualType rgbMode redBits greenBits blueBits ' +
                    'alphaBits accumRedBits accumGreenBits accumBlueBits accumAlphaBits ' +
                    'doubleBufferMode stereoMode rgbBits depthBits stencilBits ' +
                    'numAuxBuffers level').split(' ');
                const configs = new Array(numConfigs);
                for (let i = 0; i < numConfigs; ++i) {
                    const props = {};
                    const base = 24 + i * numProps * 4;
                    const n = Math.min(18, numProps);
                    for (let j = 0; j < n; ++j)
                        props[names[j]] = buf.readUInt32LE(base + j * 4);
                    // remaining properties are (tag, value) pairs
                    for (let j = 18; j + 1 < numProps; j += 2) {
                        const tag = buf.readUInt32LE(base + j * 4);
                        if (tag === 0)
                            break;
                        props[attribNameByCode[tag] || tag] = buf.readUInt32LE(base + (j + 1) * 4);
                    }
                    configs[i] = props;
                }
                return configs;
            }, callback);
        };

        // opcode 15
        ext.DestroyGLXPixmap = glxpixmap => {
            const b = req(15, 8);
            b.writeUInt32LE(glxpixmap >>> 0, 4);
            send(b);
        };

        // opcode 16
        ext.VendorPrivate = (contextTag, code, data) => {
            const b = req(16, 12);
            b.writeUInt16LE(3 + data.length / 4, 2);
            b.writeUInt32LE(code >>> 0, 4);
            b.writeUInt32LE(contextTag >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.put(data);
            X.pack_stream.flush();
        };

        // opcode 17; callback gets {retval, size, data} where data is the
        // reply payload after the retval/size words (16 header bytes + extra)
        ext.VendorPrivateWithReply = (contextTag, code, data, callback) => {
            const b = req(17, 12);
            b.writeUInt16LE(3 + data.length / 4, 2);
            b.writeUInt32LE(code >>> 0, 4);
            b.writeUInt32LE(contextTag >>> 0, 8);
            X.replies[X.seq_num] = [
                buf => ({
                    retval: buf.readUInt32LE(0),
                    size: buf.readUInt32LE(4),
                    data: buf.slice(8)
                }),
                callback
            ];
            X.pack_stream.put(b);
            X.pack_stream.put(data);
            X.pack_stream.flush();
        };

        // opcode 18
        ext.QueryExtensionsString = (screen, callback) => {
            const b = req(18, 8);
            b.writeUInt32LE(screen >>> 0, 4);
            sendWithReply(b, buf => cstr(buf, 24, buf.readUInt32LE(4)), callback);
        };

        // opcode 19; name: GLX.glxConst.VENDOR / VERSION / EXTENSIONS
        ext.QueryServerString = (screen, name, callback) => {
            const b = req(19, 12);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(name >>> 0, 8);
            sendWithReply(b, buf => cstr(buf, 24, buf.readUInt32LE(4)), callback);
        };

        // opcode 20; glExtensions: space-separated GL extension string the
        // client supports
        ext.ClientInfo = (major, minor, glExtensions) => {
            const str = `${glExtensions || ''}\0`;
            const padded = paddedLength(str.length);
            const b = req(20, 16 + padded);
            b.writeUInt32LE(major >>> 0, 4);
            b.writeUInt32LE(minor >>> 0, 8);
            b.writeUInt32LE(str.length, 12);
            b.write(str, 16, 'latin1');
            send(b);
        };

        // opcode 21; returns array of objects keyed by GLX attribute name
        // (see GLX.glxAttrib), e.g. cfg.FBCONFIG_ID, cfg.VISUAL_ID
        ext.GetFBConfigs = (screen, callback) => {
            const b = req(21, 8);
            b.writeUInt32LE(screen >>> 0, 4);
            sendWithReply(b, buf => {
                const numConfigs = buf.readUInt32LE(0);
                const numAttribs = buf.readUInt32LE(4);
                const configs = new Array(numConfigs);
                for (let i = 0; i < numConfigs; ++i)
                    configs[i] = decodeAttribPairs(buf, 24 + i * numAttribs * 8, numAttribs);
                return configs;
            }, callback);
        };

        // opcode 22; attribs: flat [attribute, value, ...] array
        ext.CreatePixmap = (screen, fbconfig, pixmap, glxpixmap, attribs) => {
            attribs = attribs || [];
            const b = req(22, 24 + attribs.length * 4);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(fbconfig >>> 0, 8);
            b.writeUInt32LE(pixmap >>> 0, 12);
            b.writeUInt32LE(glxpixmap >>> 0, 16);
            b.writeUInt32LE(attribs.length / 2, 20);
            writeAttribs(b, 24, attribs);
            send(b);
        };

        // opcode 23
        ext.DestroyPixmap = glxpixmap => {
            const b = req(23, 8);
            b.writeUInt32LE(glxpixmap >>> 0, 4);
            send(b);
        };

        // opcode 24; renderType: GLX.glxAttrib.RGBA_TYPE or COLOR_INDEX_TYPE
        ext.CreateNewContext = (ctx, fbconfig, screen, renderType, shareListCtx, isDirect) => {
            const b = req(24, 28);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(fbconfig >>> 0, 8);
            b.writeUInt32LE(screen >>> 0, 12);
            b.writeUInt32LE(renderType >>> 0, 16);
            b.writeUInt32LE(shareListCtx >>> 0, 20);
            b.writeUInt8(isDirect ? 1 : 0, 24);
            send(b);
        };

        // opcode 25; callback gets object keyed by attribute name
        // (FBCONFIG_ID, VISUAL_ID, SCREEN, RENDER_TYPE)
        ext.QueryContext = (ctx, callback) => {
            const b = req(25, 8);
            b.writeUInt32LE(ctx >>> 0, 4);
            sendWithReply(b, buf => decodeAttribPairs(buf, 24, buf.readUInt32LE(0)), callback);
        };

        // opcode 26
        ext.MakeContextCurrent = (oldContextTag, drawable, readDrawable, ctx, callback) => {
            const b = req(26, 20);
            b.writeUInt32LE(oldContextTag >>> 0, 4);
            b.writeUInt32LE(drawable >>> 0, 8);
            b.writeUInt32LE(readDrawable >>> 0, 12);
            b.writeUInt32LE(ctx >>> 0, 16);
            sendWithReply(b, buf => buf.readUInt32LE(0), callback);
        };

        // opcode 27
        ext.CreatePbuffer = (screen, fbconfig, pbuffer, attribs) => {
            attribs = attribs || [];
            const b = req(27, 20 + attribs.length * 4);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(fbconfig >>> 0, 8);
            b.writeUInt32LE(pbuffer >>> 0, 12);
            b.writeUInt32LE(attribs.length / 2, 16);
            writeAttribs(b, 20, attribs);
            send(b);
        };

        // opcode 28
        ext.DestroyPbuffer = pbuffer => {
            const b = req(28, 8);
            b.writeUInt32LE(pbuffer >>> 0, 4);
            send(b);
        };

        // opcode 29
        ext.GetDrawableAttributes = (drawable, callback) => {
            const b = req(29, 8);
            b.writeUInt32LE(drawable >>> 0, 4);
            sendWithReply(b, buf => decodeAttribPairs(buf, 24, buf.readUInt32LE(0)), callback);
        };

        // opcode 30
        ext.ChangeDrawableAttributes = (drawable, attribs) => {
            attribs = attribs || [];
            const b = req(30, 12 + attribs.length * 4);
            b.writeUInt32LE(drawable >>> 0, 4);
            b.writeUInt32LE(attribs.length / 2, 8);
            writeAttribs(b, 12, attribs);
            send(b);
        };

        // opcode 31; glxwindow: client-allocated XID for the new GLX window
        ext.CreateWindow = (screen, fbconfig, window, glxwindow, attribs) => {
            attribs = attribs || [];
            const b = req(31, 24 + attribs.length * 4);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(fbconfig >>> 0, 8);
            b.writeUInt32LE(window >>> 0, 12);
            b.writeUInt32LE(glxwindow >>> 0, 16);
            b.writeUInt32LE(attribs.length / 2, 20);
            writeAttribs(b, 24, attribs);
            send(b);
        };

        // opcode 32
        ext.DestroyWindow = glxwindow => {
            const b = req(32, 8);
            b.writeUInt32LE(glxwindow >>> 0, 4);
            send(b);
        };

        // opcode 33 (GLX_ARB_create_context); versions: [[major, minor], ...]
        ext.SetClientInfoARB = (major, minor, versions, glExtensions, glxExtensions) => {
            const glStr = `${glExtensions || ''}\0`;
            const glxStr = `${glxExtensions || ''}\0`;
            const glPadded = paddedLength(glStr.length);
            const glxPadded = paddedLength(glxStr.length);
            const b = req(33, 24 + versions.length * 8 + glPadded + glxPadded);
            b.writeUInt32LE(major >>> 0, 4);
            b.writeUInt32LE(minor >>> 0, 8);
            b.writeUInt32LE(versions.length, 12);
            b.writeUInt32LE(glStr.length, 16);
            b.writeUInt32LE(glxStr.length, 20);
            let off = 24;
            for (const v of versions) {
                b.writeUInt32LE(v[0], off);
                b.writeUInt32LE(v[1], off + 4);
                off += 8;
            }
            b.write(glStr, off, 'latin1');
            b.write(glxStr, off + glPadded, 'latin1');
            send(b);
        };

        // opcode 34 (GLX_ARB_create_context); attribs: flat [attribute, value,
        // ...] using GLX.glxAttrib.CONTEXT_* codes
        ext.CreateContextAttribsARB = (ctx, fbconfig, screen, shareListCtx, isDirect, attribs) => {
            attribs = attribs || [];
            const b = req(34, 28 + attribs.length * 4);
            b.writeUInt32LE(ctx >>> 0, 4);
            b.writeUInt32LE(fbconfig >>> 0, 8);
            b.writeUInt32LE(screen >>> 0, 12);
            b.writeUInt32LE(shareListCtx >>> 0, 16);
            b.writeUInt8(isDirect ? 1 : 0, 20);
            b.writeUInt32LE(attribs.length / 2, 24);
            writeAttribs(b, 28, attribs);
            send(b);
        };

        // opcode 35; like SetClientInfoARB but versions are
        // [[major, minor, profileMask], ...]
        ext.SetClientInfo2ARB = (major, minor, versions, glExtensions, glxExtensions) => {
            const glStr = `${glExtensions || ''}\0`;
            const glxStr = `${glxExtensions || ''}\0`;
            const glPadded = paddedLength(glStr.length);
            const glxPadded = paddedLength(glxStr.length);
            const b = req(35, 24 + versions.length * 12 + glPadded + glxPadded);
            b.writeUInt32LE(major >>> 0, 4);
            b.writeUInt32LE(minor >>> 0, 8);
            b.writeUInt32LE(versions.length, 12);
            b.writeUInt32LE(glStr.length, 16);
            b.writeUInt32LE(glxStr.length, 20);
            let off = 24;
            for (const v of versions) {
                b.writeUInt32LE(v[0], off);
                b.writeUInt32LE(v[1], off + 4);
                b.writeUInt32LE(v[2], off + 8);
                off += 12;
            }
            b.write(glStr, off, 'latin1');
            b.write(glxStr, off + glPadded, 'latin1');
            send(b);
        };

        // ---- single GL commands (X_GLsop_*) ----------------------------------
        // All take the context *tag* returned by MakeCurrent /
        // MakeContextCurrent as first argument.

        // single request with contextTag plus `extra` CARD32 arguments
        function single(minor, contextTag, args) {
            args = args || [];
            const b = req(minor, 8 + args.length * 4);
            b.writeUInt32LE(contextTag >>> 0, 4);
            for (let i = 0; i < args.length; ++i)
                b.writeUInt32LE(args[i] >>> 0, 8 + i * 4);
            return b;
        }

        // GLXSingle replies: retval at buf[0], size at buf[4], single datum
        // at buf[8], array data from buf[24]
        function singleValueOrArray(read, itemSize) {
            return buf => {
                const n = buf.readUInt32LE(4);
                if (n === 1)
                    return read(buf, 8);
                const res = new Array(n);
                for (let i = 0; i < n; ++i)
                    res[i] = read(buf, 24 + i * itemSize);
                return res;
            };
        }

        // opcode 101
        ext.NewList = (contextTag, list, mode) => {
            send(single(101, contextTag, [list, mode]));
        };

        // opcode 102
        ext.EndList = contextTag => {
            send(single(102, contextTag));
        };

        // opcode 103
        ext.DeleteLists = (contextTag, list, range) => {
            send(single(103, contextTag, [list, range]));
        };

        // opcode 104
        ext.GenLists = (contextTag, count, callback) => {
            sendWithReply(single(104, contextTag, [count]), buf => buf.readUInt32LE(0), callback);
        };

        // opcode 105; size in feedback items, type: GL feedback type enum
        ext.FeedbackBuffer = (contextTag, size, type) => {
            send(single(105, contextTag, [size, type]));
        };

        // opcode 106
        ext.SelectBuffer = (contextTag, size) => {
            send(single(106, contextTag, [size]));
        };

        // opcode 107; callback gets {retval, newMode, data} — data holds
        // feedback/selection records generated in the previous mode
        ext.RenderMode = (contextTag, mode, callback) => {
            sendWithReply(single(107, contextTag, [mode]), buf => {
                const n = buf.readUInt32LE(4);
                const data = new Array(n);
                for (let i = 0; i < n; ++i)
                    data[i] = buf.readUInt32LE(24 + i * 4);
                return {
                    retval: buf.readUInt32LE(0),
                    newMode: buf.readUInt32LE(8),
                    data: data
                };
            }, callback);
        };

        // opcode 108
        ext.Finish = (contextTag, callback) => {
            sendWithReply(single(108, contextTag), () => undefined, callback);
        };

        // opcode 109
        ext.PixelStoref = (contextTag, pname, param) => {
            const b = single(109, contextTag, [pname]);
            b.writeFloatLE(param, 12);
            send(b);
        };

        // opcode 110
        ext.PixelStorei = (contextTag, pname, param) => {
            send(single(110, contextTag, [pname, param]));
        };

        // opcode 111; callback gets a Buffer of pixel data laid out according
        // to the current GL pack modes (set via PixelStorei)
        ext.ReadPixels = (contextTag, x, y, width, height, format, type, swapBytes, lsbFirst, callback) => {
            const b = req(111, 36);
            b.writeUInt32LE(contextTag >>> 0, 4);
            b.writeInt32LE(x, 8);
            b.writeInt32LE(y, 12);
            b.writeUInt32LE(width >>> 0, 16);
            b.writeUInt32LE(height >>> 0, 20);
            b.writeUInt32LE(format >>> 0, 24);
            b.writeUInt32LE(type >>> 0, 28);
            b.writeUInt8(swapBytes ? 1 : 0, 32);
            b.writeUInt8(lsbFirst ? 1 : 0, 33);
            sendWithReply(b, buf => buf.slice(24), callback);
        };

        // opcode 112
        ext.GetBooleanv = (contextTag, pname, callback) => {
            sendWithReply(single(112, contextTag, [pname]),
                singleValueOrArray((buf, off) => !!buf.readUInt8(off), 1), callback);
        };

        // opcode 114
        ext.GetDoublev = (contextTag, pname, callback) => {
            sendWithReply(single(114, contextTag, [pname]),
                singleValueOrArray((buf, off) => buf.readDoubleLE(off), 8), callback);
        };

        // opcode 115
        ext.GetError = (contextTag, callback) => {
            sendWithReply(single(115, contextTag), buf => buf.readUInt32LE(0), callback);
        };

        // opcode 116
        ext.GetFloatv = (contextTag, pname, callback) => {
            sendWithReply(single(116, contextTag, [pname]),
                singleValueOrArray((buf, off) => buf.readFloatLE(off), 4), callback);
        };

        // opcode 117
        ext.GetIntegerv = (contextTag, pname, callback) => {
            sendWithReply(single(117, contextTag, [pname]),
                singleValueOrArray((buf, off) => buf.readInt32LE(off), 4), callback);
        };

        // opcode 129; name: GLX.VENDOR / RENDERER / VERSION / EXTENSIONS
        // (the GL glGetString enums from glxconstants.js)
        ext.GetString = (contextTag, name, callback) => {
            sendWithReply(single(129, contextTag, [name]),
                buf => cstr(buf, 24, buf.readUInt32LE(4)), callback);
        };

        // opcode 140
        ext.IsEnabled = (contextTag, cap, callback) => {
            sendWithReply(single(140, contextTag, [cap]), buf => !!buf.readUInt32LE(0), callback);
        };

        // opcode 141
        ext.IsList = (contextTag, list, callback) => {
            sendWithReply(single(141, contextTag, [list]), buf => !!buf.readUInt32LE(0), callback);
        };

        // opcode 142
        ext.Flush = contextTag => {
            send(single(142, contextTag));
        };

        // opcode 143; callback gets {allResident, residences}
        ext.AreTexturesResident = (contextTag, textures, callback) => {
            sendWithReply(single(143, contextTag, [textures.length].concat(textures)), buf => {
                const residences = new Array(textures.length);
                for (let i = 0; i < textures.length; ++i)
                    residences[i] = !!buf.readUInt8(24 + i);
                return { allResident: !!buf.readUInt32LE(0), residences: residences };
            }, callback);
        };

        // opcode 144
        ext.DeleteTextures = (contextTag, textures) => {
            send(single(144, contextTag, [textures.length].concat(textures)));
        };

        // opcode 145
        ext.GenTextures = (contextTag, count, callback) => {
            sendWithReply(single(145, contextTag, [count]), buf => {
                const res = new Array(count);
                for (let i = 0; i < count; ++i)
                    res[i] = buf.readUInt32LE(24 + i * 4);
                return res;
            }, callback);
        };

        // opcode 146
        ext.IsTexture = (contextTag, texture, callback) => {
            sendWithReply(single(146, contextTag, [texture]), buf => !!buf.readUInt32LE(0), callback);
        };

        // ---- vendor-private extension requests -------------------------------

        // GLX_EXT_texture_from_pixmap; attribs: flat [attribute, value, ...]
        ext.BindTexImage = (contextTag, drawable, buffer, attribs) => {
            attribs = attribs || [];
            const data = Buffer.alloc(12 + attribs.length * 4);
            data.writeUInt32LE(drawable >>> 0, 0);
            data.writeUInt32LE(buffer >>> 0, 4);
            data.writeUInt32LE(attribs.length / 2, 8);
            writeAttribs(data, 12, attribs);
            ext.VendorPrivate(contextTag, vop.BindTexImageEXT, data);
        };

        ext.ReleaseTexImage = (contextTag, drawable, buffer) => {
            const data = Buffer.alloc(8);
            data.writeUInt32LE(drawable >>> 0, 0);
            data.writeUInt32LE(buffer >>> 0, 4);
            ext.VendorPrivate(contextTag, vop.ReleaseTexImageEXT, data);
        };

        // GLX_SGI_make_current_read (predates MakeContextCurrent)
        ext.MakeCurrentReadSGI = (oldContextTag, drawable, readDrawable, ctx, callback) => {
            const b = req(17, 24);
            b.writeUInt32LE(vop.MakeCurrentReadSGI, 4);
            b.writeUInt32LE(oldContextTag >>> 0, 8);
            b.writeUInt32LE(drawable >>> 0, 12);
            b.writeUInt32LE(readDrawable >>> 0, 16);
            b.writeUInt32LE(ctx >>> 0, 20);
            sendWithReply(b, buf => buf.readUInt32LE(0), callback);
        };

        // GLX_SGIX_fbconfig (predates the GLX 1.3 core requests)
        ext.GetFBConfigsSGIX = (screen, callback) => {
            const b = req(17, 16);
            b.writeUInt32LE(vop.GetFBConfigsSGIX, 4);
            b.writeUInt32LE(0, 8); // no context tag
            b.writeUInt32LE(screen >>> 0, 12);
            sendWithReply(b, buf => {
                const numConfigs = buf.readUInt32LE(0);
                const numAttribs = buf.readUInt32LE(4);
                const configs = new Array(numConfigs);
                for (let i = 0; i < numConfigs; ++i)
                    configs[i] = decodeAttribPairs(buf, 24 + i * numAttribs * 8, numAttribs);
                return configs;
            }, callback);
        };

        // note: SGIX vendor requests keep the full 12-byte VendorPrivate
        // header - byte 8 is an unused contextTag slot, payload starts at 12
        ext.CreateContextWithConfigSGIX = (ctx, fbconfig, screen, renderType, shareListCtx, isDirect) => {
            const b = req(16, 36);
            b.writeUInt32LE(vop.CreateContextWithConfigSGIX, 4);
            b.writeUInt32LE(ctx >>> 0, 12);
            b.writeUInt32LE(fbconfig >>> 0, 16);
            b.writeUInt32LE(screen >>> 0, 20);
            b.writeUInt32LE(renderType >>> 0, 24);
            b.writeUInt32LE(shareListCtx >>> 0, 28);
            b.writeUInt8(isDirect ? 1 : 0, 32);
            send(b);
        };

        ext.CreateGLXPixmapWithConfigSGIX = (screen, fbconfig, pixmap, glxpixmap) => {
            const b = req(16, 28);
            b.writeUInt32LE(vop.CreateGLXPixmapWithConfigSGIX, 4);
            b.writeUInt32LE(screen >>> 0, 12);
            b.writeUInt32LE(fbconfig >>> 0, 16);
            b.writeUInt32LE(pixmap >>> 0, 20);
            b.writeUInt32LE(glxpixmap >>> 0, 24);
            send(b);
        };

        // GLX_SGIX_pbuffer (predates the GLX 1.3 core requests)
        ext.CreateGLXPbufferSGIX = (screen, fbconfig, pbuffer, width, height, attribs) => {
            attribs = attribs || [];
            const b = req(16, 32 + attribs.length * 4);
            b.writeUInt32LE(vop.CreateGLXPbufferSGIX, 4);
            b.writeUInt32LE(screen >>> 0, 12);
            b.writeUInt32LE(fbconfig >>> 0, 16);
            b.writeUInt32LE(pbuffer >>> 0, 20);
            b.writeUInt32LE(width >>> 0, 24);
            b.writeUInt32LE(height >>> 0, 28);
            writeAttribs(b, 32, attribs);
            send(b);
        };

        ext.DestroyGLXPbufferSGIX = pbuffer => {
            const b = req(16, 16);
            b.writeUInt32LE(vop.DestroyGLXPbufferSGIX, 4);
            b.writeUInt32LE(pbuffer >>> 0, 12);
            send(b);
        };

        ext.ChangeDrawableAttributesSGIX = (drawable, attribs) => {
            attribs = attribs || [];
            const b = req(16, 20 + attribs.length * 4);
            b.writeUInt32LE(vop.ChangeDrawableAttributesSGIX, 4);
            b.writeUInt32LE(drawable >>> 0, 12);
            b.writeUInt32LE(attribs.length / 2, 16);
            writeAttribs(b, 20, attribs);
            send(b);
        };

        ext.GetDrawableAttributesSGIX = (drawable, callback) => {
            const b = req(17, 16);
            b.writeUInt32LE(vop.GetDrawableAttributesSGIX, 4);
            b.writeUInt32LE(drawable >>> 0, 12);
            sendWithReply(b, buf => decodeAttribPairs(buf, 24, buf.readUInt32LE(0)), callback);
        };

        // GLX_MESA_copy_sub_buffer
        ext.CopySubBufferMESA = (contextTag, drawable, x, y, width, height) => {
            const data = Buffer.alloc(20);
            data.writeUInt32LE(drawable >>> 0, 0);
            data.writeInt32LE(x, 4);
            data.writeInt32LE(y, 8);
            data.writeInt32LE(width, 12);
            data.writeInt32LE(height, 16);
            ext.VendorPrivate(contextTag, vop.CopySubBufferMESA, data);
        };

        // ---- render pipeline -------------------------------------------------

        ext.renderPipeline = function(ctx) {
            return require('./glxrender')(this, ctx);
        };

        // ---- errors ----------------------------------------------------------

        const errors = [
            'GLXBadContext',
            'GLXBadContextState',
            'GLXBadDrawable',
            'GLXBadPixmap',
            'GLXBadContextTag',
            'GLXBadCurrentWindow',
            'GLXBadRenderRequest',
            'GLXBadLargeRequest',
            'GLXUnsupportedPrivateRequest',
            'GLXBadFBConfig',
            'GLXBadPbuffer',
            'GLXBadCurrentDrawable',
            'GLXBadWindow'
        ];

        errors.forEach((name, code) => {
            X.errorParsers[ext.firstError + code] = err => {
                err.message = name;
            };
        });

        // ---- events ----------------------------------------------------------

        ext.events = {
            PbufferClobber: 0
        };

        X.eventParsers[ext.firstEvent + ext.events.PbufferClobber] = (type, seq, extra, code, raw) => ({
            name: 'GlxPbufferClobber',
            type: type,
            seq: seq,
            // DAMAGED (0x8020) or SAVED (0x8021)
            eventType: extra & 0xffff,
            // WINDOW (0x8022) or PBUFFER (0x8023)
            drawableType: extra >>> 16,
            drawable: raw.readUInt32LE(0),
            bufferMask: raw.readUInt32LE(4),
            auxBuffer: raw.readUInt16LE(8),
            x: raw.readUInt16LE(10),
            y: raw.readUInt16LE(12),
            width: raw.readUInt16LE(14),
            height: raw.readUInt16LE(16),
            count: raw.readUInt16LE(18)
        });

        callback(null, ext);
    });
};
