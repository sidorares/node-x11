# Apple-WM extension

XQuartz-specific extension letting an X11 window manager cooperate with the
macOS native environment: draw Aqua-style window frames, control window
levels relative to native apps, and receive notifications from the
X11.app controller (menu commands, app activation, pasteboard). Only
available on the XQuartz server on macOS.

- Module: `X.require('apple-wm', cb)` (X name `Apple-WM`)
- Source: [`lib/ext/apple-wm.js`](../../lib/ext/apple-wm.js)
- Spec: [AppleWM.3 man page](http://www.xfree86.org/current/AppleWM.3.html),
  [applewm.c (XQuartz server)](https://opensource.apple.com/source/X11server/X11server-106.3/Xquartz/xorg-server-1.10.2/hw/xquartz/applewm.c)

```js
X.require('apple-wm', (err, AppleWM) => {
    AppleWM.QueryVersion((err, [major, minor, patch]) => {});
    AppleWM.SelectInput(AppleWM.NotifyMask.All);
    AppleWM.SetWindowLevel(win, AppleWM.WindowLevel.Floating);
    X.on('event', ev => {
        if (ev.name === 'AppleWMControllerNotify' &&
            ev.type === AppleWM.EventKind.Controller.CloseWindow) {
            // user picked Close from the native menu
        }
    });
});
```

No version negotiation happens during `require`; call `QueryVersion`
yourself if needed.

Frame requests take two rectangles describing the window: the inner
(client) rect `ix, iy, iw, ih` and the outer (frame) rect
`ox, oy, ow, oh`, all as unsigned 16-bit values.

## Requests

Listed in minor opcode order.

### QueryVersion(cb)
Minor opcode 0. `cb(err, [major, minor, patch])` — extension version.

### FrameGetRect(frameClass, frameRect, ix, iy, iw, ih, ox, oy, ow, oh, cb)
Minor opcode 1. Computes the geometry of a frame part for a window with the
given inner/outer rects. `frameClass` is a `FrameClass` value, `frameRect`
a `FrameRect` value (Titlebar/Tracking/Growbox).
`cb(err, {x, y, w, h})` — the requested part's rectangle.

### FrameHitTest(frameClass, px, py, ix, iy, iw, ih, ox, oy, ow, oh, cb)
Minor opcode 2. Hit-tests point `px, py` against the frame of a window with
the given rects. `cb(err, hit)` — numeric hit-test result (0 when no frame
part is hit).

### FrameDraw(screen, window, frameClass, attr, ix, iy, iw, ih, ox, oy, ow, oh, title)
Minor opcode 3. Draws a native-styled frame for `window` on `screen`.
`frameClass` is a `FrameClass` value, `attr` a bitmask of `FrameAttr`
flags, `title` the titlebar string. No reply.

### DisableUpdate(screen)
Minor opcode 4. Temporarily suppresses compositing updates for `screen`
(default 0) while a batch of drawing happens. Pair with `ReenableUpdate`.
No reply.

### ReenableUpdate(screen)
Minor opcode 5. Re-enables updates suppressed by `DisableUpdate`. No reply.

### SelectInput(mask)
Minor opcode 6. Selects which Apple-WM notification events this client
receives; `mask` is a bitmask of `NotifyMask` values. No reply.

### SetWindowMenuCheck(index)
Minor opcode 7. Places the checkmark on item `index` (0-based) of the
X11.app Window menu previously set with `SetWindowMenu`. No reply.

### SetFrontProcess()
Minor opcode 8. Asks macOS to bring the X server (XQuartz) to the front,
above native applications. No arguments, no reply.

### SetWindowLevel(window, level)
Minor opcode 9. Places `window` in one of the native window layers;
`level` is a `WindowLevel` value. No reply.

### CanQuit(state)
Minor opcode 10. Tells the server whether it may quit (non-zero `state` =
the window manager consents; the server asks via the controller events
before quitting). No reply.

### SetWindowMenu(items)
Minor opcode 11. Replaces the window-manager section of the X11.app Window
menu. `items` is an array where each element is either a plain string label
or a `[shortcut, label]` pair (`shortcut` a single ASCII character used as
the Cmd-key equivalent). No reply.

### SendPSN(hi, lo)
Minor opcode 12. Sends the window manager's macOS Process Serial Number
(64 bits as two 32-bit halves) to the server. No reply.

### AttachTransient(child, parent)
Minor opcode 13. Marks window `child` as a transient attached to `parent`
(sheet-like native behavior). Pass `parent = 0` to detach. No reply.

## Events

Enable delivery with `SelectInput`. All three events share one parsed
shape: `{name, type, time, arg}` where `name` is the event name below,
`type` is the kind code (see `EventKind`), `time` is the server timestamp
and `arg` is a kind-specific 32-bit argument (e.g. the window id for
per-window controller actions).

### AppleWMControllerNotify
First event + 0, selected by `NotifyMask.Controller`. Sent when the user
drives X11 windows from the native side. `type` is one of
`EventKind.Controller`: `MinimizeWindow` 0, `ZoomWindow` 1, `CloseWindow`
2, `BringAllToFront` 3, `WideWindow` 4, `HideAll` 5, `ShowAll` 6,
`WindowMenuItem` 9, `WindowMenuNotify` 10, `NextWindow` 11,
`PreviousWindow` 12.

### AppleWMActivationNotify
First event + 1, selected by `NotifyMask.Activation`. X11.app gained or
lost the native foreground. `type` is one of `EventKind.Activation`:
`IsActive` 0, `IsInactive` 1, `ReloadPreferences` 2.

### AppleWMPasteboardNotify
First event + 2, selected by `NotifyMask.Pasteboard`. `type` is
`EventKind.Pasteboard.CopyToPasteboard` (0) — the server wants the current
selection copied to the macOS pasteboard.

## Notes

Enums attached to the extension object:

- `AppleWM.FrameRect = {Titlebar: 1, Tracking: 2, Growbox: 3}`
- `AppleWM.FrameClass = {DecorLarge: 1, DecorSmall: 16, Managed: 1<<15,
  Transient: 1<<16, Stationary: 1<<17}` (plus Reserved* placeholder bits)
- `AppleWM.FrameAttr = {Active: 1, Urgent: 2, Title: 4, Prelight: 8,
  Shaded: 16, CloseBox: 0x100, Collapse: 0x200, Zoom: 0x400,
  CloseBoxClicked: 0x800, CollapseBoxClicked: 0x1000,
  ZoomBoxClicked: 0x2000, GrowBox: 0x4000}`
- `AppleWM.NotifyMask = {Controller: 1, Activation: 2, Pasteboard: 4,
  All: 7}`
- `AppleWM.WindowLevel = {Normal: 0, Floating: 1, TornOff: 2, Dock: 3,
  Desktop: 4}`
- `AppleWM.EventKind = {Controller: {...}, Activation: {...},
  Pasteboard: {...}}` (values listed under Events above)

Requires XQuartz; on any other server `X.require('apple-wm', cb)` calls
back with an "extension not available" error.
