export default {
  id: 'render-gradients',
  title: 'RENDER: gradients',
  description:
    'Linear, radial and conical gradient pictures — sources with no pixels behind them, evaluated per sample by the server.',
  screenWidth: 640,
  screenHeight: 380,
  code: `const x11 = require('x11');

// A gradient is a Picture with no drawable: nothing is stored, the server
// evaluates the ramp for each sample it is asked for. So the client sends a
// few hundred bytes describing the ramp once, and the server produces as
// many pixels as the composite needs.

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  X.require('render', (err2, render) => {
    if (err2) throw err2;

    const wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 0, 0, 640, 380, 0, 0, 0, 0, {
      backgroundPixel: 0x101418,
      eventMask: x11.eventMask.Exposure
    });
    X.MapWindow(wid);

    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x101418 });

    const dst = X.AllocID();
    render.CreatePicture(dst, wid, render.rgb24);

    // stops are [offset, [r, g, b, a]] with everything in 0..1
    const sunset = [
      [0.0, [0.98, 0.79, 0.19, 1]],
      [0.5, [0.91, 0.30, 0.24, 1]],
      [1.0, [0.31, 0.16, 0.51, 1]]
    ];
    const ocean = [
      [0.0, [0.05, 0.62, 0.86, 1]],
      [1.0, [0.06, 0.20, 0.35, 1]]
    ];
    const wheel = [
      [0.00, [0.95, 0.26, 0.21, 1]],
      [0.25, [0.99, 0.85, 0.21, 1]],
      [0.50, [0.30, 0.76, 0.35, 1]],
      [0.75, [0.13, 0.59, 0.95, 1]],
      [1.00, [0.95, 0.26, 0.21, 1]]
    ];

    const linear = X.AllocID();
    render.CreateLinearGradient(linear, [0, 0], [180, 180], sunset);

    const radial = X.AllocID();
    // two circles: the ramp runs from the inner one to the outer one
    render.CreateRadialGradient(radial, [90, 80], [90, 90], 8, 95, ocean);

    const conical = X.AllocID();
    render.CreateConicalGradient(conical, [90, 90], 0, wheel);

    function panel(picture, x, y, label) {
      render.Composite(render.PictOp.Src, picture, 0, dst,
        0, 0, 0, 0, x, y, 180, 180);
      X.ImageText8(wid, gc, x, y + 198, label);
    }

    X.on('event', ev => {
      if (ev.name !== 'Expose') return;
      X.ChangeGC(gc, { foreground: 0xdfe4ea });
      // ImageText8 draws through the server's built-in 8x8 font, which only
      // covers ASCII 0-127 — anything else comes out as a filled box.
      X.ImageText8(wid, gc, 20, 26,
        'gradient pictures have no backing pixmap: the server samples the ramp');
      panel(linear, 20, 50, 'CreateLinearGradient');
      panel(radial, 228, 50, 'CreateRadialGradient');
      panel(conical, 436, 50, 'CreateConicalGradient');
      console.log('three gradient sources, 0 pixels uploaded');
    });

    X.on('error', e => console.error(e));
  });
});
`,
};
