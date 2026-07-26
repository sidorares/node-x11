---
title: Introduction
sidebar_position: 1
slug: /intro
---

# node-x11

`node-x11` is a pure-JavaScript X Window System protocol client for Node.js.
There is no native code and no runtime dependency: the library speaks the X11
wire protocol directly over a unix socket or TCP connection. It implements
all 120 requests and 34 events of the core protocol, plus a long list of
extensions — RENDER, RANDR, XFIXES, Composite, Damage, SHAPE, XTEST, XKB,
XInput, MIT-SHM, GLX and more.

## Install

```bash
npm install x11
```

## Hello, X server

The smallest possible program — connect to the server named by `$DISPLAY`,
print its vendor string, and disconnect:

```js
const x11 = require('x11');

x11.createClient((err, display) => {
  console.log(`succesfully connected to "${display.vendor}" server`);
  display.client.terminate();
});
```

A more typical program creates a window, selects events and draws into it:

```js
const x11 = require('x11');

const { Exposure, PointerMotion } = x11.eventMask;

x11.createClient((err, display) => {
  if (err) {
    console.log(err);
    return;
  }
  const X = display.client;
  const root = display.screen[0].root;
  const wid = X.AllocID();
  X.CreateWindow(
    wid,
    root, // new window id, parent
    0, 0, 500, 500, // x, y, w, h
    0, 0, 0, 0, // border, depth, class, visual
    { eventMask: Exposure | PointerMotion } // other parameters
  );
  X.MapWindow(wid);
  const white = display.screen[0].white_pixel;
  const black = display.screen[0].black_pixel;
  const cidBlack = X.AllocID();
  const cidWhite = X.AllocID();
  X.CreateGC(cidBlack, wid, { foreground: black, background: white });
  X.CreateGC(cidWhite, wid, { foreground: white, background: black });
  X.on('event', ev => {
    if (ev.type === 12) { // Expose
      X.PolyFillRectangle(wid, cidWhite, [0, 0, 500, 500]);
      X.PolyText8(wid, cidBlack, 50, 50, ['Hello, Node.JS!']);
    }
  });
  X.on('error', e => {
    console.log(e);
  });
});
```

## Where to go next

- [Getting started](guides/getting-started.md) — connecting, the display
  object, screens and resource ids
- [Windows & drawing](guides/windows-and-drawing.md) — `CreateWindow`,
  graphics contexts and drawing requests
- [Events](guides/events.md) — event masks and event delivery
- [Extensions](guides/extensions.md) — loading protocol extensions with
  `X.require()`
- [Custom transports & DISPLAY protocols](guides/custom-transports.md) —
  plugging your own connection layer into `createClient`
- [API reference](reference/index.md) — every core request, every event, and
  one page per extension
