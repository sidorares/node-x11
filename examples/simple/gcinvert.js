/*
 * GCFunction usage example
 */
const x11 = require('../../lib');

x11.createClient((err, display) => {
  const X = display.client;
  const root = display.screen[0].root;
  const white = display.screen[0].white_pixel;
  const black = display.screen[0].black_pixel;

  const wid = X.AllocID();
  X.CreateWindow(wid, root, 0, 0, 400, 300, 0, 0, 0, 0, { 
    backgroundPixel: black,
    eventMask: x11.eventMask.ButtonPress|x11.eventMask.Exposure });
  const gc = X.AllocID();
  X.CreateGC(gc, wid, {foreground : white, 'function' : x11.gcFunction.GXinvert});
  X.MapWindow(wid);


  X.on('event', ev => {

    if (ev.type === 12) {
      X.PolyFillRectangle(wid, gc, [0, 0, 400, 300]);
    }

    if (ev.type === 4) {
      const x = ev.x;
      const y = ev.y;

      X.PolyFillRectangle(wid, gc, [x - 25, y - 25, 50, 50]);
    }

  });
});

