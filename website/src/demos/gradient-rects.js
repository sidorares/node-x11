export default {
  id: 'gradient-rects',
  title: 'Gradient rectangles',
  description: 'Core-protocol drawing: PolyFillRectangle bands sweeping through a color gradient.',
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const W = 512, H = 320, BANDS = 64;
  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 30, 30, W, H, 0, 0, 0, 0, {
    backgroundPixel: screen.black_pixel,
    eventMask: x11.eventMask.Exposure
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, {});

  function draw() {
    const bw = W / BANDS;
    for (let i = 0; i < BANDS; i++) {
      const t = i / (BANDS - 1);
      // deep blue -> magenta -> warm orange
      const r = Math.round(0x20 + t * 0xd0);
      const g = Math.round(0x18 + t * t * 0x80);
      const b = Math.round(0xa0 - t * 0x70);
      X.ChangeGC(gc, { foreground: (r << 16) | (g << 8) | b });
      X.PolyFillRectangle(wid, gc, [i * bw, 0, bw, H]);
    }
    // a few overlaid outlines for good measure
    X.ChangeGC(gc, { foreground: 0xffffff });
    for (let i = 0; i < 5; i++)
      X.PolyRectangle(wid, gc, [40 + i * 24, 40 + i * 18, 180, 120]);
  }

  X.on('event', ev => {
    if (ev.name === 'Expose') draw();
  });
});
`,
};
