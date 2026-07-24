# GLX extension

OpenGL rendering over the X protocol (indirect rendering). The module wraps a
subset of the GLX protocol: context/drawable management, a handful of
single-op GL requests (display lists, textures), and the `Render` /
`RenderLarge` requests that carry batched GL commands. A small GL command
serializer is provided by [`lib/ext/glxrender.js`](../../lib/ext/glxrender.js)
via `GLX.renderPipeline(ctx)`.

- Module: `X.require('glx', cb)` (X name `GLX`)
- Source: [`lib/ext/glx.js`](../../lib/ext/glx.js) ·
  Render pipeline: [`lib/ext/glxrender.js`](../../lib/ext/glxrender.js) ·
  Constants: [`lib/ext/glxconstants.js`](../../lib/ext/glxconstants.js) ·
  Examples: [`examples/opengl/`](../../examples/opengl/)
- Spec: [glx.xml (xcb proto)](https://gitlab.freedesktop.org/xorg/proto/xcbproto/-/blob/master/src/glx.xml),
  [GLX protocol PDF](https://registry.khronos.org/OpenGL/specs/gl/glxproto.pdf)

```js
X.require('glx', (err, GLX) => {
    const ctx = X.AllocID();
    GLX.CreateContext(ctx, visual, 0 /* screen */, 0, 0);
    GLX.MakeCurrent(win, ctx, 0, (err, contextTag) => {});
    const gl = GLX.renderPipeline(ctx);

    gl.ClearColor(0, 0, 0, 1);
    gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.Begin(gl.TRIANGLES);
    gl.Color3f(1, 0, 0); gl.Vertex3f(0, 1, 0);
    gl.Color3f(0, 1, 0); gl.Vertex3f(-1, -1, 0);
    gl.Color3f(0, 0, 1); gl.Vertex3f(1, -1, 0);
    gl.End();
    gl.SwapBuffers(win);   // flushes the batch, then issues glXSwapBuffers
});
```

Unlike most extensions, no version negotiation happens during `require`;
call `QueryVersion` yourself if you need it. All GL enums from
`glxconstants.js` are copied onto both the `GLX` object and every render
pipeline (`GLX.TRIANGLES`, `gl.COMPILE`, `gl.LIGHT0`, ...).

## Requests

Listed in minor opcode order. `ctx` arguments are GLX context XIDs
(from `X.AllocID()` + `CreateContext`), except where a request takes the
context *tag* returned by `MakeCurrent` — on the wire `Render`,
`RenderLarge`, `NewList` etc. expect the tag, but with indirect contexts the
examples pass the context XID and current servers accept it.

### Render(ctx, data)
Minor opcode 1. Sends a batch of serialized GL commands. `data` is a Buffer
or an array of Buffers, each holding one or more GL render commands
(2-byte length, 2-byte opcode, payload). Buffer lengths must be multiples
of 4. No reply. Normally used through `renderPipeline` rather than directly.

### RenderLarge(ctx, requestNum, requestTotal, data)
Minor opcode 2. Carries one GL command too big for `Render`, split into
`requestTotal` parts; `requestNum` is 1-based. `data` is a Buffer (padded
to 4 bytes automatically). No reply. Used internally by the pipeline's
`TexImage2D`.

### CreateContext(ctx, visual, screen, shareListCtx, isDirect)
Minor opcode 3. Creates GLX context `ctx` (client-allocated XID) for
`visual` on `screen`. `shareListCtx` is a context to share display lists
with (0 for none); `isDirect` should be 0 — this client renders indirectly.
No reply.

### MakeCurrent(drawable, ctx, oldContextTag, cb)
Minor opcode 5. Binds `ctx` to `drawable` (window or GLX pixmap).
`oldContextTag` is the tag from a previous `MakeCurrent` (0 the first
time). `cb(err, contextTag)` — tag identifying the new current context.

### QueryVersion(clientMajor, clientMinor, cb)
Minor opcode 7. `cb(err, [major, minor])` — GLX version supported by the
server. Not called automatically.

### SwapBuffers(ctx, drawable)
Minor opcode 11. Exchanges front and back buffers of `drawable`. `ctx` is
the context tag. No reply.

### CreateGLXPixmap(screen, visual, pixmap, glxpixmap)
Minor opcode 13. Creates an off-screen GLX rendering surface `glxpixmap`
(client-allocated XID) backed by the ordinary `pixmap`, which must match
`visual`'s depth. No reply. Currently prints debug output
(`console.log`/`console.trace`) on every call.

### GetVisualConfigs(screen, cb)
Minor opcode 14. `cb(err, configs)` — array with one object per GL-capable
visual: `{visualID, visualType, rgbMode, redBits, greenBits, blueBits,
alphaBits, accumRedBits, accumGreen, accumBlueBits, accumAlphaBits,
doubleBufferMode, stereoMode, rgbBits, depthBits, stencilBits,
numAuxBuffers, level}`. Only the first 18 properties are decoded; extra
tag/value properties the server may append are ignored.

### VendorPrivate(ctx, code, data)
Minor opcode 16. Sends vendor-specific command `code` with payload `data`
(Buffer, length multiple of 4). No reply. Used by `BindTexImage` /
`ReleaseTexImage` below.

### QueryExtensionsString(screen, cb)
Minor opcode 18. `cb(err, str)` — space-separated GLX extension list for
`screen` (string may include trailing padding NULs).

### QueryServerString(screen, name, cb)
Minor opcode 19. `cb(err, str)` — a server GLX string. `name` is 1
(vendor), 2 (version) or 3 (extensions) per the GLX protocol; note the
`VENDOR`/`EXTENSIONS` values in `glxconstants.js` are the *GL* glGetString
enums (0x1F00...), not these.

### GetFBConfigs(screen, cb)
Minor opcode 21. `cb(err, configs)` — array of framebuffer configs, each an
array of `[attribute, value]` pairs (raw GLX attribute codes, not decoded).

### NewList(ctx, list, mode)
Minor opcode 101. glNewList — starts recording display list `list`.
`mode` is `GLX.COMPILE` or `GLX.COMPILE_AND_EXECUTE`. No reply.

### EndList(ctx)
Minor opcode 102. glEndList — ends display list recording. No reply.

### GenLists(ctx, count, cb)
Minor opcode 104. glGenLists — `cb(err, base)` where `base` is the first
of `count` consecutive display list ids.

### Finish(ctx, cb)
Minor opcode 108. glFinish — blocks until all previous GL commands have
completed. `cb(err)` — the reply carries no data.

### GenTextures(ctx, count, cb)
Minor opcode 145. glGenTextures — `cb(err, ids)`, array of `count` texture
ids.

### IsTexture(ctx, texture, cb)
Minor opcode 146. glIsTexture. The unpacker currently returns the first 26
raw reply bytes as an array of numbers rather than a boolean; the GL result
is at index 0.

### Helpers built on VendorPrivate

- `BindTexImage(ctx, drawable, buffer, attribs)` — GLX_EXT_texture_from_pixmap
  bind (vendor opcode 1330). `attribs` is an optional flat
  `[attribute, value, ...]` array; note the current serializer writes
  `attribs.length` in place of each attribute value, so pass no attribs
  (omit or `[]`). No reply.
- `ReleaseTexImage(ctx, drawable, buffer)` — matching release (vendor
  opcode 1331). No reply.

## Render pipeline (glxrender.js)

`GLX.renderPipeline(ctx)` returns an object with immediate-mode-style GL
methods. Each call serializes one GL render command into an internal buffer
list; nothing is sent until the batch is flushed. Flushing happens when:

- `gl.Render()` is called explicitly (optional `ctxLocal` argument overrides
  the pipeline's context);
- the batch would exceed 65520 bytes (`MAX_SMALL_RENDER`);
- any of the bound GLX requests is invoked — `NewList`, `EndList`,
  `GenLists`, `GenTextures`, `IsTexture`, `SwapBuffers` and `Finish` exist
  on the pipeline with the `ctx` argument pre-bound (e.g.
  `gl.SwapBuffers(drawable)`, `gl.GenLists(count, cb)`) and flush pending
  commands first;
- `TexImage2D` is called (it flushes, then ships the pixel data via
  `RenderLarge`, splitting at 262124-byte chunks).

Serialized commands: `Begin(mode)`, `End()`, `Vertex3f/Vertex3fv`,
`Color3f`, `Color4f`, `Normal3f/Normal3fv`, `TexCoord2f`, `ClearColor`,
`Clear(mask)`, `Enable(cap)`, `ShadeModel`, `BlendFunc`, `PointSize`,
`Hint`, `MatrixMode`, `LoadIdentity`, `PushMatrix`, `PopMatrix`,
`Rotatef`, `Scalef`, `Translatef`, `Ortho`, `Frustum`, `Viewport`,
`CallList(list)`, `Lightfv(light, pname, v)` and
`Materialfv(face, pname, v)` (both accept a 4-element array or 4 scalars),
`BindTexture`, `TexEnvf`, `TexParameterf/fv/i`,
`TexImage2D(target, level, internalFormat, width, height, border, format,
type, data)` (`type` must be `FLOAT`, `BYTE` or `UNSIGNED_BYTE`; `data` is
a plain array).

See [`examples/opengl/glxgears.js`](../../examples/opengl/glxgears.js) for a
complete program (context setup, display lists, per-frame drawing).

## Events / errors

No events. The 13 GLX protocol errors are registered with the client's
error parsers; a failed request yields an error whose `message` is
`GLX: Bad <thing>` (context, drawable, pixmap, context tag, current window,
Render request, RenderLarge request, FB config, pbuffer, ...).

## Notes

- Enums: `glxconstants.js` exports the classic GL 1.x constant set
  (primitive modes, caps, texture/pixel formats, matrix modes, light and
  material names, hints, ...) under their names minus the `GL_` prefix
  (`TRIANGLES`, `DEPTH_TEST`, `RGBA`, `MODELVIEW`, ...). All of them are
  merged onto the `GLX` object and onto every render pipeline.
- Only indirect rendering is possible — commands travel over the X
  connection, so this is GL 1.x-era functionality and not fast. `isDirect`
  in `CreateContext` should be 0.
- `Ortho` and `Frustum` serialize the same GL opcode (182, glFrustum);
  a true glOrtho (opcode 181) is not currently emitted.
- `ProgramString` / `BindProgram` on the pipeline are unfinished and throw
  ReferenceErrors if called.
- Large coverage gaps vs. the full GLX protocol (DestroyContext,
  glXGetString, pbuffers, MakeContextCurrent, ...) — only the requests
  listed above are implemented.
