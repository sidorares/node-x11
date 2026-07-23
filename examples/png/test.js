const logo = require('./node-png').readPng('./node-logo.png');

const x11 = require('../../lib');

const Exposure = x11.eventMask.Exposure;

x11.createClient((err, display) => {
  const X = display.client;
  X.require('render', (err, Render) => {
    const root = display.screen[0].root;
    main(root, X, Render);
  });
});


function main(root, X, Render) {

  let picWin, pic;

  const win = X.AllocID();
  X.CreateWindow(
     win, root,
     0, 0, logo.width, logo.height,
     0, 0, 0, 0,
     { eventMask: Exposure }
  );
  X.MapWindow(win);

  const gc = X.AllocID();
  X.CreateGC(gc, win);

  const logoPixmap = X.AllocID();
  X.CreatePixmap(logoPixmap, win, 24, logo.width, logo.height);
  // TODO: add proper png pixel conversion here
  X.PutImage(2, logoPixmap, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);

  const logoPicture = X.AllocID();
  Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
  const winPicture = X.AllocID();
  Render.CreatePicture(winPicture, win, Render.rgb24);

  X.on('event', ev => {
    if (ev.name == 'Expose')
      Render.Composite(3, logoPicture, 0, winPicture, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
  });
}
