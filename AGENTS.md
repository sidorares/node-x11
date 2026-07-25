# node-x11 — agent notes

Pure-JavaScript X11 protocol client (and rudimentary server) for Node.js.
No build step, no transpilation: `lib/` is what ships.

## Hard rules

- **Zero runtime dependencies.** `dependencies` in package.json must stay empty;
  new packages go to `devDependencies` only, and only when clearly justified.
- The public API is callback-based (`createClient(cb)`, `X.SomeRequest(args, cb)`).
  Don't convert it to promises/async — that's a breaking change out of scope.
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

## Conventions

- Request definitions in `corereqs.js` return a `Buffer` built with `writeUInt*` (plus optional reply unpacker) — study a neighbouring request before adding one.
- Outbound I/O: `pack_stream.put(buf).flush()` via [`lib/framebuffer.js`](lib/framebuffer.js); length field must equal `buf.length / 4`.
- Extensions self-register: `X.require('name', cb)` loads `lib/ext/name.js`.
- Tests that talk to the server clean up after themselves (`X.terminate()`
  in `after`); leaked windows/clients make later files flaky.
