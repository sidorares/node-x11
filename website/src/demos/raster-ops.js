export default {
  id: 'raster-ops',
  title: 'Raster ops: XOR rubber band',
  description:
    'Drag inside the window. The selection box is drawn with GXxor, so drawing it a second time erases it — how X did interactive feedback before compositing.',
  screenWidth: 640,
  screenHeight: 400,
  code: `const x11 = require('x11');

// GC "function" is a bitwise operation between the pixel being drawn and the
// pixel already there. GXxor is the useful one: drawing the same shape twice
// restores the original, so you can drag a rubber band over arbitrary
// content without saving and restoring what was underneath.

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];
  const GX = x11.gcFunction;

  const W = 640, H = 400;

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 0, 0, W, H, 0, 0, 0, 0, {
    backgroundPixel: 0x101418,
    eventMask: x11.eventMask.Exposure |
               x11.eventMask.ButtonPress |
               x11.eventMask.ButtonRelease |
               x11.eventMask.PointerMotion
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x1b2530 });

  // the rubber band GC: xor, and a foreground chosen so the band is legible
  // against everything below it
  const bandGc = X.AllocID();
  X.CreateGC(bandGc, wid, {
    foreground: 0xffffff,
    function: GX.GXxor,
    lineWidth: 1
  });

  let anchor = null;   // { x, y }
  let band = null;     // last drawn rect, still on screen

  function bandRect(a, b) {
    return [
      Math.min(a.x, b.x), Math.min(a.y, b.y),
      Math.abs(a.x - b.x), Math.abs(a.y - b.y)
    ];
  }

  function toggleBand(rect) {
    // one request, and it is its own undo
    if (rect[2] > 0 && rect[3] > 0)
      X.PolyRectangle(wid, bandGc, rect);
  }

  // A busy backdrop, so that erasing the band by redrawing it is visibly
  // exact rather than just plausible against a flat colour.
  function backdrop() {
    X.ChangeGC(gc, { foreground: 0x1b2530 });
    X.PolyFillRectangle(wid, gc, [0, 0, W, H]);

    const stripes = [];
    for (let i = 0; i < 26; i++) stripes.push(i * 26, 70, 14, H - 90);
    X.ChangeGC(gc, { foreground: 0x27384a });
    X.PolyFillRectangle(wid, gc, stripes);

    // PolyFillArc takes [x, y, w, h, angle1, angle2] per arc
    const dots = [];
    for (let i = 0; i < 40; i++)
      dots.push(30 + (i % 10) * 62, 110 + Math.floor(i / 10) * 66, 26, 26,
        0, 360 * 64);
    X.ChangeGC(gc, { foreground: 0x4fc3f7 });
    X.PolyFillArc(wid, gc, dots);

    X.ChangeGC(gc, { foreground: 0xdfe4ea });
    X.ImageText8(wid, gc, 20, 30, 'drag to draw a selection box');
    X.ImageText8(wid, gc, 20, 50,
      'GXxor: the same PolyRectangle both draws and erases it');
  }

  X.on('event', ev => {
    if (ev.name === 'Expose') {
      backdrop();
      band = null;
      return;
    }
    if (ev.name === 'ButtonPress') {
      anchor = { x: ev.x, y: ev.y };
      band = null;
      return;
    }
    if (ev.name === 'MotionNotify' && anchor) {
      if (band) toggleBand(band);            // erase the previous box
      band = bandRect(anchor, { x: ev.x, y: ev.y });
      toggleBand(band);                      // draw the new one
      return;
    }
    if (ev.name === 'ButtonRelease' && anchor) {
      if (band) toggleBand(band);            // erase, then commit for real
      const rect = bandRect(anchor, { x: ev.x, y: ev.y });
      anchor = null;
      band = null;
      if (rect[2] > 2 && rect[3] > 2) {
        X.ChangeGC(gc, { foreground: 0xf06292, lineWidth: 2 });
        X.PolyRectangle(wid, gc, rect);
        X.ChangeGC(gc, { lineWidth: 1 });
        console.log('selected ' + rect[2] + 'x' + rect[3] + ' at ' + rect[0] + ',' + rect[1]);
      }
    }
  });

  X.on('error', e => console.error(e));
});
`,
};
