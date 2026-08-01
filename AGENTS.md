# node-x11 — agent notes

Pure-JavaScript X11 protocol client (and rudimentary server) for Node.js.
No build step, no transpilation: `lib/` is what ships.

## Hard rules

- **Zero runtime dependencies.** `dependencies` in package.json must stay empty;
  new packages go to `devDependencies` only, and only when clearly justified.
- The public API is callback-based (`createClient(cb)`, `X.SomeRequest(args, cb)`).
  Don't convert it to promises/async — that's a breaking change out of scope.
- **Scope: the wire protocol, not the conventions layered on it.** In scope are
  core requests/replies/events, extensions negotiated with `QueryExtension`,
  the predefined atom *numbers* (`lib/stdatoms.js` is the X protocol's
  Appendix B table, nothing more), and anything else whose byte layout comes
  from `autogen/proto/*.xml`. Out of scope are ICCCM and EWMH property
  *values* — the `WM_SIZE_HINTS` and `WM_HINTS` structs, `_NET_WM_*`,
  `WM_PROTOCOLS` membership, `_NET_SUPPORTED` probing, `_MOTIF_WM_HINTS`.
  Those belong to [ntk](https://github.com/sidorares/ntk), which already
  implements them (see its AGENTS.md). This has been the standing answer
  since [#177](https://github.com/sidorares/node-x11/issues/177) ("part of
  xlib but not core protocol") and was reaffirmed closing
  [#191](https://github.com/sidorares/node-x11/issues/191) and
  [#87](https://github.com/sidorares/node-x11/issues/87).

  The test that decides a borderline case: **can the server tell?** A wrong
  request encoding is a protocol error the server rejects and Xvfb can prove
  in CI; a wrong `WM_SIZE_HINTS` flags word is bytes the server stores
  verbatim and only a *window manager* can judge — which is why the repo has
  no generator, no round trip and no authority for it. `SendEvent`'s
  `packEvent`/`SendClientMessage` are in scope despite being mostly used for
  EWMH, because a 32-byte event layout is core protocol and is generated from
  `xproto.xml` like everything else in `lib/generated/`.

  What *is* ours in this area: making the requests underneath hard to misuse
  (the `ChangeProperty` `(type, format, data)` tuple is where the filed bugs
  actually landed — #106, #174, #178), exposing what only we know (the
  connection byte order negotiated in `lib/handshake.js`), and decoding
  properties for diagnostics (`examples/`).
- Node-API usage must work on maintained Node versions (see CI matrix in
  `.github/workflows/ci.yml`). Avoid long-deprecated APIs
  (`util.isError`, `new Buffer()`, …).
- **Keep `docs/` in sync with code.** Any change to a request signature,
  reply shape, event fields, enum, or extension coverage must update the
  matching page (`docs/core-requests.md`, `docs/core-events.md`, or
  `docs/ext/<module>.md`) in the same change. New extension modules get a
  new `docs/ext/` page (copy the structure of `docs/ext/xinerama.md`) and a
  row in the table in `docs/README.md`. The docs describe what the code
  actually does — verify against the implementation and tests, not the X
  spec.

## Running tests (do this on every change)

```sh
npm run test:local   # = ./scripts/test-local.sh
npm run lint         # eslint: no-var / prefer-const / no-redeclare
```

Full suite takes ~2 s. It starts (or reuses) a private Xvfb on display `:99`
and runs `npm test`. Requirements: `Xvfb` (Linux: `xvfb` package; macOS:
XQuartz provides `/opt/X11/bin/Xvfb`).

Details the script handles for you:

- Tests need a live X server; CI uses Xvfb on ubuntu (see workflow).
- On **macOS/darwin** the client only connects via unix socket when `DISPLAY`
  is a literal socket path (XQuartz launchd style, e.g. `/tmp/…/org.xquartz:0`);
  a bare `DISPLAY=:99` falls back to TCP port 6099. The script symlinks
  `/tmp/.X11-unix/X99` to `/tmp/.X11-unix/X99:99` and sets `DISPLAY` to that
  path. Don't run the suite over TCP on macOS: connection teardown produces
  spurious `ECONNRESET`s and 80 s hook timeouts.
- `test-runner.js` (not plain mocha) is the entry point: it probes the server
  and skips `dpms.js` / `xtest.js` / `randr.js` when the extension is missing.
  To run a single file directly: `DISPLAY=… npx mocha test/<file>.js`.

## Repo map

| Path | What it is |
|---|---|
| `lib/index.js` | Public entry: `createClient`, `createServer`, `eventMask`, constants |
| `lib/xcore.js` | Client core: connection setup, request/reply/event dispatch |
| `lib/corereqs.js` | Declarative pack/unpack templates for all core protocol requests |
| `lib/handshake.js` | Connection setup block parsing |
| `lib/framebuffer.js` | Binary framing + request pack/buffering |
| `lib/generated/` | Auto-generated parsers from `autogen/proto/` (`npm run gen:protocol`) |
| `lib/auth.js` | `~/.Xauthority` parsing / auth negotiation |
| `lib/ext/*.js` | Protocol extensions (render, randr, glx, xtest, dpms, …) |
| `lib/keysyms.js` | Generated keysym table (see `lib/keysyms.update.sh`) |
| `lib/xserver.js` | Experimental X server implementation |
| `autogen/` | Scripts that generate request stubs from XML protocol specs (xcb-proto) |
| `docs/` | API reference: README + core protocol + one page per extension |
| `examples/` | Runnable demos (need a real X server / XQuartz) |
| `test/` | Mocha specs, driven by `test-runner.js` |
| `website/` | The documentation site (Docusaurus); see below |

## Commit messages: conventional commits (required)

Releases are automated with [release-please](https://github.com/googleapis/release-please)
(`.github/workflows/release-please.yml`): it reads commit subjects on `master`
to decide the next version and to write `Changelog.md`. A malformed subject
means a wrong version bump or a silent gap in the changelog, so every commit
that lands on `master` must follow
[Conventional Commits](https://www.conventionalcommits.org/):

- `fix: …` → patch release; `feat: …` → minor; `feat!: …` / `fix!: …` or a
  `BREAKING CHANGE:` footer → major.
- `docs:`, `test:`, `chore:`, `ci:`, `refactor:` → no release, not in the
  changelog. Don't label a user-visible behavior change with these.
- Optional scope in parens: `fix(glx): …`, `feat(randr): …`.
- When squash-merging a PR, the **PR title** becomes the commit subject —
  it must follow the convention too.
- Never bump `version` in `package.json` or edit the released sections of
  `Changelog.md` by hand; release-please owns both (pending state lives in
  `.release-please-manifest.json`).

## PR descriptions

Write for a library user deciding whether/how to upgrade, not as a log of
your working session:

- Structure by topic (setup/context, bug fixes, new API, breaking changes,
  examples, testing) — never by commit ("first commit", "second commit");
  the commit history already tells that story.
- Lead with the context a reader needs to interpret the change (e.g. "this
  never worked because servers ship with X disabled"), then what changed.
- Describe bugs by user-visible symptom ("every perspective scene was
  actually orthographic"), not by diff ("opcode 182 → 175").
- Breaking changes get their own clearly-scoped section.
- State investigated dead ends / scope limits explicitly (e.g. "no shaders
  over indirect GLX — documented") so readers don't mistake them for gaps.
- Say how the change was verified (which servers, pixel-level tests, suite
  totals).

## The documentation site (`website/`)

The site runs the library rather than describing it: `browser/index.js` is
bundled with the JS X server into `static/demo/x11-demo-runtime.js`, and every
live demo is real client code talking to a real server over a
`registerDisplayProtocol('demo')` transport.

Two rules keep it honest:

1. **Demo code lives in `website/src/demos/*.js`, never inline in a page.**
   Guides embed them by id — `<LiveDemo demo="shapes" compact />` — because
   `scripts/check-demos.mjs` runs every file in that directory against the
   real server and fails when a demo stops drawing. A snippet pasted into an
   `.mdx` file is unchecked and will rot.
2. **A guide page that needs JSX must be `.mdx`.** `docusaurus.config.js` sets
   `format: 'detect'`, so a `.md` file silently renders `<LiveDemo …>` as
   literal text. Renaming also breaks inbound `…​.md` links, which fails the
   build — grep for the old name.

`LiveDemo` is global via `src/theme/MDXComponents.js`, so no import is needed.
It mounts its iframe on an IntersectionObserver: a page with eight demos boots
two X servers, not eight. Keep that — each runner is a server compositing on a
rAF loop.

Awkward details worth knowing before they cost you an afternoon:

- **The server's built-in font is ASCII only** (chars 0-127, 8x8). An em-dash
  in an `ImageText8` string renders as a filled box. `check-demos.mjs` wraps
  every client's text requests and fails on non-ASCII, so this is caught — but
  write `:` not `—` in drawn strings.
- **`ImageText8` fills the glyph cell with the GC's `background`** before
  drawing the glyph. Set both colours or text lands on a black box.
- **RENDER colours are floats 0..1 and clamped** (`colorToFix`). Passing
  16-bit values like `0xffff`/`0x3000` silently yields 1.0, so a stop list
  written in 16-bit comes out fully opaque.
- **A client's own requests are never redirected to itself.** A window-manager
  demo needs a second `createClient` for the windows it manages.
- **`npx docusaurus serve` 301-redirects `/demo/runner.html`** to a path
  without the baseUrl, so demos show the site's own homepage in the iframe.
  That is a preview-only artifact — `npm start` and GitHub Pages both serve it
  correctly. Verify a build with a plain static server, not with `serve`.

Gates, all wired into `npm test` in `website/`: `check-demos` (every demo
draws, reacts to injected input, animates if it should), `check-bundle` (the
browser bundle boots and renders), `check-share` (share links round-trip).

## Conventions

- Request definitions in `corereqs.js` return a `Buffer` built with `writeUInt*` (plus optional reply unpacker) — study a neighbouring request before adding one.
- Outbound I/O: `pack_stream.put(buf).submit(expectsReply)` via
  [`lib/framebuffer.js`](lib/framebuffer.js); length field must equal
  `buf.length / 4`. `submit()` marks the end of a request and lets the
  buffering policy decide when to write; `flush()` writes immediately and is
  for the handshake, `X.flush()` and connection teardown only.
- Extensions self-register: `X.require('name', cb)` loads `lib/ext/name.js`.
- Tests that talk to the server clean up after themselves (`X.terminate()`
  in `after`); leaked windows/clients make later files flaky.
