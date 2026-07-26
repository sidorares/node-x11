export default {
  id: 'hello-window',
  title: 'Hello window',
  description: 'Create and map a window with a title and background, then draw a greeting.',
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 60, 50, 400, 240, 2, 0, 0, 0, {
    backgroundPixel: screen.white_pixel,
    borderPixel: 0x333333,
    eventMask: x11.eventMask.Exposure
  });

  // set the window title (WM_NAME property), just like on a real server
  X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8,
    'hello from node-x11');
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, {
    foreground: 0x1c4e80,
    background: screen.white_pixel
  });

  X.on('event', ev => {
    if (ev.name !== 'Expose') return;
    X.ImageText8(wid, gc, 24, 48, 'Hello, X11 world!');
    X.ImageText8(wid, gc, 24, 80, 'This window lives on a JS X server.');
  });

  console.log('window ' + wid + ' mapped on ' + display.vendor);
});
`,
};
