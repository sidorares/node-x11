/*
 * GCFunction usage example
 */
var x11 = require('../../lib');

x11.createClient(function(err, display) {
  var X = display.client;
  var root = display.screen[0].root;
  var white = display.screen[0].white_pixel;
  var black = display.screen[0].black_pixel;

  var wid = X.AllocID();
  X.CreateWindow(wid, root, 0, 0, 400, 300, 0, 0, 0, 0, { 
    backgroundPixel: black,
    eventMask: x11.eventMask.ButtonPress|x11.eventMask.Exposure });
  var gc = X.AllocID();
  X.CreateGC(gc, wid, {foreground : white, 'function' : x11.gcFunction.GXinvert});
  X.MapWindow(wid);


  X.on('event', function(ev) {

    if (ev.type === 12) {
      X.PolyFillRectangle(wid, gc, [0, 0, 400, 300]);
    }

    if (ev.type === 4) {
      var x = ev.x;
      var y = ev.y;

      X.PolyFillRectangle(wid, gc, [x - 25, y - 25, 50, 50]);
    }

  });
});

