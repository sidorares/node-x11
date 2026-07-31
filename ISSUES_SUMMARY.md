# Open issues summary

Triage pass of 2026-07-25. Out of 40 open issues, 30 were answered and closed
(fixed by the recent modernization / protocol-coverage / GLX work, answered
usage questions, or obsolete infrastructure reports). The 10 issues below stay
open: they are real feature requests or design problems that need actual work.

## Architecture / API design

### [#85](https://github.com/sidorares/node-x11/issues/85) — Missing async handling for void requests (2015)
Requests that produce no reply (`ChangeWindowAttributes`, `CreateWindow`, …)
only invoke their callback on error, so the callback may never fire — against
Node CPS conventions, and there is no way to await completion. Ideas discussed
in-thread: track sequence numbers and resolve "no news is good news" when a
later reply/error arrives (that is how xcb's `xcb_request_check` works — it
internally appends a no-op `GetInputFocus`); or return an EventEmitter per
request. Complications: callback-map growth, seq wrap-around (16-bit), and
choosing sane semantics without a timeout hack. Related closed discussion:
[#151](https://github.com/sidorares/node-x11/issues/151). Pairs naturally with
a promise-returning higher-level layer (declined for core in
[#87](https://github.com/sidorares/node-x11/issues/87)).

### [#195](https://github.com/sidorares/node-x11/issues/195) — Add backpressure mechanism (2020)
Requests are written to the socket without observing `stream.write()`'s return
value, so a render-heavy client (e.g. drawing on every mouse move) can queue
unbounded memory. Wanted: at minimum a `flush(cb)`/promise that resolves when
buffered data is on the wire; ideally documented patterns for protocol-level
throttling (draw-on-Expose, or a Sync/GetInputFocus round-trip as a fence).
The serialization layer was rewritten in #215, which makes this feasible now.

### [#152](https://github.com/sidorares/node-x11/issues/152) — X11 server side (2017)
`lib/xserver.js` is an experimental protocol-level server skeleton (still has
a hard-coded `fs.readFile` of a handshake dump). Deciding its fate — either
grow it into a usable proxy/nested-server building block or document it as
out of scope — would close a recurring line of questions.

## Features

### [#171](https://github.com/sidorares/node-x11/issues/171) — Abstract namespace socket support (2018) — *easy win*
Snap-confined apps can reach `@/tmp/.X11-unix/X0` but not the filesystem
socket. Node's `net` now supports abstract sockets natively (path prefixed
with `'\0'`), so this no longer needs a native addon: fall back to the
abstract socket when the filesystem one fails, and/or accept an explicit
socket path in `createClient` options. Connection logic: `lib/xcore.js`
(`connectStream`).

### [#183](https://github.com/sidorares/node-x11/issues/183) — GLX FBConfig chooser helper (2018)
Constants and attribute decoding landed with #218; what remains is a
`ChooseFBConfig`-style helper implementing the GLX 1.3 matching/sorting rules
so examples and users stop filtering `GetFBConfigs` results by hand.

### [#50](https://github.com/sidorares/node-x11/issues/50) — Shaders (2014)
`ProgramString`/`BindProgram` (ARB assembly) landed with #218. Missing for a
usable pipeline: `ProgramEnvParameter*`/`ProgramLocalParameter*` render
opcodes plus an example (the classic ARB gears/brick demos). GLSL over the
indirect protocol was never standardized, so ARB assembly is the ceiling.

### [#51](https://github.com/sidorares/node-x11/issues/51) — GL evaluator functions (2014)
`Map1/Map2/EvalCoord/EvalMesh/MapGrid` render opcodes are still not
implemented in `lib/ext/glxrender.js`. Niche legacy-GL feature; low priority
but well-specified (opcodes in the GLX protocol spec / Mesa `gl_API.xml`).

## Examples / documentation

### [#62](https://github.com/sidorares/node-x11/issues/62) — Arbitrary polygon rendering example (2014)
XRender only draws triangles/trapezoids; the ask is an example gluing a JS
triangulation library (earcut is the modern choice) to `Render.AddTraps` /
`Triangles`. Pure example work, no library changes.

### [#179](https://github.com/sidorares/node-x11/issues/179) — `_NET_WM_STRUT(_PARTIAL)` doesn't reserve space (2018)
Setting struts via `ChangeProperty` appeared not to work for a panel app,
while the equivalent GTK/C program did; another user hit the same in 2021.
Never root-caused — likely a property-encoding or ordering subtlety (format
32, CARDINAL array of 4/12 values, set before mapping, plus
`_NET_WM_WINDOW_TYPE_DOCK`). Needs a reproduction against a strut-honoring WM
and, once solved, a worked panel example; a good candidate for a test-driven
EWMH example/doc page.

## Skipped

### [#91](https://github.com/sidorares/node-x11/issues/91) — Grabbed key events not reaching nw.js app (2015)
Environment-specific (nw.js + grab semantics: grabbed input is redirected to
the grabbing client, not the app's own window). Too little information to
resolve definitively; left untouched.
