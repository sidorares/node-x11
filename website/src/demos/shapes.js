export default {
  id: 'shapes',
  title: 'Arcs, polygons and lines',
  description:
    'The core geometry requests: PolyArc, PolyFillArc, FillPoly, PolySegment, PolyLine and PolyRectangle, with line width and arc mode.',
  screenWidth: 640,
  screenHeight: 400,
  code: `const x11 = require('x11');

// Core X11 has no paths and no curves beyond the ellipse: every shape here
// is one request carrying a flat list of 16-bit coordinates. Angles are in
// 1/64 of a degree, counter-clockwise from 3 o'clock.

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 0, 0, 640, 400, 0, 0, 0, 0, {
    backgroundPixel: 0x11151a,
    eventMask: x11.eventMask.Exposure
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x11151a, lineWidth: 1 });

  const DEG = 64; // 1/64 degree units

  function label(x, y, text) {
    X.ChangeGC(gc, { foreground: 0x8892a0, lineWidth: 1 });
    X.ImageText8(wid, gc, x, y, text);
  }

  X.on('event', ev => {
    if (ev.name !== 'Expose') return;

    // ---- outlined ellipse arcs: [x, y, w, h, angle1, angle2] each
    label(30, 30, 'PolyArc');
    X.ChangeGC(gc, { foreground: 0x4fc3f7, lineWidth: 2 });
    X.PolyArc(wid, gc, [
      30, 44, 120, 90, 0, 360 * DEG,
      50, 60, 80, 58, 45 * DEG, 180 * DEG
    ]);

    // ---- filled arcs, and the difference arcMode makes
    label(200, 30, 'PolyFillArc (chord vs pie)');
    X.ChangeGC(gc, { foreground: 0xf06292, arcMode: 0 }); // 0 = Chord
    X.PolyFillArc(wid, gc, [200, 44, 100, 90, 30 * DEG, 220 * DEG]);
    X.ChangeGC(gc, { foreground: 0xba68c8, arcMode: 1 }); // 1 = PieSlice
    X.PolyFillArc(wid, gc, [320, 44, 100, 90, 30 * DEG, 220 * DEG]);

    // ---- a filled polygon: shape 0 Complex, coordMode 0 Origin
    label(450, 30, 'FillPoly');
    X.ChangeGC(gc, { foreground: 0x81c784 });
    const star = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 26 : 58;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      star.push(Math.round(520 + r * Math.cos(a)), Math.round(90 + r * Math.sin(a)));
    }
    X.FillPoly(wid, gc, 0, 0, star);

    // ---- disconnected segments: [x1, y1, x2, y2] each
    label(30, 190, 'PolySegment');
    X.ChangeGC(gc, { foreground: 0xffb74d, lineWidth: 3 });
    const segments = [];
    for (let i = 0; i < 12; i++)
      segments.push(30 + i * 14, 205, 30 + i * 14 + 10, 275);
    X.PolySegment(wid, gc, segments);

    // ---- a connected polyline through the same kind of list
    label(230, 190, 'PolyLine');
    X.ChangeGC(gc, { foreground: 0x4dd0e1, lineWidth: 2 });
    const wave = [];
    for (let i = 0; i <= 40; i++)
      wave.push(230 + i * 4, Math.round(240 + Math.sin(i / 3) * 32));
    // note the argument order: PolyLine and PolyPoint take coordMode first,
    // unlike every other drawing request
    X.PolyLine(0, wid, gc, wave); // 0 = Origin

    // ---- outlined rectangles
    label(450, 190, 'PolyRectangle');
    X.ChangeGC(gc, { foreground: 0xe57373, lineWidth: 2 });
    const boxes = [];
    for (let i = 0; i < 5; i++)
      boxes.push(455 + i * 6, 205 + i * 6, 120 - i * 12, 70 - i * 12);
    X.PolyRectangle(wid, gc, boxes);

    // ---- line width is GC state, not a per-request argument
    label(30, 320, 'lineWidth 1, 3, 6, 10: GC state, not a request argument');
    [1, 3, 6, 10].forEach((w, i) => {
      X.ChangeGC(gc, { foreground: 0xdfe4ea, lineWidth: w });
      X.PolySegment(wid, gc, [30 + i * 150, 340, 150 + i * 150, 375]);
    });

    console.log('six geometry requests, all coordinates 16-bit');
  });

  X.on('error', e => console.error(e));
});
`,
};
