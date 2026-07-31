# XInputExtension (XInput) extension (partial)

Enumerates input devices beyond the core pointer/keyboard, and selects and
delivers XI2 device events — the only way to get smooth scrolling, touch,
tablet pressure or per-device input, since the core protocol flattens all of
it into button 4/5 presses on one virtual pointer.

- Module: `X.require('xinput', cb)` (X name `XInputExtension`; XI2 2.2
  announced, XI1 version reported by the server)
- Source: [`lib/ext/xinput.js`](../../lib/ext/xinput.js) ·
  Tests: [`test/xinput.js`](../../test/xinput.js)
- Spec: [XIproto.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/inputproto/XIproto.txt)
  (XI2: [XI2proto.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/inputproto/XI2proto.txt))

```js
X.require('xinput', (err, XI) => {
    XI.XIQueryDevice(XI.AllDevices, (err, devices) => {
        devices.forEach(dev => {
            // {deviceId, use, attachment, enabled, name, classes}
            console.log(dev.deviceId, dev.name);
        });
    });
});
```

`X.require` first announces XI2 support with `XIQueryVersion(2, 2)` —
result in `XI.xi2` (`{majorVersion, minorVersion}`, or `null` on a pre-XI2
server, which remains usable for the XI1 requests) — then fetches the XI1
version into `XI.serverMajor` / `XI.serverMinor`.

## Requests

### GetExtensionVersion(cb)
XI1 (opcode 1). `cb(err, {serverMajor, serverMinor, present})` — the XI1
version; `present` is 1 when the extension is available. Called
automatically by `X.require`.

### ListInputDevices(cb)
XI1 (opcode 2). `cb(err, devices)` — array of
`{type, id, numClasses, use, attached, classes, name}`. `type` is an atom
(device type, often 0), `use` a `XI.DeviceUse` value, `attached` the id of
the attached master (XI2 servers). `classes` is an array of
`{classId, ...}` where `classId` is a `XI.InputClass` value:

- `Key` → `{minKeycode, maxKeycode, numKeys}`
- `Button` → `{numButtons}`
- `Valuator` → `{mode, motionBufferSize, axes: [{resolution, min, max}]}`
- other classes → `{classId}` only

### XIQueryVersion(clientMajor, clientMinor, cb)
XI2 (opcode 47). Announces the client's supported XI2 version; must precede
any other XI2 request. `cb(err, {majorVersion, minorVersion})` — what the
server will speak. Called automatically by `X.require` with (2, 2).

### XIQueryDevice(deviceId, cb)
XI2 (opcode 48). `deviceId` is a device id, or `XI.AllDevices` (0) /
`XI.AllMasterDevices` (1). `cb(err, devices)` — array of
`{deviceId, use, attachment, enabled, name, classes}`. `use` is a
`XI.DeviceType` value; `attachment` is the paired master (for master
devices) or the master a slave is attached to. `classes` is an array of
`{type, sourceId, ...}` where `type` is a `XI.ClassType` value:

- `Key` → `{keycodes}` (array of keycodes)
- `Button` → `{numButtons, state, labels}` (`state` — array of 32-bit mask
  words, `labels` — array of atoms, one per button)
- `Valuator` → `{number, label, min, max, value, resolution, mode}`
  (min/max/value are FP3232 fixed point converted to Number)
- `Scroll` → `{number, scrollType, flags, increment}`
- `Touch`/`Gesture` → `{type, sourceId}` only (no per-class fields parsed)

### XISelectEvents(window, masks)
XI2 (opcode 46). Void. Selects which XI2 events this client wants on
`window`, per device. `masks` is one entry, or an array of them:

```js
XI.XISelectEvents(root, {
    deviceId: XI.AllMasterDevices,
    mask: XI.EventMask.RawMotion | XI.EventMask.ButtonPress
});

// event type names work too
XI.XISelectEvents(wid, { deviceId: pointerId, mask: ['Motion', 'ButtonPress'] });

// several devices in one request
XI.XISelectEvents(root, [
    { deviceId: pointerId,  mask: XI.EventMask.RawMotion },
    { deviceId: keyboardId, mask: XI.EventMask.RawKeyPress }
]);
```

Selecting **replaces** this client's selection for that device on that
window rather than adding to it, so `mask: 0` deselects. The device is part
of the key: a selection on `AllMasterDevices` does not clear one made on a
specific device id.

## Events

XI2 events are GenericEvents ([ext/ge.md](ge.md)), delivered on the client's
`'event'` emitter once `X.require('xinput')` has registered the parser. Each
carries `type` 35, `evtype` (an `XI.EventType` value) and `name` — the event
type prefixed with `XI`, e.g. `XIRawMotion`.

**Device events** — `XIKeyPress`, `XIKeyRelease`, `XIButtonPress`,
`XIButtonRelease`, `XIMotion`, `XITouchBegin`, `XITouchUpdate`,
`XITouchEnd`:

| field | meaning |
|---|---|
| `deviceId`, `sourceId` | the master device, and the physical device behind it |
| `time` | server timestamp |
| `detail` | keycode, button number, or touch id |
| `root`, `wid`, `child` | root, event and child windows |
| `rootx`, `rooty`, `x`, `y` | FP1616 coordinates as Numbers |
| `buttons` | array of button numbers currently down |
| `valuators` | `{axisNumber: value}` for the axes this event carries |
| `mods`, `group` | `{base, latched, locked, effective}` |
| `flags` | e.g. `XI.KeyEventFlags.KeyRepeat`, `XI.PointerEventFlags.PointerEmulated` |

`buttons` is the state **before** the event, the same convention core X uses
for its `state` field: an `XIButtonPress` does not yet list its own button,
and the matching `XIButtonRelease` still does.

`valuators` holds only the axes that moved — a scroll wheel reports its own
axis and nothing else — so test for a key rather than indexing blindly.
Which axis is which comes from the device's `Valuator` and `Scroll` classes
in `XIQueryDevice`; a `Scroll` class names the axis that carries smooth
scrolling and the `increment` that counts as one click.

**Raw events** — `XIRawKeyPress`, `XIRawKeyRelease`, `XIRawButtonPress`,
`XIRawButtonRelease`, `XIRawMotion`, `XIRawTouchBegin`, `XIRawTouchUpdate`,
`XIRawTouchEnd` — come straight from the device, are only delivered to
selections on the **root** window, and have no window or coordinates. They
carry `deviceId`, `sourceId`, `time`, `detail`, `flags`, plus two axis maps:
`valuators` (after the pointer acceleration curve) and `rawValuators` (the
device's own numbers, which is what a wheel's increment shows up in).

**Everything else** — `XIDeviceChanged`, `XIEnter`, `XILeave`, `XIFocusIn`,
`XIFocusOut`, `XIHierarchyChanged`, `XIPropertyEvent`, `XITouchOwnership`,
`XIBarrierHit`, `XIBarrierLeave` — is delivered with `deviceId`, `time` and
the undecoded body in `data`. Those layouts are not parsed yet.

## Notes

- Not implemented: the XI1 device open/grab/event family (OpenDevice,
  GrabDevice, SelectExtensionEvent, ...) and the rest of XI2 (XIGrabDevice,
  XIGetClientPointer, XIChangeHierarchy, passive grabs, properties,
  barriers, ...), plus the event bodies listed as undecoded above.
- Enums attached to the ext object:
  `XI.DeviceUse = {IsXPointer: 0, IsXKeyboard: 1, IsXExtensionDevice: 2,
  IsXExtensionKeyboard: 3, IsXExtensionPointer: 4}` (XI1),
  `XI.InputClass = {Key: 0, Button: 1, Valuator: 2, Feedback: 3,
  Proximity: 4, Focus: 5, Other: 6}` (XI1),
  `XI.DeviceType = {MasterPointer: 1, MasterKeyboard: 2, SlavePointer: 3,
  SlaveKeyboard: 4, FloatingSlave: 5}` (XI2),
  `XI.ClassType = {Key: 0, Button: 1, Valuator: 2, Scroll: 3, Touch: 8,
  Gesture: 9}` (XI2), plus `XI.AllDevices` = 0, `XI.AllMasterDevices` = 1.
  For events: `XI.EventType` (the `evtype` numbers, `DeviceChanged` 1 through
  `BarrierLeave` 26), `XI.EventMask` (the same names as `1 << evtype`, for
  `XISelectEvents`), and the `flags` bits `XI.KeyEventFlags`,
  `XI.PointerEventFlags`, `XI.TouchEventFlags`.
- FP3232 and FP1616 fixed-point fields become plain JS numbers (53-bit
  mantissa: fine for input axes).
- Wire layouts are cross-checked against `X11/extensions/XIproto.h` and
  `XI2proto.h`.
