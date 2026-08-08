# Direct rendering: X11 window + GPU OpenGL through DRI3 + Present

A spinning cube, rendered with OpenGL ES 2 **on the GPU** and shown in an
ordinary X11 window — the modern path Mesa uses under every GL app, spoken
here from Node: the window, events and presentation are the pure-JS
[`x11`](https://github.com/sidorares/node-x11) package (DRI3 + Present
extensions over the ordinary unix socket, descriptors and all), the GL
context and dma-buf export are the small native companion
[`x11-dri`](https://github.com/sidorares/node-x11-dri).

```
GPU (render node)                        X server
-----------------                        --------
glDraw... into a GBM buffer
swap() -> dma-buf fd  ---- fd over unix socket (DRI3) --->  pixmap
Present.Pixmap(window, pixmap)  ------ vsync'd flip/copy --> on screen
                     <---- PresentCompleteNotify  (paces the next frame)
                     <---- PresentIdleNotify      (buffer reusable)
```

No pixel data ever crosses the socket. Compare `../opengl/glxgears.js` —
indirect GLX, where every GL call is serialized through the server and GL is
capped at 1.x.

## Run it

```sh
npm install     # x11 from this repo, x11-dri built by node-gyp (no headers needed)
npm start       # the cube, vsync-paced
```

Also:

```sh
npm run start:async   # unthrottled presents (vblank_mode=0 flavor), prints fps
npm run software      # no GPU: CPU-rasterized 3D through udmabuf, same path
```

`q` / `Escape` quits. Resize the window — the swapchain follows.

## Requirements

- Linux, a DRM render node (`/dev/dri/renderD*`) readable by you, and a
  server with DRI3 + Present: Xorg with glamor, or Xwayland. (Xvfb and
  Xephyr have no DRI3 — the example says so and exits.)
- `npm install` builds `x11-dri` with node-gyp: a C toolchain is all it
  takes; Mesa's libgbm/libEGL/libGLESv2 are dlopen'd at runtime.

## If something looks off

- **~1 fps and `(Copy, msc …)` creeping**: the compositor is throttling
  frame callbacks (headless/idle sessions do this — Xwayland then falls back
  to a 1 Hz timer). The pipeline is fine; `npm run start:async` will show
  the real throughput.
- **`server could not import the GPU buffer`**: client and server sit on
  different DRM devices. Set `devicePath` in `new dri.Gpu({...})` to another
  `/dev/dri/renderD*`, or create the surface with `dri.GBM_USE.LINEAR`.
- **`software.js` reports the server cannot import CPU dma-bufs**: typical
  on virtualized GPUs (virgl) — the driver cannot wrap guest RAM. On real
  hardware (Intel/AMD, Xorg+glamor or Xwayland) it runs.
