---
title: Events
sidebar_position: 3
---

# Events

## Selecting events with eventMask

The X server only delivers the events you ask for. You opt in per window
with an *event mask* — a bitwise OR of flags from `x11.eventMask` — either
at window creation time or later with `ChangeWindowAttributes`:

```js
const x11 = require('x11');

x11.createClient((err, display) => {
  const X = display.client;
  const wid = X.AllocID();
  X.CreateWindow(wid, display.screen[0].root, 100, 100, 400, 300);
  X.ChangeWindowAttributes(wid, {
    eventMask: x11.eventMask.PointerMotion | x11.eventMask.KeyPress,
  });
  X.MapWindow(wid);
  X.on('event', ev => {
    if (ev.type === 2) // KeyPress
      X.terminate();
    console.log(ev);
  });
});
```

Commonly used mask bits include `Exposure`, `KeyPress`, `KeyRelease`,
`ButtonPress`, `ButtonRelease`, `PointerMotion`, `EnterWindow`,
`LeaveWindow`, `StructureNotify`, `SubstructureNotify`,
`SubstructureRedirect`, `PropertyChange` and `FocusChange`.

## Event delivery

All events arrive through a single `'event'` emitter on the client. Every
event object carries:

- `name` — the event name, e.g. `'MotionNotify'`, `'Expose'`, `'KeyPress'`
- `type` — the numeric event code (e.g. 2 = KeyPress, 6 = MotionNotify,
  12 = Expose)
- `seq` — the sequence number of the last request processed by the server
- event-specific fields (`wid`, `x`, `y`, `rootx`, `rooty`, `keycode`,
  `buttons`, …)
- `rawData` — the raw 32-byte wire packet (useful to forward with
  `SendEvent`)

Dispatch on `ev.name` for readability:

```js
X.on('event', ev => {
  switch (ev.name) {
    case 'Expose':
      redraw();
      break;
    case 'MotionNotify':
      console.log(ev.x, ev.y);
      break;
  }
});
```

Every core event and its fields is documented in the
[core events reference](../reference/core-events.md).

## Extension events

Extension events are delivered through the same `'event'` emitter once the
extension has been initialised with `X.require()` — requiring the extension
registers its event parsers. GenericEvents (X Generic Event Extension, used
by Present and XInput 2) are framed by their length field and dispatched to
per-extension parsers registered in `X.geEventParsers`.
