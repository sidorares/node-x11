export default {
  id: 'pointer-paint',
  title: 'Pointer paint',
  description: 'ButtonPress/MotionNotify handling: click and drag inside the screen to paint.',
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 0, 0, screen.pixel_width, screen.pixel_height,
    0, 0, 0, 0, {
      backgroundPixel: screen.white_pixel,
      eventMask: x11.eventMask.Exposure |
                 x11.eventMask.ButtonPress |
                 x11.eventMask.ButtonRelease |
                 x11.eventMask.PointerMotion
    });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0xd0342c });

  const hint = X.AllocID();
  X.CreateGC(hint, wid, { foreground: 0x888888, background: screen.white_pixel });

  let painting = false;
  const colors = [0xd0342c, 0x1c4e80, 0x2e8540, 0xb8860b, 0x7d3c98];
  let colorNo = 0;

  function dot(x, y) {
    X.PolyFillArc(wid, gc, [x - 5, y - 5, 10, 10, 0, 360 * 64]);
  }

  X.on('event', ev => {
    if (ev.name === 'Expose') {
      X.ImageText8(wid, hint, 12, 20, 'drag to paint, release to change color');
    } else if (ev.name === 'ButtonPress') {
      painting = true;
      dot(ev.x, ev.y);
    } else if (ev.name === 'ButtonRelease') {
      painting = false;
      colorNo = (colorNo + 1) % colors.length;
      X.ChangeGC(gc, { foreground: colors[colorNo] });
    } else if (ev.name === 'MotionNotify' && painting) {
      dot(ev.x, ev.y);
    }
  });
});
`,
};
