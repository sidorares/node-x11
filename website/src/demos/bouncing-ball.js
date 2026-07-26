export default {
  id: 'bouncing-ball',
  title: 'Bouncing ball',
  description: 'Animation with setInterval: ClearArea + PolyFillArc at ~60fps.',
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const W = 520, H = 360, R = 22;
  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 50, 50, W, H, 0, 0, 0, 0, {
    backgroundPixel: 0x101820
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0xffcc00 });
  const trailGc = X.AllocID();
  X.CreateGC(trailGc, wid, { foreground: 0x2a3a4a });

  let x = 90, y = 70, dx = 4, dy = 3;

  setInterval(() => {
    // leave a dim trail instead of fully erasing
    X.PolyFillArc(wid, trailGc, [x - R, y - R, 2 * R, 2 * R, 0, 360 * 64]);

    x += dx;
    y += dy;
    if (x - R <= 0 || x + R >= W) dx = -dx;
    if (y - R <= 0 || y + R >= H) dy = -dy;

    X.PolyFillArc(wid, gc, [x - R, y - R, 2 * R, 2 * R, 0, 360 * 64]);
  }, 16);
});
`,
};
