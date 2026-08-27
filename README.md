# node-x11

X11 protocol client for Node.js: implements the core X11 protocol, as well as Xrender, Damage, Composite, Big-Requests, Dpms, Screensaver, XFixes, Shape, XTest, XC-Misc, GLX, DRI3, Present, and Apple-WM extensions — including the modern direct-rendering path (GPU frames as dma-buf pixmaps via DRI3 + Present, see [docs/ext/dri3.md](docs/ext/dri3.md)).

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sidorares/node-x11?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![CI](https://github.com/sidorares/node-x11/actions/workflows/ci.yml/badge.svg)](https://github.com/sidorares/node-x11/actions/workflows/ci.yml)

**Documentation & live demos: <https://sidorares.github.io/node-x11/>** — the
[playground](https://sidorares.github.io/node-x11/playground) runs ordinary
node-x11 code in your browser against a pure-JavaScript X server (`lib/xserver`)
that ships with this package, including OpenGL via GLX-over-WebGL.

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

Windows users:

1.  install [XMing](http://www.straightrunning.com/XmingNotes/) or [Cygwin/X](http://x.cygwin.com/)
2.  get node-x11 copy (using [git](http://code.google.com/p/msysgit/downloads/list?can=3) or from [Github](https://github.com/sidorares/node-x11/archives/master))

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

![tetris game](https://lh6.googleusercontent.com/-RCRY9A7WwnA/Tlww0FHP7NI/AAAAAAAAAwo/nxfSxsw6xow/s400/tetris.png)
![XRENDER gradients](https://lh4.googleusercontent.com/-VS0BMYYmq6M/Tlww0Y1ij0I/AAAAAAAAAws/pVWsPZ63Yeo/s400/render-gradients.png)
![OpenGL glxgears](http://img-fotki.yandex.ru/get/4123/37511094.30/0_81712_6c2ebb11_L)
![OpenGL teapot](http://img-fotki.yandex.ru/get/4132/37511094.30/0_81713_82a5ac48_L)

## In use

- [ntk](https://github.com/sidorares/ntk) - higher level toolkit on top of X11
- [node-remote](https://github.com/AndrewSwerlick/node-remote) - media center controller
- [tiles](https://github.com/dominictarr/tiles) - tiling window manager
- [vnc](https://github.com/sidorares/node-vnc) - vnc client.
- [node-ewmh](https://github.com/santigimeno/node-ewmh) - set of EWMH helpers.
- [OdieWM](https://github.com/bu/OdieWM) - window manager
- [Dbusmenu](https://github.com/sidorares/node-dbusmenu) - unity global menu client.
- [AirWM](https://github.com/AirWM/AirWM) - tiling window manager
- [npdf](https://github.com/sidorares/npdf) - pdf viewer
- [tinywm](https://github.com/Airblader/node-tinywm) The famous [TinyWM](https://github.com/mackstann/tinywm) written in node.js
- [basedwm](https://github.com/anko/basedwm) Infinite-desktop panning X window manager in LiveScript

## X11 resources/documentation:

- [Xplain](https://github.com/magcius/xplain) - A series of articles to help explain the X Window System http://magcius.github.io/xplain/article/
- [Official X11 docs](http://www.x.org/releases/X11R7.6/doc/)
- [protocol specification](http://www.x.org/releases/X11R7.6/doc/xproto/x11protocol.pdf)
- C Xlib to X11 request mapping table http://tronche.com/gui/x/xlib/appendix/a.html
- [How to write composite manager](http://www.talisman.org/~erlkonig/misc/x11-composite-tutorial/)
- [Extended Window Manager Hints specification](http://standards.freedesktop.org/wm-spec/wm-spec-1.3.html)

## Other implementations

- C: XLib - http://www.sbin.org/doc/Xlib/ http://www.tronche.com/gui/x/xlib/ http://www.x.org/docs/X11/xlib.pdf
- C: XCB - http://xcb.freedesktop.org/
- Python: http://sourceforge.net/projects/python-xlib/ ( github fork: https://github.com/Ademan/python-xlib-branch pypi: http://pypi.python.org/pypi/Python%20Xlib )
- https://github.com/alexer/python-xlib-render
- Python/twisted: https://launchpad.net/twisted-x11
- Perl: http://search.cpan.org/~smccam/X11-Protocol-0.56/Protocol.pm
- Go: https://github.com/BurntSushi/xgb
- Java: https://github.com/xderoche/J11
- Java: https://github.com/moaxcp/x11
- Ruby: https://github.com/dj2/x-ruby-bindings
- Clojure: https://github.com/noodlewiz/xcljb
- Guile: https://github.com/mwitmer/guile-xcb
- Emacs lisp: https://github.com/ch11ng/xelb ( autogenerated from XCB XML )

## Server side (protocol + functionality) implementations for js + DOM

would be really great to make completely web based playground page, connecting node-x11 api to DOM based implementation

- https://github.com/GothAck/javascript-x-server
- https://github.com/ttaubert/x-server-js
