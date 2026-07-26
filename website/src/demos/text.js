export default {
  id: 'text',
  title: 'Text',
  description: 'Open a font and render text with ImageText8.',
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 40, 40, 460, 220, 0, 0, 0, 0, {
    backgroundPixel: screen.white_pixel,
    eventMask: x11.eventMask.Exposure
  });
  X.MapWindow(wid);

  const fid = X.AllocID();
  X.OpenFont(fid, 'fixed');

  const gc = X.AllocID();
  X.CreateGC(gc, wid, {
    font: fid,
    foreground: 0x222222,
    background: screen.white_pixel
  });

  X.on('event', ev => {
    if (ev.name !== 'Expose') return;
    X.ImageText8(wid, gc, 20, 40, 'ImageText8 on a JS X server');
    X.ChangeGC(gc, { foreground: 0xb03030 });
    X.ImageText8(wid, gc, 20, 80, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    X.ImageText8(wid, gc, 20, 104, 'abcdefghijklmnopqrstuvwxyz');
    X.ImageText8(wid, gc, 20, 128, '0123456789 !"#$%&\\'()*+,-./');
    X.ChangeGC(gc, { foreground: 0x1c4e80 });
    X.ImageText8(wid, gc, 20, 168, 'Every font name maps to a built-in 8x8 font.');
  });
});
`,
};
