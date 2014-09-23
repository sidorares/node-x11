var logo = require('./node-png').readPng('./node-logo.png');

var x11 = require('../../lib');

var Exposure = x11.eventMask.Exposure;

x11.createClient(function(err, display)
{
  var X = display.client;
  X.require('render', function(err, Render) {
    var root = display.screen[0].root;
    main(root, X, Render);
  });
});


function main(root, X, Render) {

  var win, picWin, pic, gc;

  win = X.AllocID();
  X.CreateWindow(
     win, root,
     0, 0, logo.width, logo.height,
     0, 0, 0, 0,
     { eventMask: Exposure }
  );
  X.MapWindow(win);

  gc = X.AllocID();
  X.CreateGC(gc, win);

  var logoPixmap = X.AllocID();
  X.CreatePixmap(logoPixmap, win, 24, logo.width, logo.height);
  // TODO: add proper png pixel conversion here
  X.PutImage(2, logoPixmap, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);

  var logoPicture = X.AllocID();
  Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
  var winPicture = X.AllocID();
  Render.CreatePicture(winPicture, win, Render.rgb24);

  X.on('event', function(ev) {
    if (ev.name == 'Expose')
      Render.Composite(3, logoPicture, 0, winPicture, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
  });
}
