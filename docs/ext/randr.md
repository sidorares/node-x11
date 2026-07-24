# RANDR extension

Resize, rotate and reflect the screen, and inspect/configure the CRTCs,
outputs and modes behind it. This is the modern interface to multi-monitor
setups (see [ext/xinerama.md](xinerama.md) for the legacy view). All RANDR 1.3
requests are implemented (minor opcodes 0-31, except the deprecated 1.0
`OldGetScreenInfo`/`OldScreenChangeSelectInput` at 1 and 3).

- Module: `X.require('randr', cb)` (X name `RANDR`, protocol version 1.3)
- Source: [`lib/ext/randr.js`](../../lib/ext/randr.js) ·
  Tests: [`test/randr.js`](../../test/randr.js)
- Spec: [randrproto.txt](http://www.x.org/releases/X11R7.6/doc/randrproto/randrproto.txt)

```js
X.require('randr', (err, Randr) => {
    // you MUST negotiate the version you intend to use before other
    // requests, otherwise the server may not behave as expected
    Randr.QueryVersion(1, 3, (err, version) => {
        Randr.GetScreenResources(root, (err, res) => {
            Randr.GetOutputInfo(res.outputs[0], 0, (err, info) => {
                // info.name, info.connection, info.modes, ...
            });
        });
    });
});
```

`X.require` calls `QueryVersion(255, 255)` automatically and stores the
result as `Randr.major_version` / `Randr.minor_version`. Despite that, call
`QueryVersion` yourself with the version you actually target before issuing
other requests (see Notes).

## Requests

### QueryVersion(clientMajor, clientMinor, cb)
Negotiates the protocol version. `cb(err, [major, minor])` — the version the
server will speak to this client.

### SetScreenConfig(win, timestamp, configTimestamp, sizeId, rotation, rate, cb)
RANDR 1.0-style screen configuration: pick size `sizeId` from
`GetScreenInfo().screens`, a `rotation` (`Randr.Rotation` bit) and refresh
`rate`. `cb(err, {status, newTs, configTs, root, subpixelOrder})`. When the
server answers with a non-zero `status`, `err` is an `Error` with
`err.code` set to the status (`Randr.ConfigStatus`) and the reply object is
still passed as the second argument.

### SelectInput(win, mask)
Selects RANDR event delivery for `win`; `mask` is a bitwise OR of
`Randr.NotifyMask` values. No reply. Note that only `RRScreenChangeNotify`
has an event parser (see Events).

### GetScreenInfo(win, cb)
1.0-style screen state. `cb(err, info)` with

```js
{
  rotations,          // bitmask of supported Rotation values
  root, timestamp, config_timestamp,
  sizeID,             // index into screens of the current size
  rotation, rate,     // current rotation and refresh rate
  screens,            // [{px_width, px_height, mm_width, mm_height}, ...]
  rates               // flat CARD16 rate-info entries, as on the wire:
                      // for each size a count followed by that many rates
}
```

### GetScreenSizeRange(win, cb)
`cb(err, {minWidth, minHeight, maxWidth, maxHeight})` — the sizes accepted by
`SetScreenSize`.

### SetScreenSize(win, width, height, mmWidth, mmHeight)
Sets the screen size; `width`/`height` in pixels, `mmWidth`/`mmHeight` in
millimeters. No reply.

### GetScreenResources(win, cb)
`cb(err, resources)` with

```js
{
  timestamp, config_timestamp,
  crtcs,      // [crtc, ...] XIDs
  outputs,    // [output, ...] XIDs
  modeinfos   // [{id, width, height, dot_clock, h_sync_start, h_sync_end,
              //   h_total, h_skew, v_sync_start, v_sync_end, v_total,
              //   name_len, modeflags, name}, ...]
}
```

May force a hardware re-probe; prefer `GetScreenResourcesCurrent` when stale
data is acceptable.

### GetOutputInfo(output, configTimestamp, cb)
`cb(err, info)` with

```js
{
  timestamp, crtc,
  mm_width, mm_height,
  connection,        // Randr.Connection value
  subpixelOrder,
  preferredModes,    // count: the first N entries of modes are preferred
  crtcs,             // [crtc, ...] usable with this output
  modes,             // [mode, ...] mode XIDs (match modeinfos ids)
  clones,            // [output, ...] outputs sharing this one's wiring
  name               // e.g. 'HDMI-1'
}
```

### ListOutputProperties(output, cb)
`cb(err, atoms)` — array of property name atoms defined on `output`.

### QueryOutputProperty(output, property, cb)
`cb(err, {pending, range, immutable, validValues})` — booleans plus an array
of INT32: a `[min, max]` pair when `range` is true, otherwise the list of
valid values.

### ConfigureOutputProperty(output, property, pending, range, values)
Sets the property's valid values (`[min, max]` when `range` is truthy, else a
list) and whether changes are `pending` until the next `SetCrtcConfig`.
`values` is an array of INT32. No reply.

### ChangeOutputProperty(output, property, type, format, mode, data)
Sets property contents. `type` is an atom, `format` 8/16/32, `mode` 0
replace / 1 prepend / 2 append. `data` may be a Buffer (raw bytes), an array
of numbers (one per format unit) or a string (latin1). No reply.

### DeleteOutputProperty(output, property)
Deletes the property. No reply. A subsequent `QueryOutputProperty` yields a
BadName error.

### GetOutputProperty(output, property, type, longOffset, longLength, del, pending, cb)
Like core `GetProperty` but for outputs; `longOffset`/`longLength` are in
4-byte units, `del` deletes after reading, `pending` reads the pending value.
`cb(err, {format, type, bytesAfter, numItems, data})` — `data` is a Buffer of
`numItems` format-sized items.

### CreateMode(win, modeInfo, cb)
Registers a user mode line. `modeInfo` is `{width, height, dot_clock,
h_sync_start, h_sync_end, h_total, h_skew, v_sync_start, v_sync_end,
v_total, modeflags, name}` — all except `width`/`height`/`name` default to 0
and the mode XID is chosen by the server. `cb(err, mode)`. Some servers
refuse user modes with a RANDR error.

### DestroyMode(mode)
Destroys a user mode not in use by any output. No reply.

### AddOutputMode(output, mode)
Adds a user mode to the output's mode list. No reply.

### DeleteOutputMode(output, mode)
Removes a user mode from the output's mode list. No reply.

### GetCrtcInfo(crtc, configTimestamp, cb)
`cb(err, info)` with

```js
{
  status,             // Randr.ConfigStatus
  timestamp, x, y, width, height,
  mode,               // current mode XID, 0 when disabled
  rotation,           // current rotation
  rotations,          // bitmask of supported rotations
  output,             // [output, ...] currently driven (note: singular name)
  possible            // [output, ...] connectable to this crtc
}
```

### SetCrtcConfig(crtc, timestamp, configTimestamp, x, y, mode, rotation, outputs, cb)
Applies a crtc configuration; `outputs` is an array of output XIDs, `mode` 0
with `outputs` `[]` disables the crtc. `cb(err, {status, timestamp})`; a
non-Success status is reported in `status` (not converted to an error).

### GetCrtcGammaSize(crtc, cb)
`cb(err, size)` — length of the gamma ramps (0 when unsupported).

### GetCrtcGamma(crtc, cb)
`cb(err, {size, red, green, blue})` — three arrays of `size` CARD16 values.

### SetCrtcGamma(crtc, red, green, blue)
Sets the gamma ramps; three equal-length arrays of CARD16, length must equal
`GetCrtcGammaSize`. No reply.

### GetScreenResourcesCurrent(win, cb)
Same reply shape as `GetScreenResources` but returns the server's current
idea of the configuration without forcing a re-probe.

### SetCrtcTransform(crtc, transform, filterName, filterParams)
Sets the pending crtc transform. `transform` is an array of 9 JS numbers (a
3x3 row-major matrix) converted to 16.16 FIXED on the wire — values are
rounded to the nearest 1/65536. `filterName` is a string (e.g. `'bilinear'`,
may be `''`), `filterParams` an array of numbers (also FIXED on the wire).
No reply. On crtcs without transform support the server answers BadValue.

### GetCrtcTransform(crtc, cb)
`cb(err, info)` with

```js
{
  pendingTransform,   // [9 numbers], FIXED converted back to floats
  hasTransforms,      // boolean: crtc supports transforms
  currentTransform,   // [9 numbers]
  pendingFilter,      // string
  pendingParams,      // [numbers]
  currentFilter,
  currentParams
}
```

### GetPanning(crtc, cb)
`cb(err, {status, timestamp, left, top, width, height, trackLeft, trackTop,
trackWidth, trackHeight, borderLeft, borderTop, borderRight,
borderBottom})`.

### SetPanning(crtc, timestamp, panning, cb)
`panning` is an object with the same fields `GetPanning` returns (the
`status`/`timestamp` fields are ignored on input). `cb(err, {status,
timestamp})`. Servers without a panning hook (e.g. Xvfb) answer with a RANDR
error.

### SetOutputPrimary(win, output)
Marks `output` as primary; `output` 0 (None) clears it. No reply.

### GetOutputPrimary(win, cb)
`cb(err, output)` — the primary output XID, 0 when none is set.

## Events

### RRScreenChangeNotify
Delivered after `SelectInput` with `NotifyMask.ScreenChange` whenever the
screen configuration changes. Parsed fields: `name`
(`'RRScreenChangeNotify'`), `type`, `seq`, `rotation` (new rotation, from the
event detail byte), `time`, `configtime`, `root`, `requestWindow`, `sizeId`,
`subpixelOrder`, `width`, `height`, `physWidth`, `physHeight`, `raw`
(Buffer).

The 1.2 `RRNotify` event (crtc/output/property sub-events selected via
`CrtcChange`/`OutputChange`/`OutputProperty` masks) has no parser; only
`ScreenChange` events arrive in usable form.

## Notes

- Version negotiation matters: the server tailors behavior (and some
  requests only work) after the client announces the version it speaks.
  `X.require` announces 255.255; the test suite explicitly re-negotiates
  with `QueryVersion(1, 2, ...)` before touching resources — do the same
  with the version you target.
- 16.16 FIXED: crtc transforms and filter parameters travel as 32-bit fixed
  point (value × 65536). The module converts to/from JS numbers for you;
  expect quantization to multiples of 1/65536 on read-back.
- Enums attached to the extension object:
  - `Randr.NotifyMask = {ScreenChange: 1, CrtcChange: 2, OutputChange: 4,
    OutputProperty: 8, All: 15}`
  - `Randr.Rotation = {Rotate_0: 1, Rotate_90: 2, Rotate_180: 4,
    Rotate_270: 8, Reflect_X: 16, Reflect_Y: 32}` (bitmask)
  - `Randr.ConfigStatus = {Success: 0, InvalidConfigTime: 1, InvalidTime: 2,
    Failed: 3}`
  - `Randr.Connection = {Connected: 0, Disconnected: 1, Unknown: 2}`
  - `Randr.ModeFlag = {HSyncPositive: 1, HSyncNegative: 2, ...,
    ClockDivideBy2: 8192}` (mode timing flags bitmask)
- `GetCrtcInfo` names its list of driven outputs `output` (singular);
  `SetCrtcConfig` accepts it directly (`info.output`).
- Mode name strings are concatenated without separators on the wire; the
  unpacker splits them using each mode's `name_len`.
