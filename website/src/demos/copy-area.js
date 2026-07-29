export default {
  id: 'copy-area',
  title: 'Pixmaps and CopyArea',
  description:
    'Draw once into an off-screen pixmap, then scroll it across the window with CopyArea — the classic way to animate without redrawing.',
  screenWidth: 640,
  screenHeight: 340,
  code: `const x11 = require('x11');

// A pixmap is a drawable with no window: same drawing requests, nothing on
// screen. Render the expensive thing into it once, then move pixels around
// with CopyArea, which is a server-side blit — no pixel data on the wire.

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const W = 640, H = 340;
  const STRIP_W = 960, STRIP_H = 200;

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 0, 0, W, H, 0, 0, 0, 0, {
    backgroundPixel: 0x0f1317,
    eventMask: x11.eventMask.Exposure
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x0f1317 });

  // ---- the off-screen strip, drawn exactly once
  const strip = X.AllocID();
  X.CreatePixmap(strip, wid, 24, STRIP_W, STRIP_H);

  X.ChangeGC(gc, { foreground: 0x161c22 });
  X.PolyFillRectangle(strip, gc, [0, 0, STRIP_W, STRIP_H]);

  // a skyline: cheap to look at, tedious enough that you would not want to
  // redraw it 25 times a second
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let layer = 0; layer < 3; layer++) {
    const shade = [0x1f2a36, 0x2c3b4a, 0x3d5061][layer];
    X.ChangeGC(gc, { foreground: shade });
    const boxes = [];
    for (let x = 0; x < STRIP_W; x += 24 + Math.floor(rand() * 20)) {
      const h = 40 + Math.floor(rand() * (60 + layer * 40));
      boxes.push(x, STRIP_H - h, 18 + Math.floor(rand() * 26), h);
    }
    X.PolyFillRectangle(strip, gc, boxes);
  }
  X.ChangeGC(gc, { foreground: 0xffe082 });
  const windows = [];
  for (let i = 0; i < 260; i++)
    windows.push(
      Math.floor(rand() * STRIP_W),
      STRIP_H - 10 - Math.floor(rand() * 120), 3, 4);
  X.PolyFillRectangle(strip, gc, windows);

  let offset = 0;
  let running = false;

  function frame() {
    if (!running) return;
    // Two copies so the strip wraps seamlessly: the tail, then the head.
    const first = Math.min(W, STRIP_W - offset);
    X.CopyArea(strip, wid, gc, offset, 0, 0, 90, first, STRIP_H);
    if (first < W)
      X.CopyArea(strip, wid, gc, 0, 0, first, 90, W - first, STRIP_H);
    offset = (offset + 2) % STRIP_W;
  }

  X.on('event', ev => {
    if (ev.name !== 'Expose') return;
    X.ChangeGC(gc, { foreground: 0xdfe4ea });
    X.ImageText8(wid, gc, 20, 30,
      'drawn once into a ' + STRIP_W + 'x' + STRIP_H + ' pixmap, then blitted');
    X.ImageText8(wid, gc, 20, 50,
      'CopyArea moves pixels inside the server: nothing crosses the wire');
    X.ImageText8(wid, gc, 20, 320,
      'two CopyArea requests per frame, 40 bytes total');
    running = true;
    console.log('skyline cached in pixmap ' + strip);
  });

  setInterval(frame, 40);
  X.on('error', e => console.error(e));
});
`,
};
