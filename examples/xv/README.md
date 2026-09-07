# XVideo: handing an adaptor a frame

`testpattern.js` puts 75% colour bars into a window through the X-Video
extension: the client sends planar YUV, and the adaptor does the colour
conversion and the scaling.

```sh
node testpattern.js                       # colour bars at 640x480
node testpattern.js --width 1920 --height 1080
node testpattern.js --shm                 # through a MIT-SHM segment
```

It prints what it found before it draws anything:

```
X-Video Extension version 2.2
adaptor "Intel(R) Textured Video": ports 88..119, type 0x11
  format YUY2 (0x32595559): 16 bpp, 1 plane(s), packed YUYV
  format I420 (0x30323449): 12 bpp, 3 plane(s), planar YUV
using port 88, format I420
frame 640x480: 460800 bytes, pitches 640,320,320, offsets 0,307200,384000
(core PutImage would be 1228800 bytes for the same frame)
```

## You will probably see "no adaptors present"

An Xv adaptor comes from a driver with a video path — Intel/AMD textured
video, NVIDIA, a capture card. **Xvfb and XQuartz both advertise the
extension and offer zero adaptors**, so this exits after printing the
adaptor list on any headless CI machine and on macOS. `xvinfo` reports the
same thing from the command line. A client that wants Xv has to check
`QueryAdaptors` and fall back to core `PutImage` — which is what the exit
here stands in for.

## What to look at

- **`QueryImageAttributes` before every allocation.** The server decides the
  plane layout: dimensions round up, each plane's pitch is padded. Writing
  rows at `width` bytes instead of `pitches[0]` skews the picture.
- **The buffer discipline.** Over the wire the frame is queued by reference,
  so this alternates two buffers. With `--shm` there is one segment and the
  `ShmCompletion` event says when the server has finished reading it —
  `segment.on('complete')` paces the loop.
- **Bytes moved.** The line above compares the frame with what core
  `PutImage` would send for the same picture: I420 is a third of depth-24
  RGB, and the conversion and the scale happen in the adaptor rather than in
  JavaScript.

See [`docs/ext/xv.md`](../../docs/ext/xv.md) for the request reference.
