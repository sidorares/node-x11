const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('composite', (err, Composite) => {
      X.require('damage', (err, Damage) => {
        const wid = parseInt(process.argv[2]);
        //Composite.GetOverlayWindow(wid, function(err, overlayid) {
        //  console.log("OVERLAY:", err, overlayid);
        //});
        //Composite.RedirectWindow(wid, Composite.Redirect.Automatic);
        const pixmap = X.AllocID();
        Composite.NameWindowPixmap(wid, pixmap);
        const damage = X.AllocID();
        Damage.Create(damage, wid, Damage.ReportLevel.NonEmpty);


        const newwin = X.AllocID();
        X.CreateWindow(newwin, display.screen[0].root, 200, 200, 200, 200, 0, 0, 0, 0, { eventMask: x11.eventMask.Exposure})
        const gc = X.AllocID();
        X.CreateGC(gc, newwin);
        X.MapWindow(newwin);

        X.on('event', ev => {
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
    X.on('error', err => { console.log(err); });

});
