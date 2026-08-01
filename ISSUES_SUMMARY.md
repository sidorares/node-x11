# Open issues — node-x11 and ntk

Triage notes, refreshed whenever the picture has moved enough to mislead.
Audited **2026-07-31** against node-x11 `722a0df` (v3.4.0 released) and ntk
`7016021` (#130/#131/#132 merged). Covers both repos, because they are worked
on together and half the entries below only make sense as a pair.

Previous pass was 2026-07-25 and covered node-x11 only. Since then **five of
its ten entries closed** — #85 and #195 by the flow-control work, #171 and
#183 on 2026-07-26, and #179 today — and **four new issues were filed**
(#243–#246). Everything below has been re-checked against current code rather
than carried forward.

---

Since the audit, [#244](https://github.com/sidorares/node-x11/issues/244)
(output buffering) has been implemented — opt-in `bufferRequests`, see
"Buffering the output" in `docs/README.md`.

# node-x11 — 8 open

## Worth doing next

### [#243](https://github.com/sidorares/node-x11/issues/243) — FamilyWild cookies never match, and a failed match silently drops auth (2026-07-31)

**Verified against current master.** `parseXauth` writes `cookie.type`;
the match loop at `lib/auth.js:97` tests `typeToName[cookie.family]`, a
property nothing ever sets. `typeToName[undefined]` is never `'Wild'`, so the
wildcard branch is dead and only the exact `(type, address)` pair can match.
When nothing matches — wild-only file, hostname mismatch in a container,
stale entry — `lib/auth.js:101` falls through to `{ authName: '', authData: '' }`
and connects anonymously, so the only symptom is the server's generic
"Authorization required" with nothing saying a cookie file was read.

Two-line logic fix plus a diagnostic. Reproducible with no X server at all,
since the failure is in cookie selection. **Top pick.**

### [#245](https://github.com/sidorares/node-x11/issues/245) — XISelectEvents and XI2 event delivery (2026-07-31)

`lib/ext/xinput.js` implements four requests — XI1 `GetExtensionVersion` and
`ListInputDevices`, XI2 `XIQueryVersion` and `XIQueryDevice` — and no
`XISelectEvents` (46), no GenericEvent parser. So a client can enumerate
devices in detail, *including the Scroll classes the reply parser already
decodes*, and never hear from them. All input arrives as core events, where a
touchpad's smooth scroll is flattened into button 4/5 presses and touch,
pressure and tilt do not exist.

The delivery half is already built: `geEventParsers` keyed by extension major
opcode (`lib/xcore.js:167`), dispatch at `:349`, and `lib/ext/present.js:180`
as the worked example of an extension registering its parser. Largest item
here, but well-scoped and additive.

### [#246](https://github.com/sidorares/node-x11/issues/246) — ESM bundling throws at runtime (2026-07-31)

`esbuild --format=esm` builds cleanly and the bundle then throws
`Dynamic require of "events" is not supported` — the worst failure shape,
because it surfaces at deploy. Node itself is fine both ways; this is purely
bundler output. `node:`-prefixed requires do **not** help.

Split it: the `exports` map is three lines, no behaviour change, and removes
the deprecated directory-main — fold it into any other PR. The real fix is
converting `lib/` to ESM sources, which is a major, and the tempting shortcut
does not work: a thin ESM wrapper over CJS still `require()`s builtins
underneath, which is the exact failing construct.

## Old, and closeable rather than workable

### [#152](https://github.com/sidorares/node-x11/issues/152) — X11 Server (2017)

Someone trying to write an X server, stuck on the handshake reply. **The
thing they wanted now exists**: `lib/xserver/` is a working pure-JS X server
with RENDER, its own `DESIGN.md`, and hermetic test suites in both repos.
Answer with a pointer and close.

### [#91](https://github.com/sidorares/node-x11/issues/91) — Grabbed key events not reaching an nw.js app (2015)

Environment-specific, and the reported behaviour is what a keyboard grab is
*for*: grabbed input goes to the grabbing client, not the app's own window.
Too little information to resolve; close as stale.

### [#62](https://github.com/sidorares/node-x11/issues/62) — Arbitrary polygon rendering example (2014)

Wants a triangulation library glued to `Render.AddTraps`/`Triangles`. Note
ntk solved the underlying problem in `lib/trapezoid.js` — polygon to
trapezoids, non-zero and even-odd, used for every 2d path fill and vector
glyph — so this is now only an example, and arguably one that belongs in ntk.

### [#50](https://github.com/sidorares/node-x11/issues/50) — Shaders (2014)

`ProgramString`/`BindProgram` (ARB assembly) landed with #218. Missing:
`ProgramEnvParameter*`/`ProgramLocalParameter*` render opcodes and an
example. GLSL over indirect GLX was never standardized, so ARB assembly is
the ceiling — worth saying in the issue so it stops reading as open-ended.

### [#51](https://github.com/sidorares/node-x11/issues/51) — GL evaluator functions (2014)

`Map1`/`Map2`/`EvalCoord`/`EvalMesh`/`MapGrid` still absent from
`lib/ext/glxrender.js` — re-checked, zero hits. Niche legacy GL, well
specified, low priority.

---

# ntk — 17 open

Three PRs merged today closed #126 and #117 and left #118 partly done. What
remains splits cleanly into one real bug, a text/render batch, a clipboard
batch, and a tail of old idea-issues.

## Worth doing next

### [ntk#116](https://github.com/sidorares/ntk/issues/116) — keysym by XKB group and shift level

`symInd = capital ? 1 : 0` reaches only levels 1–2 of group 1, so on Linux a
non-Latin layout never types — and a layout switch fires no MappingNotify, so
the existing refresh cannot see it. The group bits are already arriving in
`ev.buttons` 13–14; no XKB extension calls needed for the common case. AltGr
(levels 3–4) is unreachable for the same reason, which the code's own TODO
admits.

**Highest user-facing impact of anything open in either repo.** Caveat for
this machine: XQuartz takes the other path entirely — it rewrites the keymap
and fires MappingNotify rather than using groups — so the payoff cannot be
confirmed locally without a Linux box.

### [ntk#118](https://github.com/sidorares/ntk/issues/118) — remaining: `_NET_WM_ICON`

Items 1, 3, 4 and 6 shipped in #131 (the WM_PROTOCOLS clobber, `setWmHints`,
`setPid`, the position/size flags) and item 2 in #130 (the ClientMessage
helper). Only item 5 is left, and it is a pixel-format decision rather than a
property-writer one: EWMH wants non-premultiplied ARGB in CARD32s, ntk's
`getImageData` hands back BGRA, canvas `ImageData` is RGBA. Pick a convention
first, then it is twenty lines.

### [ntk#36](https://github.com/sidorares/ntk/issues/36) — a named close-request event

Still real, and now small. `addProtocol('WM_DELETE_WINDOW')` opts in and the
request arrives as a generic `'message'`; what is missing is the ergonomic
half the issue actually asks for — a named event, and the issue's own
suggestion of `onBeforeUnload` is worth keeping. Natural follow-on to #131.

## Batches

**Text/render:** [#125](https://github.com/sidorares/ntk/issues/125)
one-write-per-frame, [#124](https://github.com/sidorares/ntk/issues/124)
maxLines/ellipsis, [#123](https://github.com/sidorares/ntk/issues/123)
half-leading, [#122](https://github.com/sidorares/ntk/issues/122) downscale
before upload. #124 and #123 are self-contained TextLayout work with obvious
tests; #122 is perf, deferred.

#125 has shrunk to a one-liner now that node-x11 buffers output: measured
against the current client, `createClient({ bufferRequests: … })` alone takes
a 2000-request ntk frame from 2003 writes to 1–2, because `_runFrame()` emits
a frame in one synchronous run and ends with the frame fence's
`GetInputFocus`, whose reply gate flushes exactly at the frame boundary. The
`X.flush()` at `_present()` the issue proposes is redundant there and would
split writes in a multi-window app. What is left for ntk: pass the option
through and size `maxSize` to a frame (16 KB default = ~5 writes for a 72 KB
frame, 256 KB = 1); `tcpNoDelay` already defaults to on with buffering.

**Clipboard:** [#120](https://github.com/sidorares/ntk/issues/120) XFixes
selection-changed events, [#119](https://github.com/sidorares/ntk/issues/119)
INCR on the write side plus required targets. #119 closes a limitation
`lib/clipboard.js` documents in its own header, so it is honest work with a
known shape.

**Fonts:** [#121](https://github.com/sidorares/ntk/issues/121) a first-class
bundled-fonts option. The `FontSource` seam already exists —
`StaticFontSource` is the browser-safe implementation — so this is largely
packaging a default set rather than new architecture.

## Resolved or superseded — close these

### [ntk#106](https://github.com/sidorares/ntk/issues/106) — drop the mermaid dependency

**Done**, by removal rather than injection: `feat!: drop mermaid diagram
rendering` (#113, in 4.0.0). `grep mermaid package.json lib/` is empty. The
issue asked for a `configureTex`-style injection seam and got deletion
instead, so close with that note rather than silently.

### [ntk#31](https://github.com/sidorares/ntk/issues/31) — set window class / "all the EWMH stuff besides the title"

**Done.** `setClass` has shipped for a while; as of #131/#132 the EWMH surface
covers window type, states, transient-for, hints, protocols and pid. Close
pointing at the Window manager hints section of `docs/window.md`.

### [ntk#19](https://github.com/sidorares/ntk/issues/19) — implement basic ICCCM

**Done**, including the API sketched in your own comment on it —
`createWindow({ icon, transientFor, maxWidth })` and `setHints()` both work as
written there. Close pointing at #131.

### [ntk#4](https://github.com/sidorares/ntk/issues/4) — layout managers

Superseded. The answer turned out to be yoga-layout, used by HtmlView and
re-exported from `lib/index.js` so downstream renderers share one WASM
instance. Cassowary is not coming.

### [ntk#17](https://github.com/sidorares/ntk/issues/17) — widgets via Zebra

Superseded. Zebra is unmaintained, and ntk grew its own widget layer —
HtmlView, MarkdownView, SvgView, TexView.

## Leave open, low priority

- [ntk#37](https://github.com/sidorares/ntk/issues/37) — "attention" event,
  a 2018 speculative idea about predicting clicks. Unrelated to the ICCCM
  urgency hint despite the name; needs a decision on whether it is wanted at
  all before it is worth scoping.
- [ntk#22](https://github.com/sidorares/ntk/issues/22) — text editor example.
  Genuinely useful as a demo of the text stack, and cheap once #124 lands.
