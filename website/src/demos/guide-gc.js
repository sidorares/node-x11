export default {
  id: 'guide-gc',
  title: 'A graphics context is pen state',
  description:
    'The same PolyFillRectangle four times — only the GC changed between them.',
  playground: false,
  screenWidth: 420,
  screenHeight: 260,
  height: 300,
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 0, 0, 420, 260, 0, 0, 0, 0, {
    backgroundPixel: 0x11151a,
    eventMask: x11.eventMask.Exposure
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0xe74c3c, background: 0x11151a });

  X.on('event', ev => {
    if (ev.name !== 'Expose') return;

    // Nothing about the shape changes below — ChangeGC does all the work.
    X.PolyFillRectangle(wid, gc, [30, 40, 80, 80]);

    X.ChangeGC(gc, { foreground: 0xf1c40f });
    X.PolyFillRectangle(wid, gc, [130, 40, 80, 80]);

    X.ChangeGC(gc, { foreground: 0x2ecc71 });
    X.PolyFillRectangle(wid, gc, [230, 40, 80, 80]);

    // GXxor combines with what is already there rather than replacing it
    X.ChangeGC(gc, { foreground: 0xffffff, function: x11.gcFunction.GXxor });
    X.PolyFillRectangle(wid, gc, [70, 90, 200, 40]);

    X.ChangeGC(gc, { foreground: 0x8892a0, function: x11.gcFunction.GXcopy });
    X.ImageText8(wid, gc, 30, 180, 'one request, four GC states');
    X.ImageText8(wid, gc, 30, 200, 'the white band is GXxor over the squares');
  });

  X.on('error', e => console.error(e));
});
`,
};
