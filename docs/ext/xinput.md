# XInputExtension (XInput) extension (partial)

Enumerates input devices beyond the core pointer/keyboard. Implements two
XI1 query requests plus the XI2 version handshake and device query; XI2
event selection/delivery is not implemented yet (see Notes).

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

## Events

None. XI2 events are GenericEvents ([ext/ge.md](ge.md)) but no parser is
registered in `X.geEventParsers` yet, and `XISelectEvents` is not
implemented, so device events cannot be selected or parsed through this
module (an unsolicited XI2 GenericEvent would surface as the generic
`{type: 35, extension, evtype, raw}` shape).

## Notes

- Not implemented: everything outside the four requests above — the XI1
  device open/grab/event family (OpenDevice, GrabDevice,
  SelectExtensionEvent, ...) and the rest of XI2 (XISelectEvents,
  XIGrabDevice, XIGetClientPointer, XIChangeHierarchy, passive grabs,
  properties, barriers, ...).
- Enums attached to the ext object:
  `XI.DeviceUse = {IsXPointer: 0, IsXKeyboard: 1, IsXExtensionDevice: 2,
  IsXExtensionKeyboard: 3, IsXExtensionPointer: 4}` (XI1),
  `XI.InputClass = {Key: 0, Button: 1, Valuator: 2, Feedback: 3,
  Proximity: 4, Focus: 5, Other: 6}` (XI1),
  `XI.DeviceType = {MasterPointer: 1, MasterKeyboard: 2, SlavePointer: 3,
  SlaveKeyboard: 4, FloatingSlave: 5}` (XI2),
  `XI.ClassType = {Key: 0, Button: 1, Valuator: 2, Scroll: 3, Touch: 8,
  Gesture: 9}` (XI2), plus `XI.AllDevices` = 0, `XI.AllMasterDevices` = 1.
- FP3232 fixed-point fields become plain JS numbers (53-bit mantissa:
  fine for input axes).
- Wire layouts are cross-checked against `X11/extensions/XIproto.h` and
  `XI2proto.h`.
