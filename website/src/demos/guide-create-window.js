export default {
  id: 'guide-create-window',
  title: 'Create and map a window',
  description: 'The smallest thing that puts something on screen.',
  // Guide-scoped: small enough to read inside prose, so it stays out of the
  // playground picker where the fuller demos live.
  playground: false,
  screenWidth: 420,
  screenHeight: 260,
  height: 260,
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 40, 30, 340, 200, 2, 0, 0, 0, {
    backgroundPixel: 0x3498db,
    borderPixel: 0x1b4f72
  });
  X.MapWindow(wid);

  console.log('window ' + wid + ' is on screen');
});
`,
};
