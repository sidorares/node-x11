# GLX extension

OpenGL rendering over the X protocol (indirect rendering). The module covers
the full GLX 1.4 core request set (context, drawable and pbuffer management,
single-op GL queries, `Render`/`RenderLarge` command batching), the
`GLX_ARB_create_context` requests, and the vendor-private requests of the
extensions advertised by XQuartz and Xvfb servers (`GLX_SGI_make_current_read`,
`GLX_SGIX_fbconfig`, `GLX_SGIX_pbuffer`, `GLX_EXT_texture_from_pixmap`,
`GLX_MESA_copy_sub_buffer`). A GL command serializer is provided by
[`lib/ext/glxrender.js`](../../lib/ext/glxrender.js) via
`GLX.renderPipeline(contextTag)`.

- Module: `X.require('glx', cb)` (X name `GLX`)
- Source: [`lib/ext/glx.js`](../../lib/ext/glx.js) ·
  Render pipeline: [`lib/ext/glxrender.js`](../../lib/ext/glxrender.js) ·
  Constants: [`lib/ext/glxconstants.js`](../../lib/ext/glxconstants.js) ·
  Examples: [`examples/opengl/`](../../examples/opengl/)
- Spec: [GLX protocol PDF](https://registry.khronos.org/OpenGL/specs/gl/glxproto.pdf),
  `GL/glxproto.h` (canonical encodings, ships with XQuartz/x11proto),
  [glx.xml (xcb proto)](https://gitlab.freedesktop.org/xorg/proto/xcbproto/-/blob/master/src/glx.xml)

## Server setup: indirect GLX must be enabled

Everything this module does is *indirect* rendering: GL commands travel over
the X connection. Modern X servers (Xorg ≥ 1.17, XQuartz, Xvfb) ship with
indirect GLX contexts **disabled**; `CreateContext` then fails with
`Bad param value` (BadValue, value 0) and every context operation after it
fails with `GLXBadContext`. Query requests (`QueryVersion`, `GetFBConfigs`,
...) work regardless.

- **XQuartz (macOS)**:

  ```sh
  defaults write org.xquartz.X11 enable_iglx -bool true
  ```

  then restart XQuartz (quit it; it relaunches on the next client
  connection). Verify the running server has `+iglx` on its command line:
  `pgrep -fl Xquartz` → `... Xquartz :0 -nolisten tcp +iglx +extension GLX`.
  (`-iglx`, the default, *disables* indirect GLX.)

- **Xvfb** (used by the test suite) and **Xorg**: add `+iglx` to the command
  line, e.g. `Xvfb :99 -nolisten tcp +iglx`. `scripts/test-local.sh` and CI
  already do this. On Xorg, `Option "AllowIndirectGLX" "on"` in the config
  works too.

One more server-support caveat: on current **Linux** distro X servers
(debian bookworm, ubuntu 24.04) indirect contexts are *accepted* but the GL
engine behind them is gone — `GetString` returns empty strings, state
queries return zeros and nothing rasterizes (`glxinfo -i` shows the same).
Ubuntu 24.04's Xvfb even segfaults on indirect `MakeCurrent`, which is why
CI runs the suite in a debian bookworm container. **XQuartz (and its
bundled Xvfb) still ships a fully working indirect GL path** — macOS is
currently the best place to actually run the rendering examples. The test
suite detects a GL-less server and skips execution-dependent tests.

XQuartz quirks worth knowing:

- `MakeCurrent` must happen **after the window is actually mapped**: wait
  for `MapNotify` (plus a small delay) before creating/binding the context,
  otherwise the context binds a zero-sized drawable and renders nowhere.
  Pbuffers don't have this problem.
- GL output is composited at the Quartz layer: `GetImage` on the window
  returns black even when rendering works. Use `ReadPixels` (reads the GL
  buffer) or a native macOS screenshot to verify output.
- XQuartz's Xvfb has a full Mesa software GLX; `/opt/X11/bin/glxinfo`
  against it may still report "couldn't find RGB GLX visual or fbconfig"
  (client-side library mismatch) even though the protocol works fine.

```js
X.require('glx', (err, GLX) => {
    GLX.GetVisualConfigs(0, (err, configs) => {
        const cfg = configs.find(c => c.rgbMode && c.doubleBufferMode);
        // ... create colormap + window with cfg.visualID, wait for MapNotify ...
        const ctx = X.AllocID();
        GLX.CreateContext(ctx, cfg.visualID, 0, 0, 0);
        GLX.MakeCurrent(win, ctx, 0, (err, tag) => {
            const gl = GLX.renderPipeline(tag);
            gl.ClearColor(0, 0, 0, 1);
            gl.Clear(gl.COLOR_BUFFER_BIT);
            gl.Begin(gl.TRIANGLES);
            gl.Color3f(1, 0, 0); gl.Vertex3f(0, 1, 0);
            gl.Color3f(0, 1, 0); gl.Vertex3f(-1, -1, 0);
            gl.Color3f(0, 0, 1); gl.Vertex3f(1, -1, 0);
            gl.End();
            gl.Render();          // flush the batch
            gl.SwapBuffers(win);
        });
    });
});
```

Complete example programs in [`examples/opengl/`](../../examples/opengl/):

- `triangle.js` — minimal: visual selection, context, one frame
- `glxgears.js` — display lists, lighting, animation (port of the classic)
- `teapot.js` — mesh viewer: the Utah teapot (or `node teapot.js bunny` for
  the Stanford bunny) loaded from the public-domain `teapot`/`bunny` npm
  packages (devDependencies), with computed smooth normals and a
  display-list compiled mesh
- `reflection-shadow.js` — stencil-buffer planar reflection, projected
  planar shadow, sphere-map environment mapping (TexGen), and a dynamic
  texture re-uploaded every frame with `TexImage2D`
- `pbuffer-interop.js` — GLX/core-X interop: an off-screen pbuffer renders,
  `ReadPixels` pulls the frame back, and core `PutImage` displays it in an
  ordinary non-GL window (works with any visual, no GLX drawable attached
  to the visible window)

Note on shaders: there is no GLSL (and on current servers no ARB
vertex/fragment program) support over indirect GLX — the GL extension
string exposed to indirect contexts is nearly empty. Fixed-function GL 1.4
(display lists, lighting, texturing, TexGen, stencil, blending) is the
practical feature set, which is what the examples above use.

## Contexts vs. context tags

Two different identifiers appear below:

- `ctx` — a GLX context **XID**, allocated with `X.AllocID()` and created
  with `CreateContext` / `CreateNewContext` / `CreateContextAttribsARB`.
  Used by `DestroyContext`, `IsDirect`, `QueryContext`, `CopyContext`.
- `contextTag` — the server-assigned tag returned by `MakeCurrent` /
  `MakeContextCurrent`, identifying the *current* context. All GL commands
  (`Render`, `RenderLarge`, the single ops `NewList` ... `IsTexture`,
  `SwapBuffers`) take the tag.

When switching to another context, pass the tag of the currently bound
context as `oldContextTag` — passing 0 while a context is current raises
`GLXBadContext`.

## Attribute lists

Requests that take an `attribs` argument expect a flat
`[attribute, value, attribute, value, ...]` array of numeric codes; the GLX
attribute codes are exposed as `GLX.glxAttrib` (name → code, e.g.
`GLX.glxAttrib.PBUFFER_WIDTH`) and related enum/bitmask values as
`GLX.glxConst`. Replies carrying attribute lists (`GetFBConfigs`,
`QueryContext`, `GetDrawableAttributes`) are decoded into objects keyed by
attribute name (`{FBCONFIG_ID: 187, DOUBLEBUFFER: 1, ...}`; unknown
attributes keep their numeric code as key).

## Requests (GLX core, minor opcode order)

### Render(contextTag, data)
Opcode 1. Sends a batch of serialized GL commands. `data` is a Buffer or an
array of Buffers, each holding GL render commands (2-byte length, 2-byte
opcode, payload; lengths multiples of 4). No reply. Normally used through
`renderPipeline`.

### RenderLarge(contextTag, requestNum, requestTotal, data)
Opcode 2. One GL command too big for `Render`, split into `requestTotal`
parts; `requestNum` is 1-based. `data` is padded to 4 bytes automatically.
No reply. Used internally by the pipeline's `TexImage2D`.

### CreateContext(ctx, visual, screen, shareListCtx, isDirect)
Opcode 3. Creates GLX context `ctx` (client-allocated XID) for `visual`.
`shareListCtx` shares display lists (0 for none); pass `isDirect` 0 — this
client renders indirectly. No reply.

### DestroyContext(ctx)
Opcode 4. No reply.

### MakeCurrent(drawable, ctx, oldContextTag, cb)
Opcode 5. Binds `ctx` to `drawable` (window or GLX pixmap).
`cb(err, contextTag)`. Unbind with `MakeCurrent(0, 0, currentTag, cb)`.

### IsDirect(ctx, cb)
Opcode 6. `cb(err, isDirect)` — boolean, always false for contexts created
by this client.

### QueryVersion(clientMajor, clientMinor, cb)
Opcode 7. `cb(err, [major, minor])`. Not called automatically during
`require`.

### WaitGL(contextTag) / WaitX(contextTag)
Opcodes 8/9. Order GL rendering against core X rendering (glXWaitGL /
glXWaitX). No reply.

### CopyContext(src, dest, mask, srcContextTag)
Opcode 10. Copies context state (mask of `GL_*_BIT` attribute groups, e.g.
`GLX.ALL_ATTRIB_BITS`). `srcContextTag` is the tag if `src` is current, else
0. No reply.

### SwapBuffers(contextTag, drawable)
Opcode 11. Presents the back buffer. No reply.

### UseXFont(contextTag, font, first, count, listBase)
Opcode 12. glXUseXFont — builds `count` display lists starting at
`listBase` from glyphs of the (opened) X `font` starting at glyph `first`.
No reply.

### CreateGLXPixmap(screen, visual, pixmap, glxpixmap)
Opcode 13. Wraps ordinary `pixmap` (matching `visual`'s depth) as GLX
drawable `glxpixmap` (client-allocated XID). No reply.

### GetVisualConfigs(screen, cb)
Opcode 14. `cb(err, configs)` — one object per GL-capable visual:
`{visualID, visualType, rgbMode, redBits, greenBits, blueBits, alphaBits,
accumRedBits, accumGreenBits, accumBlueBits, accumAlphaBits,
doubleBufferMode, stereoMode, rgbBits, depthBits, stencilBits,
numAuxBuffers, level}` plus any extension properties the server appends
(decoded by attribute name, e.g. `SAMPLES`, `VISUAL_SELECT_GROUP_SGIX`).

### DestroyGLXPixmap(glxpixmap)
Opcode 15. No reply.

### VendorPrivate(contextTag, vendorCode, data)
Opcode 16. Generic vendor-specific command, no reply. `data` length must be
a multiple of 4.

### VendorPrivateWithReply(contextTag, vendorCode, data, cb)
Opcode 17. Generic vendor-specific round trip.
`cb(err, {retval, size, data})` — `data` is the reply payload after the
retval/size words (16 remaining header bytes + variable part).

### QueryExtensionsString(screen, cb)
Opcode 18. `cb(err, str)` — space-separated GLX extension list (trailing
NUL padding stripped).

### QueryServerString(screen, name, cb)
Opcode 19. `cb(err, str)`. `name` is `GLX.glxConst.VENDOR` (1),
`VERSION` (2) or `EXTENSIONS` (3). (The `GLX.VENDOR`/`GLX.EXTENSIONS`
constants without `glxConst` are the *GL* glGetString enums — those go with
`GetString` below.)

### ClientInfo(major, minor, glExtensions)
Opcode 20. Tells the server which GLX version and GL extension string the
client supports. No reply.

### GetFBConfigs(screen, cb)
Opcode 21. `cb(err, configs)` — array of objects keyed by attribute name
(`FBCONFIG_ID`, `VISUAL_ID`, `DRAWABLE_TYPE`, `RENDER_TYPE`,
`DOUBLEBUFFER`, ...).

### ChooseFBConfig(screen, spec, cb)
Convenience helper, not a protocol request: fetches the screen's fbconfigs
with `GetFBConfigs` and applies the `glXChooseFBConfig` selection rules
(GLX 1.4 spec §3.3.3) client-side. `spec` is an object keyed by attribute
name; values are numbers, booleans, or `null` for "don't care".
`cb(err, configs)` receives **all** matching configs sorted best-first —
take `configs[0]` as the best match (empty array = nothing matched).

```js
GLX.ChooseFBConfig(0, {
    DOUBLEBUFFER: true,
    RED_SIZE: 8, GREEN_SIZE: 8, BLUE_SIZE: 8,
    DEPTH_SIZE: 16,
    DRAWABLE_TYPE: GLX.glxConst.WINDOW_BIT
}, (err, configs) => {
    const fbconfig = configs[0];
    // GLX.CreateNewContext(ctx, fbconfig.FBCONFIG_ID, ...)
});
```

Unspecified attributes take the spec's defaults (`RENDER_TYPE`
`GLX_RGBA_BIT`, `DRAWABLE_TYPE` `GLX_WINDOW_BIT`, `STEREO` false, sizes 0,
most others don't-care); sized attributes are minimums, `RENDER_TYPE`/
`DRAWABLE_TYPE` are masks, the rest match exactly. Ties are broken by the
spec's sort rules: no-caveat configs first, then deeper color (for the
components you requested), smaller `BUFFER_SIZE`, single-buffer before
double, fewer aux buffers, depth (none when unrequested, else deepest),
smaller stencil, larger requested accum, `TrueColor` visuals first.
Specifying `FBCONFIG_ID` ignores all other attributes, per the spec.

### CreatePixmap(screen, fbconfig, pixmap, glxpixmap, attribs)
Opcode 22 (GLX 1.3 fbconfig flavour of CreateGLXPixmap). No reply.

### DestroyPixmap(glxpixmap)
Opcode 23. No reply.

### CreateNewContext(ctx, fbconfig, screen, renderType, shareListCtx, isDirect)
Opcode 24. GLX 1.3 context creation from an fbconfig. `renderType` is
`GLX.glxAttrib.RGBA_TYPE` or `COLOR_INDEX_TYPE`. No reply.

### QueryContext(ctx, cb)
Opcode 25. `cb(err, attribs)` — `{FBCONFIG_ID, VISUAL_ID, SCREEN,
RENDER_TYPE}` (decoded attribute pairs).

### MakeContextCurrent(oldContextTag, drawable, readDrawable, ctx, cb)
Opcode 26. GLX 1.3 bind with separate draw/read drawables.
`cb(err, contextTag)`.

### CreatePbuffer(screen, fbconfig, pbuffer, attribs)
Opcode 27. Creates off-screen pbuffer (client-allocated XID). Size is given
via attribs: `[GLX.glxAttrib.PBUFFER_WIDTH, w, GLX.glxAttrib.PBUFFER_HEIGHT,
h]`. No reply.

### DestroyPbuffer(pbuffer)
Opcode 28. No reply.

### GetDrawableAttributes(drawable, cb)
Opcode 29. `cb(err, attribs)` — decoded pairs (`WIDTH`, `HEIGHT`,
`FBCONFIG_ID`, `PRESERVED_CONTENTS`, ...).

### ChangeDrawableAttributes(drawable, attribs)
Opcode 30. Sets drawable attributes (e.g. `EVENT_MASK` for PbufferClobber
delivery). No reply.

### CreateWindow(screen, fbconfig, window, glxwindow, attribs)
Opcode 31. Wraps X `window` as GLX window `glxwindow` (client-allocated
XID). No reply.

### DestroyWindow(glxwindow)
Opcode 32. No reply.

### SetClientInfoARB(major, minor, versions, glExtensions, glxExtensions)
Opcode 33 (GLX_ARB_create_context). `versions` is `[[major, minor], ...]`
of supported GL versions. No reply.

### CreateContextAttribsARB(ctx, fbconfig, screen, shareListCtx, isDirect, attribs)
Opcode 34 (GLX_ARB_create_context). Attribute-driven context creation;
codes in `GLX.glxAttrib.CONTEXT_*` (e.g. `CONTEXT_MAJOR_VERSION_ARB`,
`CONTEXT_PROFILE_MASK_ARB`), values in `GLX.glxConst`. No reply.

### SetClientInfo2ARB(major, minor, versions, glExtensions, glxExtensions)
Opcode 35. Like `SetClientInfoARB` but `versions` entries are
`[major, minor, profileMask]`. No reply.

## Single GL commands (X_GLsop_*)

All take the context tag first. Requests without a `cb` have no reply.

- `NewList(contextTag, list, mode)` — opcode 101; `mode` is `GLX.COMPILE`
  or `COMPILE_AND_EXECUTE`.
- `EndList(contextTag)` — opcode 102.
- `DeleteLists(contextTag, list, range)` — opcode 103.
- `GenLists(contextTag, count, cb)` — opcode 104; `cb(err, base)`.
- `FeedbackBuffer(contextTag, size, type)` — opcode 105.
- `SelectBuffer(contextTag, size)` — opcode 106.
- `RenderMode(contextTag, mode, cb)` — opcode 107; `mode` is `GLX.RENDER`,
  `FEEDBACK` or `SELECT`; `cb(err, {retval, newMode, data})` — `retval` is
  the number of feedback/selection values generated in the previous mode
  (0 when it was `GL_RENDER`), `data` the raw CARD32 records.
- `Finish(contextTag, cb)` — opcode 108; `cb(err)`.
- `PixelStoref(contextTag, pname, param)` / `PixelStorei(...)` — opcodes
  109/110; set pixel pack/unpack state (e.g. `GLX.PACK_ALIGNMENT`).
- `ReadPixels(contextTag, x, y, width, height, format, type, swapBytes,
  lsbFirst, cb)` — opcode 111; `cb(err, buffer)` — raw pixel data laid out
  per current pack modes. Reads the back buffer of the current read
  drawable; ideal for verifying rendering without screenshots.
- `GetBooleanv(contextTag, pname, cb)` / `GetDoublev` / `GetFloatv` /
  `GetIntegerv` — opcodes 112/114/116/117; `cb(err, value)` — a single
  number/boolean, or an array when the pname has multiple values
  (e.g. `GL_VIEWPORT`).
- `GetError(contextTag, cb)` — opcode 115; `cb(err, glError)` (0 =
  `GL_NO_ERROR`).
- `GetString(contextTag, name, cb)` — opcode 129; `name` is `GLX.VENDOR`,
  `RENDERER`, `VERSION` or `EXTENSIONS` (the GL 0x1F0x enums);
  `cb(err, str)`.
- `IsEnabled(contextTag, cap, cb)` — opcode 140; `cb(err, bool)`.
- `IsList(contextTag, list, cb)` — opcode 141; `cb(err, bool)`.
- `Flush(contextTag)` — opcode 142.
- `AreTexturesResident(contextTag, textures, cb)` — opcode 143;
  `cb(err, {allResident, residences})`.
- `DeleteTextures(contextTag, textures)` — opcode 144.
- `GenTextures(contextTag, count, cb)` — opcode 145; `cb(err, ids)`.
- `IsTexture(contextTag, texture, cb)` — opcode 146; `cb(err, bool)` (true
  once the id has been bound).

## Vendor-private extension requests

- `MakeCurrentReadSGI(oldContextTag, drawable, readDrawable, ctx, cb)` —
  GLX_SGI_make_current_read (vendor op 65537); `cb(err, contextTag)`.
  Predecessor of `MakeContextCurrent`.
- `GetFBConfigsSGIX(screen, cb)` — GLX_SGIX_fbconfig (65540); same decoded
  reply as `GetFBConfigs`.
- `CreateContextWithConfigSGIX(ctx, fbconfig, screen, renderType,
  shareListCtx, isDirect)` — GLX_SGIX_fbconfig (65541). No reply.
- `CreateGLXPixmapWithConfigSGIX(screen, fbconfig, pixmap, glxpixmap)` —
  GLX_SGIX_fbconfig (65542). No reply.
- `CreateGLXPbufferSGIX(screen, fbconfig, pbuffer, width, height, attribs)`
  — GLX_SGIX_pbuffer (65543). Unlike `CreatePbuffer`, width/height are
  plain arguments. No reply.
- `DestroyGLXPbufferSGIX(pbuffer)` — GLX_SGIX_pbuffer (65544). No reply.
- `ChangeDrawableAttributesSGIX(drawable, attribs)` /
  `GetDrawableAttributesSGIX(drawable, cb)` — GLX_SGIX_pbuffer
  (65545/65546); decoded pairs like the core requests.
- `BindTexImage(contextTag, drawable, buffer, attribs)` /
  `ReleaseTexImage(contextTag, drawable, buffer)` —
  GLX_EXT_texture_from_pixmap (1330/1331); `buffer` is e.g.
  `GLX.glxConst.FRONT_LEFT_EXT`. No reply.
- `CopySubBufferMESA(contextTag, drawable, x, y, width, height)` —
  GLX_MESA_copy_sub_buffer (5154). No reply.

Attribute-only extensions (`GLX_ARB_multisample`, `GLX_EXT_visual_info`,
`GLX_EXT_visual_rating`, `GLX_OML_swap_method`, `GLX_SGIS_multisample`,
`GLX_SGIX_visual_select_group`, `GLX_EXT_get_drawable_type`) need no
requests — their attribute codes are in `GLX.glxAttrib`/`GLX.glxConst` and
show up in decoded fbconfig/visual properties.

## Render pipeline (glxrender.js)

`GLX.renderPipeline(contextTag)` returns an object with immediate-mode GL
methods. Each call serializes one GL render command into an internal batch;
nothing is sent until flushed. Flushing happens when:

- `gl.Render()` is called explicitly (optional argument overrides the tag);
- the batch would exceed 65520 bytes (`MAX_SMALL_RENDER`);
- a bound GLX request is invoked — `NewList`, `EndList`, `DeleteLists`,
  `GenLists`, `GenTextures`, `DeleteTextures`, `IsTexture`, `SwapBuffers`,
  `Finish` and `Flush` exist on the pipeline with the tag pre-bound (e.g.
  `gl.SwapBuffers(drawable)`, `gl.GenLists(count, cb)`);
- `TexImage2D` is called (flushes, then ships pixel data via `RenderLarge`).

Serialized commands: `Begin/End`, `Vertex2f`, `Vertex3f/Vertex3fv`,
`Color3f`, `Color4f`, `Normal3f/Normal3fv`, `TexCoord2f`, `RasterPos2f`,
`Rectf`, `ClearColor`, `ClearDepth`, `ClearStencil`, `Clear`,
`Enable/Disable`, `ShadeModel`, `AlphaFunc`, `BlendFunc`, `LogicOp`,
`StencilFunc/StencilOp/StencilMask`, `ColorMask`, `DepthFunc`, `DepthMask`,
`LineWidth`, `LineStipple`, `PointSize`, `PolygonMode`, `Scissor`,
`DrawBuffer`, `ReadBuffer`, `Hint`, `ColorMaterial`, `CullFace`,
`FrontFace`, `Fogf/Fogfv`, `Lightfv`, `LightModelf`, `Materialfv` (both
`*fv` accept a 4-element array or 4 scalars), `MatrixMode`, `LoadIdentity`,
`LoadMatrixf/MultMatrixf` (16-element arrays), `PushMatrix/PopMatrix`,
`Rotatef`, `Scalef`, `Translatef`, `Ortho`, `Frustum`, `Viewport`,
`CallList`, `ListBase`, `BindTexture`, `TexEnvf/TexEnvi`,
`TexGeni/TexGenfv` (sphere/eye-plane texture coordinate generation),
`TexParameterf/fv/i`, `ProgramString/BindProgram` (ARB program objects) and
`TexImage2D(target, level, internalFormat, width, height, border, format,
type, data)` (`type` must be `FLOAT`, `BYTE` or `UNSIGNED_BYTE`; `data` a
plain array).

All GL enums from `glxconstants.js` (`GL_*` names minus the prefix) are
copied onto the `GLX` object and every pipeline; `GLX.glxAttrib` /
`GLX.glxConst` carry the GLX-specific codes.

## Events / errors

One event, `PbufferClobber` (delivered when a bound pbuffer/window is
damaged; select it with `ChangeDrawableAttributes(drawable,
[GLX.glxAttrib.EVENT_MASK, GLX.glxConst.PBUFFER_CLOBBER_MASK])`):
`{name: 'GlxPbufferClobber', eventType, drawableType, drawable, bufferMask,
auxBuffer, x, y, width, height, count}`.

The 13 GLX protocol errors are registered with the client's error parsers;
a failed request yields an error whose `message` is the official name:
`GLXBadContext`, `GLXBadContextState`, `GLXBadDrawable`, `GLXBadPixmap`,
`GLXBadContextTag`, `GLXBadCurrentWindow`, `GLXBadRenderRequest`,
`GLXBadLargeRequest`, `GLXUnsupportedPrivateRequest`, `GLXBadFBConfig`,
`GLXBadPbuffer`, `GLXBadCurrentDrawable`, `GLXBadWindow`.

## Notes

- Indirect rendering only — GL 1.x-era functionality carried over the X
  connection; not fast, but fully scriptable and testable (see
  `test/glx.js`, which renders and verifies pixels via `ReadPixels`).
- No version negotiation happens during `require`; call `QueryVersion`
  yourself if you need it.
- Coverage gaps: GL single ops not listed above (GetLightfv, GetMapdv,
  GetTexImage, glGetClipPlane, the color-table/convolution/histogram
  queries, ...) and the render commands beyond the serialized set; add them
  following the existing patterns in `glx.js` / `glxrender.js`.
