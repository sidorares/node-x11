export default {
  id: 'guide-extension',
  title: 'Loading an extension',
  description:
    'X.require negotiates an extension and hands back an object whose requests you call like core ones.',
  playground: false,
  screenWidth: 420,
  screenHeight: 260,
  height: 320,
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  // X.require does QueryExtension, learns the major opcode, and returns an
  // object whose methods pack requests against it. Nothing is loaded until
  // you ask, and an absent extension gives you an error rather than a throw.
  X.require('render', (err2, render) => {
    if (err2) {
      console.error('no RENDER on this display: ' + err2);
      return;
    }

    render.QueryVersion(0, 11, (err3, version) => {
      if (err3) throw err3;
      console.log('RENDER ' + version.majorVersion + '.' + version.minorVersion);
    });

    const wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 0, 0, 420, 260, 0, 0, 0, 0, {
      backgroundPixel: 0x11151a,
      eventMask: x11.eventMask.Exposure
    });
    X.MapWindow(wid);

    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x1f2933 });

    // A Picture wraps a drawable in a pixel format RENDER understands.
    const picture = X.AllocID();
    render.CreatePicture(picture, wid, render.rgb24);

    X.on('event', ev => {
      if (ev.name !== 'Expose') return;

      // colours here are floats, and alpha actually blends — unlike the core
      // protocol, where a pixel value simply replaces what was there
      render.FillRectangles(render.PictOp.Src, picture,
        [0.12, 0.16, 0.20, 1], [0, 0, 420, 260]);
      render.FillRectangles(render.PictOp.Over, picture,
        [0.91, 0.30, 0.24, 0.85], [40, 60, 160, 120]);
      render.FillRectangles(render.PictOp.Over, picture,
        [0.20, 0.60, 0.86, 0.55], [120, 100, 160, 120]);

      X.ImageText8(wid, gc, 40, 220, 'two Over fills, 55% and 85% alpha');
    });

    X.on('error', e => console.error(e));
  });
});
`,
};
