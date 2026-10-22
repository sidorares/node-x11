# node-x11

Pure-JavaScript X11 protocol client for Node.js — no native code, no runtime
dependencies. It implements all 120 core protocol requests and 34 core events,
and the Apple-WM, BIG-REQUESTS, Composite, DAMAGE, DOUBLE-BUFFER, DPMS, DRI3,
Generic Event, GLX, MIT-SCREEN-SAVER, MIT-SHM, Present, RANDR, RECORD, RENDER,
SHAPE, SYNC, X-Resource, XC-MISC, XFIXES, XINERAMA, XInputExtension, XKEYBOARD,
XTEST and XVideo extensions — including the modern direct-rendering path (GPU
frames as dma-buf pixmaps via DRI3 + Present, see [docs/ext/dri3.md](docs/ext/dri3.md)).
The API reference is in [docs/](docs/README.md).

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sidorares/node-x11?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![CI](https://github.com/sidorares/node-x11/actions/workflows/ci.yml/badge.svg)](https://github.com/sidorares/node-x11/actions/workflows/ci.yml)

**Documentation & live demos: <https://sidorares.github.io/node-x11/>** — the
[playground](https://sidorares.github.io/node-x11/playground) runs ordinary
node-x11 code in your browser against a pure-JavaScript X server (`lib/xserver`)
that ships with this package, including OpenGL via GLX translated to WebGL
(`browser/glx/`).

The client also runs in browsers: `DISPLAY` strings accept a pluggable
protocol prefix (`x11.registerDisplayProtocol(name, connect)` +
`myproto/host:0`), and `createClient({ stream })` accepts any duplex stream.
See the [custom transports guide](https://sidorares.github.io/node-x11/docs/guides/custom-transports).

It runs under [Bun](https://bun.sh) too, including the parts that pass file
descriptors over the connection (MIT-SHM segments, DRI3 buffers) — and there,
uniquely, descriptors can also be *received*: see
[Running under Bun](docs/README.md#running-under-bun).

## Install

    npm install x11

Requires Node.js 18 or later, or Bun.

Windows: run an X server such as [VcXsrv](https://sourceforge.net/projects/vcxsrv/),
[Xming](http://www.straightrunning.com/XmingNotes/) or [Cygwin/X](https://x.cygwin.com/).
On Windows the client always connects over TCP (port 6000 + display number, to
display `:0` on `localhost` when `DISPLAY` is unset), so the server has to
accept TCP connections. Inside WSL, node-x11 is an ordinary Linux client.

## Example

Core requests usage:

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
    0,
    0,
    500,
    500, // x, y, w, h
    0,
    0,
    0,
    0, // border, depth, class, visual
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
    if (ev.type === 12) {
      X.PolyFillRectangle(wid, cidWhite, [0, 0, 500, 500]);
      X.PolyText8(wid, cidBlack, 50, 50, ['Hello, Node.JS!']);
    }
  });
  X.on('error', e => {
    console.log(e);
  });
});
```

## Screenshots

![OpenGL glxgears](https://img-fotki.yandex.ru/get/4123/37511094.30/0_81712_6c2ebb11_L)
![OpenGL teapot](https://img-fotki.yandex.ru/get/4132/37511094.30/0_81713_82a5ac48_L)

[`examples/opengl/glxgears.js`](examples/opengl/glxgears.js) and
[`examples/opengl/teapot.js`](examples/opengl/teapot.js) over indirect GLX.
More, running in your browser: the [live demos](https://sidorares.github.io/node-x11/).

## In use

- [ntk](https://github.com/sidorares/ntk) - higher level toolkit on top of X11
- [react-x11](https://github.com/sidorares/react-x11) - React renderer with X11 as a target, built on ntk
- [node-remote](https://github.com/AndrewSwerlick/node-remote) - media center controller (archived)
- [tiles](https://github.com/dominictarr/tiles) - tiling window manager
- [vnc](https://github.com/sidorares/node-vnc) - vnc client.
- [node-ewmh](https://github.com/santigimeno/node-ewmh) - set of EWMH helpers.
- [OdieWM](https://github.com/bu/OdieWM) - window manager (archived)
- [Dbusmenu](https://github.com/sidorares/node-dbusmenu) - unity global menu client.
- [AirWM](https://github.com/AirWM/AirWM) - tiling window manager
- [npdf](https://github.com/sidorares/npdf) - pdf viewer
- [tinywm](https://github.com/Airblader/node-tinywm) The famous [TinyWM](https://github.com/mackstann/tinywm) written in node.js (archived)
- [basedwm](https://github.com/anko/basedwm) Infinite-desktop panning X window manager in LiveScript

## X11 resources/documentation:

- [Xplain](https://github.com/magcius/xplain) - A series of articles to help explain the X Window System https://magcius.github.io/xplain/article/
- [Official X11 docs](https://www.x.org/releases/current/doc/)
- [protocol specification](https://www.x.org/releases/current/doc/xproto/x11protocol.html)
- C Xlib to X11 request mapping table https://tronche.com/gui/x/xlib/appendix/a.html
- [Extended Window Manager Hints specification](https://specifications.freedesktop.org/wm-spec/latest/)

## Other implementations

- C: Xlib - https://www.x.org/releases/current/doc/libX11/libX11/libX11.html https://tronche.com/gui/x/xlib/
- C: XCB - https://xcb.freedesktop.org/
- Python: https://github.com/python-xlib/python-xlib ( pypi: https://pypi.org/project/python-xlib/ )
- https://github.com/alexer/python-xlib-render
- Python/twisted: https://launchpad.net/twisted-x11
- Perl: https://metacpan.org/pod/X11::Protocol
- Go: https://github.com/BurntSushi/xgb
- Java: https://github.com/xadorfr/J11
- Java: https://github.com/moaxcp/x11
- Ruby: https://github.com/dj2/x-ruby-bindings
- Guile: https://github.com/mwitmer/guile-xcb
- Emacs lisp: https://github.com/emacs-exwm/xelb ( autogenerated from XCB XML )

## X servers in JavaScript

node-x11 ships its own: `x11.createServer` / `lib/xserver`, the server the
[playground](https://sidorares.github.io/node-x11/playground) runs in your
browser. Earlier DOM-based servers:

- https://github.com/GothAck/javascript-x-server
- https://github.com/ttaubert/x-server-js
