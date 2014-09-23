var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('composite', function(err, Composite) {
      X.require('damage', function(err, Damage) {
        var wid = parseInt(process.argv[2]);
        //Composite.GetOverlayWindow(wid, function(err, overlayid) {
        //  console.log("OVERLAY:", err, overlayid);
        //});
        //Composite.RedirectWindow(wid, Composite.Redirect.Automatic);
        var pixmap = X.AllocID();
        Composite.NameWindowPixmap(wid, pixmap);
        var damage = X.AllocID();
        Damage.Create(damage, wid, Damage.ReportLevel.NonEmpty);


        var newwin = X.AllocID();
        X.CreateWindow(newwin, display.screen[0].root, 200, 200, 200, 200, 0, 0, 0, 0, { eventMask: x11.eventMask.Exposure})
        var gc = X.AllocID();
        X.CreateGC(gc, newwin);
        X.MapWindow(newwin);

        X.on('event', function(ev) {
          console.log(ev);
          if (ev.type == 13)
             return;
          Damage.Subtract(damage, 0, 0);
          // srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height
          X.CopyArea(wid, newwin, gc, 0, 0, 0, 0, 200, 200);
          //X.CopyArea(pixmap, newwin, gc, 0, 0, 0, 0, 200, 200);
        });
      });
    });
    X.on('error', function(err) { console.log(err); });

});
