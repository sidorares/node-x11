export default {
  id: 'window-manager',
  title: 'A window manager',
  description:
    'SubstructureRedirect: intercept MapRequest, reparent each client into a frame with a title bar, and drag it by that bar. Two toy clients connect separately so there is something to manage.',
  screenWidth: 640,
  screenHeight: 440,
  code: `const x11 = require('x11');

// Selecting SubstructureRedirect on the root means map and configure
// requests from OTHER clients are delivered to us as events instead of
// taking effect. That one event mask is the whole mechanism a window manager
// is built on — there is no privileged API.
//
// Note the two connections. A client's own requests are never redirected to
// itself, so the toy applications have to be a separate connection or the
// window manager would simply never hear about them.

x11.createClient((err, wmDisplay) => {
  if (err) throw err;
  const WM = wmDisplay.client;
  const screen = wmDisplay.screen[0];
  const root = screen.root;

  const TITLE_H = 22;
  const frames = [];   // { client, frame, x, y, width, height }

  WM.ChangeWindowAttributes(root, {
    eventMask: x11.eventMask.SubstructureRedirect |
               x11.eventMask.SubstructureNotify
  });

  // ImageText8 fills each glyph cell with the GC's BACKGROUND before drawing
  // the glyph, so both colours have to be set or the text lands on a black
  // box (or vanishes into one).
  const gc = WM.AllocID();
  WM.CreateGC(gc, root, { foreground: 0xecf0f1, background: 0x34495e });

  // a desktop, so the managed windows have something to sit on
  const desktopGc = WM.AllocID();
  WM.CreateGC(desktopGc, root, { foreground: 0x1d2b38 });
  WM.PolyFillRectangle(root, desktopGc, [0, 0, screen.pixel_width, screen.pixel_height]);
  WM.ChangeGC(desktopGc, { foreground: 0x24374a });
  const grid = [];
  for (let x = 0; x < screen.pixel_width; x += 32) grid.push(x, 0, 1, screen.pixel_height);
  for (let y = 0; y < screen.pixel_height; y += 32) grid.push(0, y, screen.pixel_width, 1);
  WM.PolyFillRectangle(root, desktopGc, grid);

  function frameFor(client, geom) {
    const frame = WM.AllocID();
    WM.CreateWindow(frame, root,
      geom.xPos, geom.yPos, geom.width, geom.height + TITLE_H, 1, 0, 0, 0, {
        backgroundPixel: 0x2c3e50,
        borderPixel: 0x1a252f,
        eventMask: x11.eventMask.Exposure |
                   x11.eventMask.ButtonPress |
                   x11.eventMask.ButtonRelease |
                   x11.eventMask.PointerMotion
      });
    // the client keeps its own size — it just gets a new parent
    WM.ReparentWindow(client, frame, 0, TITLE_H);
    WM.MapWindow(frame);
    WM.MapWindow(client);
    frames.push({
      client, frame,
      x: geom.xPos, y: geom.yPos, width: geom.width, height: geom.height
    });
    console.log('framed client ' + client);
  }

  function paintTitle(frame) {
    const entry = frames.find(f => f.frame === frame);
    if (!entry) return;
    WM.ChangeGC(gc, { foreground: 0x34495e });
    WM.PolyFillRectangle(frame, gc, [0, 0, entry.width, TITLE_H]);
    WM.ChangeGC(gc, { foreground: 0xecf0f1 });
    WM.ImageText8(frame, gc, 8, 15, 'drag this bar');
    WM.ChangeGC(gc, { foreground: 0xe74c3c });
    WM.PolyFillRectangle(frame, gc, [entry.width - 18, 6, 10, 10]);
  }

  let drag = null;

  WM.on('event', ev => {
    switch (ev.name) {
      case 'MapRequest':
        // the client asked to be shown; we decide how
        if (!frames.some(f => f.client === ev.wid))
          WM.GetGeometry(ev.wid, (err2, geom) => {
            if (!err2) frameFor(ev.wid, geom);
          });
        break;

      case 'ConfigureRequest':
        // honour it verbatim — a real WM would apply policy here
        WM.ConfigureWindow(ev.wid, {
          x: ev.x, y: ev.y, width: ev.width, height: ev.height
        });
        break;

      case 'Expose':
        paintTitle(ev.wid);
        break;

      case 'ButtonPress': {
        const entry = frames.find(f => f.frame === ev.wid);
        if (entry && ev.y < TITLE_H)
          drag = { entry, dx: ev.x, dy: ev.y };
        break;
      }

      case 'MotionNotify':
        if (drag) {
          drag.entry.x = ev.rootx - drag.dx;
          drag.entry.y = ev.rooty - drag.dy;
          WM.ConfigureWindow(drag.entry.frame,
            { x: drag.entry.x, y: drag.entry.y });
        }
        break;

      case 'ButtonRelease':
        drag = null;
        break;
    }
  });

  WM.on('error', e => console.error('wm: ' + e.error));

  // ---- a second connection: two ordinary clients with no idea they are managed
  x11.createClient((err2, appDisplay) => {
    if (err2) throw err2;
    const A = appDisplay.client;

    [
      { x: 60, y: 70, w: 250, h: 140, bg: 0xf39c12, text: 'client one' },
      { x: 330, y: 190, w: 240, h: 150, bg: 0x16a085, text: 'client two' }
    ].forEach(spec => {
      const wid = A.AllocID();
      A.CreateWindow(wid, root, spec.x, spec.y, spec.w, spec.h, 0, 0, 0, 0, {
        backgroundPixel: spec.bg,
        eventMask: x11.eventMask.Exposure
      });
      const cgc = A.AllocID();
      A.CreateGC(cgc, wid, { foreground: 0x11151a, background: spec.bg });
      A.on('event', ev => {
        if (ev.name === 'Expose' && ev.wid === wid) {
          A.ImageText8(wid, cgc, 12, 28, spec.text);
          A.ImageText8(wid, cgc, 12, 48, 'I did not draw my own frame');
        }
      });
      A.MapWindow(wid);   // arrives at the WM as a MapRequest
    });

    A.on('error', e => console.error('app: ' + e.error));
  });
});
`,
};
