# Core protocol events

Reference for the 34 core protocol events as parsed by
[`lib/generated/core-events.js`](../lib/generated/core-events.js) (the
GenericEvent envelope is handled in [`lib/xcore.js`](../lib/xcore.js)). See
[README.md](README.md#listening-for-events) for the delivery model and
[core-requests.md](core-requests.md) for the requests mentioned here.
Exercised by [`test/core-events-extra.js`](../test/core-events-extra.js) and
others.

## Selecting events

Most events are only delivered when selected on a window via the `eventMask`
window attribute — either in `CreateWindow` values or with
`ChangeWindowAttributes`. Mask bits live on `x11.eventMask` (also
`X.eventMask`):

`KeyPress`, `KeyRelease`, `ButtonPress`, `ButtonRelease`, `EnterWindow`,
`LeaveWindow`, `PointerMotion`, `PointerMotionHint`, `Button1Motion` …
`Button5Motion`, `ButtonMotion`, `KeymapState`, `Exposure`,
`VisibilityChange`, `StructureNotify`, `ResizeRedirect`,
`SubstructureNotify`, `SubstructureRedirect`, `FocusChange`,
`PropertyChange`, `ColormapChange`, `OwnerGrabButton`.

```js
X.ChangeWindowAttributes(wid, {
    eventMask: x11.eventMask.Exposure | x11.eventMask.StructureNotify
});
X.on('event', ev => {
    if (ev.name === 'Expose') redraw(ev.wid);
});
```

GraphicsExposure/NoExposure are selected per GC (`graphicsExposures`),
MappingNotify and ClientMessage are delivered unconditionally, and
SelectionClear/SelectionRequest arrive at selection owners.

Every parsed event carries `type` (numeric event code), `name`, `seq`
(sequence number of the last request processed before the event; absent on
KeymapNotify) and the fields listed below. The client additionally attaches
`rawData`, the raw wire packet — 32 bytes for a core event, which can be
passed to `SendEvent` unchanged; longer for a GenericEvent, which cannot be
sent at all. Field lists below name only the event-specific fields.

## Building events to send

`x11.packEvent(event[, buffer])` is the inverse of the parsers: it turns an
event object — the same shape the events below describe — into the 32-byte
wire form [`SendEvent`](core-requests.md#sendeventdestination-propagate-eventmask-event)
expects. `SendEvent` calls it for you, so an object can be passed directly:

```js
X.SendEvent(wid, 0, 0, {
    name: 'ClientMessage',
    format: 32,
    wid: wid,
    message_type: WM_PROTOCOLS,
    data: [WM_DELETE_WINDOW, 0]
});
```

Every event on this page except GenericEvent can be packed — GenericEvent has
no fixed 32-byte form — and `x11.eventTypes` maps those 33 names to their
protocol numbers. The same function is on the client as `X.packEvent`. Notes
that apply to all of them:

- Fields left out are packed as zero, and unused bytes are always zero — what
  EWMH, XEmbed and XDND require of a sender.
- `seq` (bytes 2-3) and the `0x80` "synthetic" bit are the server's to fill
  in, so callers do not supply them; the server rewrites both for each
  recipient, so not even forwarding `rawData` verbatim delivers them intact.
  KeymapNotify is the exception that has no sequence number at all: its bytes
  1-31 are entirely payload.
- Out-of-range and negative values wrap to the width of their field rather
  than throwing, so a negative coordinate — or an XDND data word composed as
  `(x << 16) | y` — packs the way the wire encodes it.
- Passing a `buffer` packs into its first 32 bytes instead of allocating (they
  are zeroed first; the rest is untouched) and returns just those 32 bytes.
  It must be a Buffer of at least 32 bytes.
- Invalid input throws a `TypeError` rather than producing a packet the server
  rejects asynchronously: an unknown event name, a GenericEvent, an extension
  event that reuses a core event's name (the numeric `type` wins, and there is
  no packer for it), a ClientMessage `format` other than 8, 16 or 32, or more
  `data` values than the format holds.

ClientMessage has a shortcut, since it carries nearly every window-manager
conversation — see
[`SendClientMessage`](core-requests.md#sendclientmessagedestination-wid-message_type-format-data-eventmask-cb).

## Keyboard and pointer

### KeyPress (2)
Key went down while selected. Fields: `keycode`, `time`, `root`, `wid`,
`child`, `rootx`, `rooty`, `x`, `y`, `buttons` (modifier/button state mask),
`sameScreen`.

### KeyRelease (3)
Key went up. Same fields as KeyPress.

### ButtonPress (4)
Pointer button went down. Same fields as KeyPress; `keycode` holds the
button number.

### ButtonRelease (5)
Pointer button went up. Same fields as ButtonPress.

### MotionNotify (6)
Pointer moved. Same fields as KeyPress; `keycode` holds the detail
(0 Normal, 1 Hint when `PointerMotionHint` is selected).

### EnterNotify (7)
Pointer entered the window. Fields: `detail` (0 Ancestor, 1 Virtual,
2 Inferior, 3 Nonlinear, 4 NonlinearVirtual), `time`, `root`, `wid`,
`child`, `rootx`, `rooty`, `x`, `y`, `buttons`, `mode` (0 Normal, 1 Grab,
2 Ungrab), `sameScreenFocus` (bit 0 focus, bit 1 same-screen), plus a
legacy `values` array repeating the numeric fields.

### LeaveNotify (8)
Pointer left the window. Same fields as EnterNotify.

### FocusIn (9)
Window gained keyboard focus (`FocusChange` mask). Fields: `detail`, `wid`,
`mode` (0 Normal, 1 Grab, 2 Ungrab, 3 WhileGrabbed).

### FocusOut (10)
Window lost keyboard focus. Same fields as FocusIn.

### KeymapNotify (11)
Reports the full key state; sent right after every EnterNotify/FocusIn when
`KeymapState` is selected. Special shape: no `seq` field, and `keys` is a
31-byte Buffer covering keycodes 8–255 (the QueryKeymap bitmap minus its
first byte) — bit `k & 7` of byte `(k >> 3) - 1` is set for each pressed
keycode `k`.

## Exposure

### Expose (12)
A window region needs redrawing (`Exposure` mask). Fields: `wid`, `x`, `y`,
`width`, `height`, `count` (number of Expose events still to follow for
this window; 0 on the last one).

### GraphicsExposure (13)
A `CopyArea`/`CopyPlane` destination region could not be computed from the
source (GC has `graphicsExposures`). Fields: `drawable`, `x`, `y`, `width`,
`height`, `minorOpcode`, `count`, `majorOpcode` (62 CopyArea,
63 CopyPlane). Note the name is `GraphicsExposure` (the protocol spec calls
it GraphicsExpose).

### NoExposure (14)
The graphics-exposure-generating request completed without exposures.
Fields: `drawable`, `minorOpcode`, `majorOpcode`.

### VisibilityNotify (15)
Window visibility changed (`VisibilityChange` mask). Fields: `wid`, `state`
(0 Unobscured, 1 PartiallyObscured, 2 FullyObscured).

## Window structure

`StructureNotify` selects these for the window itself (delivered with
`event` = the window); `SubstructureNotify` selects them on a parent for
all its children (`event`/`parent` = the parent).

### CreateNotify (16)
Fields: `parent`, `wid`, `x`, `y`, `width`, `height`, `borderWidth`,
`overrideRedirect` (boolean).

### DestroyNotify (17)
Fields: `event`, `wid`.

### UnmapNotify (18)
Fields: `event`, `wid`, `fromConfigure` (boolean).

### MapNotify (19)
Fields: `event`, `wid`, `overrideRedirect` (boolean).

### MapRequest (20)
Another client called MapWindow on a child while `SubstructureRedirect` is
selected on the parent (window-manager redirect). Fields: `parent`, `wid`.

### ReparentNotify (21)
Fields: `event`, `wid`, `parent` (new parent), `x`, `y`, `overrideRedirect`
(boolean).

### ConfigureNotify (22)
Window geometry/stacking changed. Fields: `wid` (the event window), `wid1`
(the window that was configured — note the nonstandard name),
`aboveSibling`, `x`, `y`, `width`, `height`, `borderWidth`,
`overrideRedirect` (0/1, not boolean here).

### ConfigureRequest (23)
Redirected ConfigureWindow from another client (`SubstructureRedirect`).
Fields: `stackMode`, `parent`, `wid`, `sibling`, `x`, `y`, `width`,
`height`, `borderWidth`, `mask` (which values the client actually asked to
change).

### GravityNotify (24)
Child moved because its parent was resized and the child has a win-gravity.
Fields: `event`, `wid`, `x`, `y`.

### ResizeRequest (25)
Another client tried to resize the window while `ResizeRedirect` is
selected. Fields: `wid`, `width`, `height`.

### CirculateNotify (26)
Result of a CirculateWindow. Fields: `event`, `wid`, `place` (0 Top,
1 Bottom).

### CirculateRequest (27)
Redirected CirculateWindow (`SubstructureRedirect`). Same fields as
CirculateNotify.

## Properties, selections, colormaps

### PropertyNotify (28)
A property was changed or deleted (`PropertyChange` mask). Fields: `wid`,
`atom`, `time`, `state` (0 NewValue, 1 Deleted).

### SelectionClear (29)
This client lost selection ownership. Fields: `time`, `owner`, `selection`.

### SelectionRequest (30)
Another client called ConvertSelection on a selection this client owns —
answer by writing the property and sending a SelectionNotify via
`SendEvent`. Fields: `time`, `owner`, `requestor`, `selection`, `target`,
`property`.

### SelectionNotify (31)
Conversion finished (sent by the selection owner; `property` is 0 None on
failure). Fields: `time`, `requestor`, `selection`, `target`, `property`.

### ColormapNotify (32)
The window's colormap attribute changed or the colormap was
(un)installed (`ColormapChange` mask). Fields: `wid`, `colormap`, `new`
(1 when the attribute changed), `state` (0 Uninstalled, 1 Installed).

## Client communication & mappings

### ClientMessage (33)
Synthetic event from another client via `SendEvent`; never generated by the
server. Fields: `format` (8, 16 or 32), `wid`, `message_type` (atom),
`data` — an array of 20 bytes, 10 shorts or 5 longs depending on `format`.

### MappingNotify (34)
Keyboard, modifier or pointer mapping changed; sent to all clients. Fields:
`request` (0 Modifier, 1 Keyboard, 2 Pointer), `firstKeyCode`, `count`
(the affected keycode range, meaningful for `request` = 1).

### GenericEvent (35)
Envelope for extension events (X Generic Event extension; used by Present
and XInput 2). Variable length on the wire — the client frames it by its
length field and dispatches on the extension's major opcode via parsers in
`X.geEventParsers` (registered when the extension is required). Without a
registered parser the event is delivered as `{type: 35, seq, extension,
evtype, raw}` with `raw` the unparsed payload Buffer.
