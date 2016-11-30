//var logo = require('./node-png').readPng('./node-logo.png');
var fs = require('fs');
var Decoder = require('./png-decoder');
var decoder = new Decoder();

var logo = {
  data : Buffer.from(decoder.parse(fs.readFileSync('./screen.png'))),
  width : decoder._IHDR.width,
  height : decoder._IHDR.height
};

var x11 = require('../../lib');

var Exposure = x11.eventMask.Exposure;

x11.createClient(function(err, display)
{
  var X = display.client;
  X.require('render', function(err, Render) {
    var root = display.screen[0].root;
    main(root, X, Render, display);
  });
});


function main(root, X, Render, display) {

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

  var rscreen = display.screen[0];
  var screen =
    rscreen.depths[rscreen.root_depth][
      Object.keys(rscreen.depths[rscreen.root_depth])[0]];

  var rmask = parseInt(screen.red_mask, 10);
  var gmask = parseInt(screen.green_mask, 10);
  var bmask = parseInt(screen.blue_mask, 10);

  for (var y = 0; y < logo.height; y++) {
    for (var x = 0; x < logo.width; x++) {
      var pixel = Buffer.from([
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

  var logoPicture = X.AllocID();
  Render.CreatePicture(logoPicture, logoPixmap, Render.rgb24);
  var winPicture = X.AllocID();
  Render.CreatePicture(winPicture, win, Render.rgb24);

  X.on('event', function(ev) {
    if (ev.name == 'Expose') {
      Render.Composite(3, logoPicture, 0, winPicture, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
    }
  });
}
