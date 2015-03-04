var x11 = require('../../lib');
var Window = require('./wndwrap');

x11.createClient(function(err, display) {
    var X = display.client;
    var w = new Window(X, 0, 0, 700, 500);
    w.map();

    var render = function() {
      //X.ChangeGC(w.gc.id, { foreground: w.black, background: w.white });
      var gc = X.AllocID();
      X.CreateGC(gc, w.id, { foreground: w.black, background: w.white });
      X.PolyFillRectangle(w.id, gc, [50, 50, 600, 400]);
      X.ClearArea(w.id, 0, 0, 300, 300, 0);
    }

    setTimeout(render, 100); // sometimes doesn't render without a delay
});
