//var logo = require('./node-png').readPng('./node-logo.png');
const fs = require('fs');
const Decoder = require('./png-decoder');
const decoder = new Decoder();

const logo = {
  data : Buffer.from(decoder.parse(fs.readFileSync('./screen.png'))),
  width : decoder._IHDR.width,
  height : decoder._IHDR.height
};

const x11 = require('../../lib');

const Exposure = x11.eventMask.Exposure;

x11.createClient((err, display) => {
  const X = display.client;
  X.require('render', (err, Render) => {
    const root = display.screen[0].root;
    main(root, X, Render, display);
  });
});


function main(root, X, Render, display) {

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

  const rscreen = display.screen[0];
  const screen =
    rscreen.depths[rscreen.root_depth][
      Object.keys(rscreen.depths[rscreen.root_depth])[0]];

  const rmask = parseInt(screen.red_mask, 10);
  const gmask = parseInt(screen.green_mask, 10);
  const bmask = parseInt(screen.blue_mask, 10);

  for (let y = 0; y < logo.height; y++) {
    for (let x = 0; x < logo.width; x++) {
      const pixel = Buffer.from([
        logo.data[(x + logo.width * y) * 4],
        logo.data[(x + logo.width * y) * 4 + 1],
        logo.data[(x + logo.width * y) * 4 + 2], 0]).readInt32LE();

      logo.data[(x + logo.width * y) * 4 ] = (pixel & rmask) >> 16;
      logo.data[(x + logo.width * y) * 4 + 1] = (pixel & gmask) >> 8;
      logo.data[(x + logo.width * y) * 4 + 2] = (pixel & bmask) >> 0;
      logo.data[(x + logo.width * y) * 4 + 3] = 0x00;
    }
  }

  X.PutImage(2, logoPixmap, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);

  const logoPicture = X.AllocID();
  Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
  const winPicture = X.AllocID();
  Render.CreatePicture(winPicture, win, Render.rgb24);

  X.on('event', ev => {
    if (ev.name == 'Expose') {
      Render.Composite(3, logoPicture, 0, winPicture, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
    }
  });
}
