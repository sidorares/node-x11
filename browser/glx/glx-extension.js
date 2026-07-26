/*
  GLX protocol extension for the JS X server (lib/xserver/DESIGN.md
  extension framework): decodes GLX requests from this repo's own client
  (lib/ext/glx.js is the authoritative encoder) and drives a GL backend
  (gl-backend.js) through the render decoder (render-decoder.js).

  Usage:

      const ext = createGlxExtension({
          backend,             // WebGLBackend or RecordingBackend
          getDrawableSurface,  // see contract below
          visualId             // GL-capable visual advertised to clients
      });
      server.registerExtension('GLX', ext);

  Framework contract (matches lib/xserver's registerExtension, but kept
  duck-typed so the extension also runs against a minimal fake in tests):

  - `init(server, extInfo)` is called at registration; extInfo carries the
    assigned `majorOpcode` / `firstEvent` / `firstError` (they are adopted
    onto this object). The server's advertised GL visual defaults to
    `server.rootVisual` unless options.visualId is given.
  - `handleRequest(server, client, minor, body)` is called per request
    (the 3-argument form `handleRequest(client, minor, body)` also works
    for harnesses without a server object); `body` = the request Buffer
    after its 4-byte header. Replies use, in order of preference:
      client.sendReply(data)
          minimal-harness hook: data is a Buffer holding the reply from
          wire byte 8 onwards (24 fixed bytes + extra, padded to 4).
      client.startReply(extraWords, detail) + client.send(buf)
          the lib/xserver ClientState API: the payload is copied to
          offset 8 of the prebuilt reply buffer.
    Errors use client.sendError(code, badValue, majorOpcode, minor) with
    code = firstError + offset (a 3-argument sendError fake also works:
    extra arguments are simply ignored by it).

  Presentation-layer contract (the `getDrawableSurface` option):

      getDrawableSurface(drawableXid) -> {
          width, height,        // current drawable size in pixels
          notifySwap(pixels),   // called on SwapBuffers; pixels is a
                                //   Uint32Array (top-down rows, 0x00RRGGBB,
                                //   the JS X server raster format) unless
                                //   wantsPixels === false, then null and
                                //   the presentation layer composites the
                                //   backend's WebGL canvas directly
          wantsPixels           // optional, default true
      } | null

  GLX pbuffers get an internal surface (no presentation); GLX windows and
  GLX pixmaps resolve through getDrawableSurface via their underlying X
  drawable id.

  Coverage: GLX 1.4 core requests plus the vendor-private requests the
  client encodes (SGI make_current_read, SGIX fbconfig/pbuffer,
  EXT_texture_from_pixmap accepted as no-ops, MESA copy_sub_buffer).
  Unknown requests are ignored (never crash, never desync).
*/

const { RecordingBackend } = require('./gl-backend');
const { RenderDecoder } = require('./render-decoder');

// GLX error code offsets (added to firstError)
const errorCodes = {
    GLXBadContext: 0,
    GLXBadContextState: 1,
    GLXBadDrawable: 2,
    GLXBadPixmap: 3,
    GLXBadContextTag: 4,
    GLXBadCurrentWindow: 5,
    GLXBadRenderRequest: 6,
    GLXBadLargeRequest: 7,
    GLXUnsupportedPrivateRequest: 8,
    GLXBadFBConfig: 9,
    GLXBadPbuffer: 10,
    GLXBadCurrentDrawable: 11,
    GLXBadWindow: 12
};

// vendor-private opcodes (X_GLXvop_*, mirror of lib/ext/glx.js)
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

// GL / GLX enums used in replies
const GL_RENDER = 0x1C00;
const GL_VENDOR = 0x1F00;
const GL_RENDERER = 0x1F01;
const GL_VERSION = 0x1F02;
const GL_EXTENSIONS = 0x1F03;
const GLX_VENDOR = 1;
const GLX_VERSION = 2;
const GLX_EXTENSIONS = 3;
const GL_PACK_ALIGNMENT = 0x0D05;
const GL_UNPACK_ALIGNMENT = 0x0CF5;

const FBCONFIG_ID = 1; // the single advertised fbconfig

const SERVER_VENDOR = 'node-x11';
const SERVER_VERSION = '1.4';
const SERVER_GLX_EXTENSIONS = [
    'GLX_ARB_create_context',
    'GLX_EXT_visual_info',
    'GLX_MESA_copy_sub_buffer',
    'GLX_SGI_make_current_read',
    'GLX_SGIX_fbconfig',
    'GLX_SGIX_pbuffer'
].join(' ');

function pad4(n) {
    return (n + 3) & ~3;
}

function createGlxExtension(options = {}) {
    const backend = options.backend || new RecordingBackend();
    const getDrawableSurface = options.getDrawableSurface || (() => null);
    let visualId = options.visualId || 0x21;

    let nextTag = 1;
    const contexts = new Map();     // context xid -> { xid, decoder, pixelStore }
    const tags = new Map();         // context tag -> { context, drawable, read }
    const glxDrawables = new Map(); // glx xid -> { kind, target?, surface? }
    const texturesAllocated = new Set();
    let nextTexture = 1;

    // ---- reply builders --------------------------------------------------

    // reply payload from wire byte 8: 24 fixed bytes + extra
    function mk(extra = 0) {
        return Buffer.alloc(24 + pad4(extra));
    }

    // deliver a reply payload through whichever API the client offers
    function deliver(client, data) {
        if (typeof client.sendReply === 'function')
            return client.sendReply(data);
        const b = client.startReply((data.length - 24) / 4, 0);
        data.copy(b, 8);
        client.send(b);
    }

    function emptyReply(client) {
        deliver(client, mk());
    }

    function u32Reply(client, value) {
        const d = mk();
        d.writeUInt32LE(value >>> 0, 0);
        return deliver(client, d);
    }

    // string replies (QueryServerString / QueryExtensionsString / GetString):
    // length (incl. NUL) at payload byte 4, string bytes from 24
    function stringReply(client, s) {
        const len = s.length + 1;
        const d = mk(len);
        d.writeUInt32LE(len, 4);
        d.write(s, 24, 'latin1');
        deliver(client, d);
    }

    // GetBooleanv/GetIntegerv/GetFloatv/GetDoublev: n at byte 4; a single
    // value sits at byte 8, arrays start at byte 24
    function valuesReply(client, values, writeItem, itemSize) {
        if (!values || values.length === 0)
            return emptyReply(client);
        if (values.length === 1) {
            const d = mk();
            d.writeUInt32LE(1, 4);
            writeItem(d, 8, values[0]);
            return deliver(client, d);
        }
        const d = mk(values.length * itemSize);
        d.writeUInt32LE(values.length, 4);
        for (let i = 0; i < values.length; ++i)
            writeItem(d, 24 + i * itemSize, values[i]);
        deliver(client, d);
    }

    // (attribute, value) pair replies: count at byte 0, pairs from byte 24
    function attribPairsReply(client, pairs) {
        const d = mk(pairs.length * 8);
        d.writeUInt32LE(pairs.length, 0);
        for (let i = 0; i < pairs.length; ++i) {
            d.writeUInt32LE(pairs[i][0] >>> 0, 24 + i * 8);
            d.writeUInt32LE(pairs[i][1] >>> 0, 24 + i * 8 + 4);
        }
        deliver(client, d);
    }

    function sendError(client, name, value, minor) {
        if (typeof client.sendError === 'function')
            client.sendError(ext.firstError + errorCodes[name], value >>> 0,
                ext.majorOpcode, minor);
    }

    // ---- bookkeeping helpers ---------------------------------------------

    function registerContext(xid) {
        contexts.set(xid, {
            xid: xid,
            decoder: new RenderDecoder(backend),
            pixelStore: { packAlignment: 4, unpackAlignment: 4 }
        });
    }

    function resolveSurface(xid) {
        const d = glxDrawables.get(xid);
        if (d) {
            if (d.kind === 'pbuffer')
                return d.surface;
            return getDrawableSurface(d.target) || null;
        }
        return getDrawableSurface(xid) || null;
    }

    function makeCurrent(client, minor, ctxXid, drawXid, readXid, oldTag) {
        if (oldTag)
            tags.delete(oldTag);
        if (!ctxXid)
            return u32Reply(client, 0);
        const context = contexts.get(ctxXid);
        if (!context)
            return sendError(client, 'GLXBadContext', ctxXid, minor);
        const surface = resolveSurface(drawXid);
        if (surface)
            backend.resize(surface.width, surface.height);
        const tag = nextTag++;
        tags.set(tag, { context: context, drawable: drawXid, read: readXid || drawXid });
        u32Reply(client, tag);
    }

    function swapBuffers(drawXid) {
        backend.finish();
        const surface = resolveSurface(drawXid);
        if (!surface || typeof surface.notifySwap !== 'function')
            return;
        const pixels = surface.wantsPixels === false
            ? null
            : backend.readPixelsUint32(surface.width, surface.height);
        surface.notifySwap(pixels);
    }

    function fbconfigPairs() {
        // GLX attribute codes inline (see glxAttrib in lib/ext/glx.js)
        return [
            [0x8013, FBCONFIG_ID],      // FBCONFIG_ID
            [0x800B, visualId],         // VISUAL_ID
            [1, 1],                     // USE_GL
            [2, 32],                    // BUFFER_SIZE
            [3, 0],                     // LEVEL
            [4, 1],                     // RGBA
            [5, 1],                     // DOUBLEBUFFER
            [6, 0],                     // STEREO
            [7, 0],                     // AUX_BUFFERS
            [8, 8],                     // RED_SIZE
            [9, 8],                     // GREEN_SIZE
            [10, 8],                    // BLUE_SIZE
            [11, 8],                    // ALPHA_SIZE
            [12, 24],                   // DEPTH_SIZE
            [13, 8],                    // STENCIL_SIZE
            [14, 0], [15, 0], [16, 0], [17, 0], // ACCUM_*_SIZE
            [0x20, 0x8000],             // CONFIG_CAVEAT = NONE
            [0x22, 0x8002],             // X_VISUAL_TYPE = TRUE_COLOR
            [0x8010, 0x7],              // DRAWABLE_TYPE = WINDOW|PIXMAP|PBUFFER
            [0x8011, 0x1],              // RENDER_TYPE = RGBA_BIT
            [0x8012, 1],                // X_RENDERABLE
            [0x8016, 4096],             // MAX_PBUFFER_WIDTH
            [0x8017, 4096],             // MAX_PBUFFER_HEIGHT
            [0x8018, 4096 * 4096],      // MAX_PBUFFER_PIXELS
            [100000, 0],                // SAMPLE_BUFFERS
            [100001, 0]                 // SAMPLES
        ];
    }

    function fbconfigsReply(client) {
        const pairs = fbconfigPairs();
        const d = mk(pairs.length * 8);
        d.writeUInt32LE(1, 0);              // numConfigs
        d.writeUInt32LE(pairs.length, 4);   // numAttribs (pairs per config)
        for (let i = 0; i < pairs.length; ++i) {
            d.writeUInt32LE(pairs[i][0] >>> 0, 24 + i * 8);
            d.writeUInt32LE(pairs[i][1] >>> 0, 24 + i * 8 + 4);
        }
        deliver(client, d);
    }

    function visualConfigsReply(client) {
        // 18 base properties per config, order per
        // __glXInitializeVisualConfigFromTags (see lib/ext/glx.js unpacker)
        const props = [
            visualId,   // visualID
            4,          // visualType (X TrueColor class)
            1,          // rgbMode
            8, 8, 8, 8, // red/green/blue/alpha bits
            0, 0, 0, 0, // accum red/green/blue/alpha bits
            1,          // doubleBufferMode
            0,          // stereoMode
            32,         // rgbBits (buffer size)
            24,         // depthBits
            8,          // stencilBits
            0,          // numAuxBuffers
            0           // level
        ];
        const d = mk(props.length * 4);
        d.writeUInt32LE(1, 0);              // numVisuals
        d.writeUInt32LE(props.length, 4);   // numProps
        for (let i = 0; i < props.length; ++i)
            d.writeUInt32LE(props[i] >>> 0, 24 + i * 4);
        deliver(client, d);
    }

    function tagEntry(tag) {
        return tags.get(tag) || null;
    }

    function decoderForTag(tag) {
        const t = tagEntry(tag);
        return t ? t.context.decoder : null;
    }

    function queryParameter(pname) {
        const fromBackend = typeof backend.getParameter === 'function'
            ? backend.getParameter(pname) : null;
        if (fromBackend)
            return Array.isArray(fromBackend) ? fromBackend : [fromBackend];
        return null;
    }

    function serverString(name) {
        const s = typeof backend.getString === 'function' ? backend.getString(name) : null;
        if (s)
            return s;
        switch (name) {
        case GL_VENDOR: return SERVER_VENDOR;
        case GL_RENDERER: return 'node-x11 glx-emu';
        case GL_VERSION: return '1.4 node-x11 glx-emu';
        case GL_EXTENSIONS: return '';
        }
        return '';
    }

    // ---- vendor-private dispatch -----------------------------------------

    // minor 16 (VendorPrivate, no reply); body: code@0, then per-vop layout.
    // The generic form carries contextTag@4 and data from 8; the SGIX
    // requests keep that 12-byte header shape with payload from body 8.
    function vendorPrivate(client, body) {
        const code = body.readUInt32LE(0);
        switch (code) {
        case vop.CreateContextWithConfigSGIX:
            registerContext(body.readUInt32LE(8));
            break;
        case vop.CreateGLXPixmapWithConfigSGIX:
            glxDrawables.set(body.readUInt32LE(20), {
                kind: 'pixmap',
                target: body.readUInt32LE(16)
            });
            break;
        case vop.CreateGLXPbufferSGIX:
            createPbuffer(body.readUInt32LE(16),
                body.readUInt32LE(20), body.readUInt32LE(24));
            break;
        case vop.DestroyGLXPbufferSGIX:
            glxDrawables.delete(body.readUInt32LE(8));
            break;
        case vop.CopySubBufferMESA:
            // partial swap approximated by a full present
            swapBuffers(body.readUInt32LE(8));
            break;
        case vop.BindTexImageEXT:
        case vop.ReleaseTexImageEXT:
        case vop.ChangeDrawableAttributesSGIX:
            break; // accepted
        default:
            break; // no reply expected: ignore unknown vendor requests
        }
    }

    // minor 17 (VendorPrivateWithReply); body: code@0, payload per vop
    function vendorPrivateWithReply(client, body) {
        const code = body.readUInt32LE(0);
        switch (code) {
        case vop.MakeCurrentReadSGI:
            return makeCurrent(client, 17,
                body.readUInt32LE(16),  // context
                body.readUInt32LE(8),   // drawable
                body.readUInt32LE(12),  // read drawable
                body.readUInt32LE(4));  // old context tag
        case vop.GetFBConfigsSGIX:
            return fbconfigsReply(client);
        case vop.GetDrawableAttributesSGIX:
            return drawableAttributesReply(client, body.readUInt32LE(8));
        default:
            return sendError(client, 'GLXUnsupportedPrivateRequest', code, 17);
        }
    }

    function createPbuffer(pbufferXid, width, height) {
        glxDrawables.set(pbufferXid, {
            kind: 'pbuffer',
            surface: {
                width: width || 1,
                height: height || 1,
                wantsPixels: false,
                notifySwap() {}
            }
        });
    }

    function drawableAttributesReply(client, drawableXid) {
        const surface = resolveSurface(drawableXid);
        const width = surface ? surface.width : 0;
        const height = surface ? surface.height : 0;
        attribPairsReply(client, [
            [0x801D, width],        // WIDTH
            [0x801E, height],       // HEIGHT
            [0x801B, 1],            // PRESERVED_CONTENTS
            [0x801C, 0],            // LARGEST_PBUFFER
            [0x8013, FBCONFIG_ID]   // FBCONFIG_ID
        ]);
    }

    function readAttribPairs(body, offset, count) {
        const out = {};
        for (let i = 0; i < count; ++i)
            out[body.readUInt32LE(offset + i * 8)] =
                body.readUInt32LE(offset + i * 8 + 4);
        return out;
    }

    // ---- request dispatch ------------------------------------------------

    function handle(client, minor, body) {
        switch (minor) {

        case 1: {   // Render: contextTag, command stream
            const decoder = decoderForTag(body.readUInt32LE(0));
            if (!decoder)
                return sendError(client, 'GLXBadContextTag', body.readUInt32LE(0), minor);
            return decoder.decode(body.slice(4));
        }

        case 2: {   // RenderLarge: contextTag, requestNum, requestTotal, data
            const decoder = decoderForTag(body.readUInt32LE(0));
            if (!decoder)
                return sendError(client, 'GLXBadContextTag', body.readUInt32LE(0), minor);
            const dataLen = body.readUInt32LE(8);
            return decoder.renderLarge(body.readUInt16LE(4), body.readUInt16LE(6),
                body.slice(12, 12 + dataLen));
        }

        case 3:     // CreateContext: ctx, visual, screen, shareList, isDirect
            return registerContext(body.readUInt32LE(0));

        case 4:     // DestroyContext
            return contexts.delete(body.readUInt32LE(0));

        case 5:     // MakeCurrent: drawable, context, oldContextTag -> tag
            return makeCurrent(client, minor, body.readUInt32LE(4),
                body.readUInt32LE(0), 0, body.readUInt32LE(8));

        case 6:     // IsDirect -> false (this is the indirect emulator)
            return deliver(client, mk());

        case 7: {   // QueryVersion -> 1.4
            const d = mk();
            d.writeUInt32LE(1, 0);
            d.writeUInt32LE(4, 4);
            return deliver(client, d);
        }

        case 8:     // WaitGL
        case 9:     // WaitX
        case 10:    // CopyContext (single shared state machine: no-op)
            return;

        case 11:    // SwapBuffers: contextTag, drawable
            return swapBuffers(body.readUInt32LE(4));

        case 12:    // UseXFont: not supported, accepted
            return;

        case 13:    // CreateGLXPixmap: screen, visual, pixmap, glxpixmap
            return glxDrawables.set(body.readUInt32LE(12), {
                kind: 'pixmap',
                target: body.readUInt32LE(8)
            });

        case 14:    // GetVisualConfigs
            return visualConfigsReply(client);

        case 15:    // DestroyGLXPixmap
        case 23:    // DestroyPixmap
        case 28:    // DestroyPbuffer
        case 32:    // DestroyWindow
            return glxDrawables.delete(body.readUInt32LE(0));

        case 16:    // VendorPrivate
            return vendorPrivate(client, body);

        case 17:    // VendorPrivateWithReply
            return vendorPrivateWithReply(client, body);

        case 18:    // QueryExtensionsString
            return stringReply(client, SERVER_GLX_EXTENSIONS);

        case 19:    // QueryServerString: screen, name
            switch (body.readUInt32LE(4)) {
            case GLX_VENDOR: return stringReply(client, SERVER_VENDOR);
            case GLX_VERSION: return stringReply(client, SERVER_VERSION);
            case GLX_EXTENSIONS: return stringReply(client, SERVER_GLX_EXTENSIONS);
            default: return stringReply(client, '');
            }

        case 20:    // ClientInfo
        case 33:    // SetClientInfoARB
        case 35:    // SetClientInfo2ARB
            return; // accepted

        case 21:    // GetFBConfigs
            return fbconfigsReply(client);

        case 22:    // CreatePixmap (GLX 1.3): screen, fbconfig, pixmap, glxpixmap
            return glxDrawables.set(body.readUInt32LE(12), {
                kind: 'pixmap',
                target: body.readUInt32LE(8)
            });

        case 24:    // CreateNewContext: ctx, fbconfig, screen, renderType, ...
            return registerContext(body.readUInt32LE(0));

        case 25:    // QueryContext -> attribute pairs
            return attribPairsReply(client, [
                [0x8013, FBCONFIG_ID],  // FBCONFIG_ID
                [0x800B, visualId],     // VISUAL_ID
                [0x800C, 0],            // SCREEN
                [0x8011, 0x8014]        // RENDER_TYPE = RGBA_TYPE
            ]);

        case 26:    // MakeContextCurrent: oldTag, drawable, readDrawable, ctx
            return makeCurrent(client, minor, body.readUInt32LE(12),
                body.readUInt32LE(4), body.readUInt32LE(8), body.readUInt32LE(0));

        case 27: {  // CreatePbuffer: screen, fbconfig, pbuffer, nAttribs, pairs
            const attribs = readAttribPairs(body, 16, body.readUInt32LE(12));
            // PBUFFER_WIDTH 0x8041, PBUFFER_HEIGHT 0x8040 (also accept the
            // WIDTH/HEIGHT query codes some clients use)
            return createPbuffer(body.readUInt32LE(8),
                attribs[0x8041] || attribs[0x801D] || 0,
                attribs[0x8040] || attribs[0x801E] || 0);
        }

        case 29:    // GetDrawableAttributes
            return drawableAttributesReply(client, body.readUInt32LE(0));

        case 30:    // ChangeDrawableAttributes
            return; // accepted

        case 31:    // CreateWindow (GLX 1.3): screen, fbconfig, window, glxwindow
            return glxDrawables.set(body.readUInt32LE(12), {
                kind: 'window',
                target: body.readUInt32LE(8)
            });

        case 34:    // CreateContextAttribsARB
            return registerContext(body.readUInt32LE(0));

        // ---- GL single requests (contextTag at body 0, args from 4) ------

        case 101: { // NewList: list, mode
            const decoder = decoderForTag(body.readUInt32LE(0));
            if (decoder)
                decoder.newList(body.readUInt32LE(4), body.readUInt32LE(8));
            return;
        }

        case 102: { // EndList
            const decoder = decoderForTag(body.readUInt32LE(0));
            if (decoder)
                decoder.endList();
            return;
        }

        case 103: { // DeleteLists: list, range
            const decoder = decoderForTag(body.readUInt32LE(0));
            if (decoder)
                decoder.deleteLists(body.readUInt32LE(4), body.readUInt32LE(8));
            return;
        }

        case 104: { // GenLists: count -> first list id
            const decoder = decoderForTag(body.readUInt32LE(0));
            return u32Reply(client, decoder ? decoder.genLists(body.readUInt32LE(4)) : 0);
        }

        case 105:   // FeedbackBuffer
        case 106:   // SelectBuffer
            return; // accepted; RenderMode never leaves GL_RENDER

        case 107: { // RenderMode: mode -> { retval, n=0, newMode }
            const d = mk();
            d.writeUInt32LE(GL_RENDER, 0);      // retval: previous mode
            d.writeUInt32LE(0, 4);              // no feedback/selection data
            d.writeUInt32LE(body.readUInt32LE(4), 8); // newMode echoed
            return deliver(client, d);
        }

        case 108:   // Finish (replies to sync)
            backend.finish();
            return emptyReply(client);

        case 109: { // PixelStoref: pname, float param
            const t = tagEntry(body.readUInt32LE(0));
            return t && trackPixelStore(t.context, body.readUInt32LE(4),
                body.readFloatLE(8));
        }

        case 110: { // PixelStorei: pname, param
            const t = tagEntry(body.readUInt32LE(0));
            return t && trackPixelStore(t.context, body.readUInt32LE(4),
                body.readUInt32LE(8));
        }

        case 111: { // ReadPixels: x, y, w, h, format, type, swapBytes, lsbFirst
            const t = tagEntry(body.readUInt32LE(0));
            const pack = { alignment: t ? t.context.pixelStore.packAlignment : 4 };
            const pixels = backend.readPixels(
                body.readInt32LE(4), body.readInt32LE(8),
                body.readUInt32LE(12), body.readUInt32LE(16),
                body.readUInt32LE(20), body.readUInt32LE(24), pack);
            const d = mk(pixels.length);
            d.writeUInt32LE(Math.ceil(pixels.length / 4), 4);
            pixels.copy ? pixels.copy(d, 24) : d.set(pixels, 24);
            return deliver(client, d);
        }

        case 112:   // GetBooleanv
            return valuesReply(client, queryParameter(body.readUInt32LE(4)),
                (d, o, v) => d.writeUInt8(v ? 1 : 0, o), 1);

        case 114:   // GetDoublev
            return valuesReply(client, queryParameter(body.readUInt32LE(4)),
                (d, o, v) => d.writeDoubleLE(v, o), 8);

        case 115:   // GetError -> NO_ERROR
            return u32Reply(client, 0);

        case 116:   // GetFloatv
            return valuesReply(client, queryParameter(body.readUInt32LE(4)),
                (d, o, v) => d.writeFloatLE(v, o), 4);

        case 117:   // GetIntegerv
            return valuesReply(client, queryParameter(body.readUInt32LE(4)),
                (d, o, v) => d.writeInt32LE(v | 0, o), 4);

        case 129:   // GetString
            return stringReply(client, serverString(body.readUInt32LE(4)));

        case 140:   // IsEnabled
            return u32Reply(client,
                backend.isEnabled(body.readUInt32LE(4)) ? 1 : 0);

        case 141: { // IsList
            const decoder = decoderForTag(body.readUInt32LE(0));
            return u32Reply(client,
                decoder && decoder.isList(body.readUInt32LE(4)) ? 1 : 0);
        }

        case 142:   // Flush
            return backend.flush();

        case 143: { // AreTexturesResident: n, textures -> all resident
            const n = body.readUInt32LE(4);
            const d = mk(n);
            d.writeUInt32LE(1, 0);
            for (let i = 0; i < n; ++i)
                d.writeUInt8(1, 24 + i);
            return deliver(client, d);
        }

        case 144: { // DeleteTextures: n, ids
            const n = body.readUInt32LE(4);
            const ids = [];
            for (let i = 0; i < n; ++i) {
                const id = body.readUInt32LE(8 + i * 4);
                ids.push(id);
                texturesAllocated.delete(id);
            }
            return backend.deleteTextures(ids);
        }

        case 145: { // GenTextures: count -> ids
            const n = body.readUInt32LE(4);
            const d = mk(n * 4);
            for (let i = 0; i < n; ++i) {
                const id = nextTexture++;
                texturesAllocated.add(id);
                d.writeUInt32LE(id, 24 + i * 4);
            }
            return deliver(client, d);
        }

        case 146:   // IsTexture
            return u32Reply(client,
                texturesAllocated.has(body.readUInt32LE(4)) ? 1 : 0);

        default:
            return; // unimplemented minor: ignore (no reply expected paths)
        }
    }

    function trackPixelStore(context, pname, value) {
        if (pname === GL_PACK_ALIGNMENT)
            context.pixelStore.packAlignment = value || 4;
        else if (pname === GL_UNPACK_ALIGNMENT)
            context.pixelStore.unpackAlignment = value || 4;
    }

    const ext = {
        name: 'GLX',
        eventsCount: 1,     // PbufferClobber
        errorsCount: 13,    // GLXBadContext .. GLXBadWindow
        majorOpcode: 0,     // assigned by the extension framework
        firstEvent: 0,
        firstError: 0,
        backend: backend,

        init(server, extInfo) {
            this.server = server;
            // adopt the codes the framework assigned at registration
            if (extInfo) {
                this.majorOpcode = extInfo.majorOpcode || this.majorOpcode;
                this.firstEvent = extInfo.firstEvent || this.firstEvent;
                this.firstError = extInfo.firstError || this.firstError;
            }
            // advertise the server's GL-capable visual unless configured
            if (!options.visualId && server && server.rootVisual)
                visualId = server.rootVisual;
        },

        // real framework: (server, client, minor, body);
        // minimal harnesses may call (client, minor, body)
        handleRequest(a, b, c, d) {
            const client = d === undefined ? a : b;
            const minor = d === undefined ? b : c;
            const body = d === undefined ? c : d;
            try {
                handle(client, minor, body);
            } catch (e) {
                // never crash the server on malformed GLX input
                this.lastInternalError = e;
                sendError(client, 'GLXBadRenderRequest', 0, minor);
            }
        },

        // exposed for tests / presentation layer
        _contexts: contexts,
        _tags: tags,
        _drawables: glxDrawables
    };

    return ext;
}

module.exports = { createGlxExtension };
