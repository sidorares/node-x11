var x11 = require('../../lib');
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;

var draw;

x11.createClient({ debug: true}, function(err, display) {

  var X = display.client;
  var root = display.screen[0].root;

  var wid = X.AllocID();
  X.CreateWindow(
     wid, root,
     0, 0, 800, 600,
     0, 0, 0, 0,
     {
        eventMask: Exposure|PointerMotion
     }
  );
  X.MapWindow(wid);


  X.require('render', function(err, Render) {

    var pixMask = X.AllocID();
    X.CreatePixmap(pixMask, wid, 8, 600, 600);
    var pictTraps = X.AllocID();
    Render.CreatePicture(pictTraps, pixMask, Render.a8);

    var pictWin = X.AllocID();
    Render.CreatePicture(pictWin, wid, Render.rgb24);

    var pictSolid = X.AllocID();
    r = 0.2; g = 0.2; b = 0.2; a = 1;
    Render.CreateSolidFill(pictSolid, r, g, b, a);

    draw = function(x, y) {
      var r, g, b, a;

      // fill window
      //r = x/1000; g = x/1000; b = x/1000; a = 0.5;
      r = 1; g = 1; b = 1; a = 0.5;
      Render.FillRectangles(1, pictWin, [r, g, b, a], [0, 0, 1000, 1000])

      // fill traps
      r = 0; g = 0; b = 0; a = 0;
      Render.FillRectangles(1, pictTraps, [r, g, b, a], [0, 0, 1000, 1000])

      Render.AddTraps(pictTraps, 0, 0, [
        x, 200, y,
        //150, 200, 50,
        5, 250, 300,
        110, 200, 310,
        50, 150, 500
      ]);


      // (op, src, mask, dst, srcX, srcY, maskX, maskY, dstX, dstY, width, height)
      //Render.Composite(Render.PictOp.Over, pictSolid, pictTraps, pictWin, 0, 0, 0, 0, 0, 0, 800, 600);
      //Render.PictOp.Over

      Render.Composite(Render.PictOp.Over, pictSolid, pictTraps, pictWin, 0, 0, 0, 0, 0, 0, 800, 600);
    };

  });

}).on('error', function(err) {
    //console.log(err);
}).on('event', function(ev) {
    //console.log(ev);
    if (ev.name == 'MotionNotify') {
      draw(ev.x, ev.y);
    }
});
