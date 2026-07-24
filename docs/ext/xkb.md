# XKEYBOARD (XKB) extension (partial)

Advanced keyboard control: modifier/group state, controls (repeat timings,
AccessX), named bells, and keyboard component names. Only a subset of the
44-request protocol is implemented; notably the keymap requests (GetMap and
the Set* siblings) are not (see Notes).

- Module: `X.require('xkb', cb)` (X name `XKEYBOARD`, version 1.0 requested)
- Source: [`lib/ext/xkb.js`](../../lib/ext/xkb.js) ·
  Tests: [`test/xkb.js`](../../test/xkb.js)
- Spec: [xkbproto.txt](https://xorg.freedesktop.org/releases/X11R7.7/doc/kbproto/xkbproto.txt)

```js
X.require('xkb', (err, Xkb) => {
    Xkb.GetState(Xkb.UseCoreKbd, (err, state) => {
        // state.group — current keyboard layout group (0-3)
    });
    // ring the bell as an event only (silent), watch for it
    Xkb.SelectEvents(Xkb.UseCoreKbd, Xkb.EventType.BellNotify, 0,
        Xkb.EventType.BellNotify, 0, 0);
    Xkb.Bell(Xkb.UseCoreKbd, Xkb.DfltXIClass, Xkb.DfltXIId,
        50, 0, 1, 440, 10, 0, 0);
});
```

`X.require` performs the mandatory `UseExtension` handshake and exposes the
result as `Xkb.supported` (1/0), `Xkb.serverMajor`, `Xkb.serverMinor`.

## Requests

Implemented: UseExtension (0), SelectEvents (1), Bell (3), GetState (4),
LatchLockState (5), GetControls (6), GetNames (17). Everything else is not
(see Notes). All device-taking requests accept a DeviceSpec: a device id or
one of the shorthands `Xkb.UseCoreKbd` (0x100), `Xkb.UseCorePtr` (0x200).

### UseExtension(wantedMajor, wantedMinor, cb)
Must be the first XKB request a client issues; `X.require` calls it with
(1, 0). `cb(err, {supported, serverMajor, serverMinor})` — `supported` is
1 when the server accepts the client's version.

### SelectEvents(deviceSpec, affectWhich, clear, selectAll, affectMap, map, details)
No reply. Selects XKB events (masks of `Xkb.EventType`). For every bit in
`affectWhich & ~clear & ~selectAll` an `[affect, details]` pair must be
supplied in the `details` object, keyed by lowerCamel event name (e.g.
`{stateNotify: [0x3fff, 0x3fff]}`); a missing pair throws. Bits in `clear`
or `selectAll` need no pair, so the common "select everything about these
events" call is simply `SelectEvents(deviceSpec, mask, 0, mask, 0, 0)`, and
deselecting is `SelectEvents(deviceSpec, mask, mask, 0, 0, 0)`. MapNotify
(bit 1) is controlled by `affectMap`/`map` (masks of map component parts),
not by the details switch.

### Bell(deviceSpec, bellClass, bellID, percent, forceSound, eventOnly, pitch, duration, name, window)
No reply. Rings a named bell. `bellClass`/`bellID` select the bell feedback
(`Xkb.DfltXIClass`/`Xkb.DfltXIId` for the default); `percent` is signed
volume -100..100; `forceSound` (bool) rings even if audible bell is
disabled, `eventOnly` (bool) sends only the BellNotify event; `pitch`/
`duration` are signed (-1/-1 picks the bell control defaults, as in
test/xkb.js); `name` is an atom or 0, `window` a window or 0.

### GetState(deviceSpec, cb)
`cb(err, state)` — `{deviceID, mods, baseMods, latchedMods, lockedMods,
group, lockedGroup, baseGroup, latchedGroup, compatState, grabMods,
compatGrabMods, lookupMods, compatLookupMods, ptrBtnState}`. Mod fields are
`Xkb.ModMask` masks; group fields are 0-3.

### LatchLockState(deviceSpec, affectModLocks, modLocks, lockGroup, groupLock, affectModLatches, modLatches, latchGroup, groupLatch)
No reply. Locks/latches modifiers and groups. `affectModLocks`/`modLocks`
and `affectModLatches`/`modLatches` are mask/value pairs of `Xkb.ModMask`;
`lockGroup`/`latchGroup` are booleans enabling `groupLock` (0-3) and the
signed `groupLatch`. Example — lock CapsLock:
`LatchLockState(Xkb.UseCoreKbd, Xkb.ModMask.Lock, Xkb.ModMask.Lock, false, 0, 0, 0, false, 0)`.

### GetControls(deviceSpec, cb)
`cb(err, ctrls)` — `{deviceID, mouseKeysDfltBtn, numGroups, groupsWrap,
internalModsMask, ignoreLockModsMask, internalModsRealMods,
ignoreLockModsRealMods, internalModsVmods, ignoreLockModsVmods,
repeatDelay, repeatInterval, slowKeysDelay, debounceDelay, mouseKeysDelay,
mouseKeysInterval, mouseKeysTimeToMax, mouseKeysMaxSpeed, mouseKeysCurve,
accessXOption, accessXTimeout, accessXTimeoutOptionsMask,
accessXTimeoutOptionsValues, accessXTimeoutMask, accessXTimeoutValues,
enabledControls, perKeyRepeat}`. Times are in milliseconds; `perKeyRepeat`
is a 32-element byte array (keycode bitmap).

### GetNames(deviceSpec, which, cb)
`which` is a mask of `Xkb.NameDetail`. `cb(err, names)` — always contains
`{deviceID, which, minKeyCode, maxKeyCode, nTypes, groupNames, virtualMods,
firstKey, nKeys, indicators, nRadioGroups, nKeyAliases, nKTLevels}`, plus
per requested bit (values are atoms unless noted — resolve with
`X.GetAtomName`):

- `Keycodes` → `keycodesName`, `Geometry` → `geometryName`,
  `Symbols` → `symbolsName`, `PhysSymbols` → `physSymbolsName`,
  `Types` → `typesName`, `Compat` → `compatName`
- `KeyTypeNames` → `typeNames` (array of atoms)
- `KTLevelNames` → `nLevelsPerType` (array of counts) and `ktLevelNames`
  (flat array of atoms)
- `IndicatorNames` → `indicatorNames`, `VirtualModNames` →
  `virtualModNames`, `GroupNames` → `groupNamesList` (arrays of atoms,
  one per set bit in `indicators`/`virtualMods`/`groupNames`)
- `KeyNames` → `keyNames` (array of `nKeys` 4-char strings like `'AE01'`,
  NUL-trimmed, starting at keycode `firstKey`)
- `KeyAliases` → `keyAliases` (array of `{real, alias}` strings)
- `RGNames` → `radioGroupNames` (array of atoms)

## Events

XKB multiplexes all its events on one event code; the wire "detail" byte is
exposed as `event.xkbType` (`Xkb.events = {StateNotify: 2, BellNotify: 8}`).
Common fields: `type`, `seq`, `xkbType`, `time`, `deviceID`.

### XkbStateNotify (xkbType 2)
Keyboard state changed. Extra fields: `mods`, `baseMods`, `latchedMods`,
`lockedMods`, `group`, `baseGroup`, `latchedGroup`, `lockedGroup`,
`compatState`, `grabMods`, `compatGrabMods`, `lookupMods`,
`compatLookupMods`, `ptrBtnState`, `changed` (mask of what changed),
`keycode`, `eventType`, `requestMajor`, `requestMinor`.

### XkbBellNotify (xkbType 8)
A bell rang (or `eventOnly` was requested). Extra fields: `bellClass`,
`bellID`, `percent`, `pitch`, `duration`, `atomName` (atom or 0), `window`,
`eventOnly` (0/1).

Other selected XKB events are delivered unparsed as `XkbEvent` with the
body in `event.raw`.

## Notes

- NOT implemented: GetMap (8) and the Set*/keymap family, plus every other
  request not listed above (GetDeviceInfo, GetCompatMap, indicator/geometry
  requests, ...). GetMap in particular is notoriously complex (dozens of
  interdependent variable-length sections) and is skipped deliberately; use
  core `GetKeyboardMapping` for keysym lookup.
- DeviceSpec/BellClassSpec/IDSpec shorthands on the ext object:
  `UseCoreKbd` 0x100, `UseCorePtr` 0x200, `DfltXIClass` 0x300, `DfltXIId`
  0x400, `AllXIClass` 0x500, `AllXIId` 0x600, `XINone` 0xff00.
- `Xkb.ModMask = {Shift: 1, Lock: 2, Control: 4, Mod1: 8, Mod2: 16,
  Mod3: 32, Mod4: 64, Mod5: 128}`; `Xkb.EventType` has the 12 event bits
  (NewKeyboardNotify 1<<0 ... ExtensionDeviceNotify 1<<11); `Xkb.NameDetail`
  has the 14 GetNames bits (Keycodes 1<<0 ... RGNames 1<<13).
- Wire layouts are cross-checked against `X11/extensions/XKBproto.h`;
  xcb-proto's xkb.xml omits the modLatches byte of LatchLockState, so xcb
  is not a reliable reference here.
- GetNames value-list order matches the server's write order, which is NOT
  ascending bit order for the last groups (VirtualModNames and GroupNames
  are written before KeyNames/KeyAliases despite their higher bits).
