var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('apple-wm', function(err, AppleWM) {
        //AppleWM.SetFrontProcess();
        //AppleWM.CanQuit(true);
        AppleWM.SelectInput(AppleWM.NotifyMask.All)

        /*
        for (level in AppleWM.WindowLevel)
        {
            var win = X.AllocID();
            X.CreateWindow(win, root, 0, 0, 300, 300);
            X.MapWindow(win);
            X.ChangeProperty(0, win, X.atoms.WM_NAME, X.atoms.STRING, 8, level);
            AppleWM.SetWindowLevel(win, AppleWM.WindowLevel[level]);
        };
        */
        /* //???? don't see the difference
            var win1 = X.AllocID();
            X.CreateWindow(win1, root, 0, 0, 300, 300);
            X.MapWindow(win1);
            X.ChangeProperty(0, win1, X.atoms.WM_NAME, X.atoms.STRING, 8, "parent");
            var win2 = X.AllocID();
            X.CreateWindow(win2, root, 0, 0, 200, 200);
            X.MapWindow(win2);
            X.ChangeProperty(0, win2, X.atoms.WM_NAME, X.atoms.STRING, 8, "child");
            AppleWM.AttachTransient(win2, win1);
         */
         //AppleWM.SendPSN(0, 0);

         var win = X.AllocID();
         X.CreateWindow(win, root, 0, 0, 800, 800, 0, 0, 0, 0, { eventMask: x11.eventMask.Exposure} );
         X.MapWindow(win);
         // (screen, window, frameClass, attr, ix, iy, iw, ih, ox, oy, ow, oh, titleLength)
         var gc = X.AllocID();
         X.CreateGC(gc, win);

         function r(v) { var res =  parseInt(Math.random()*v); console.log(res); return res;}
         function df() { X.PolyFillRectangle(win, gc, [0, 0, 1000, 1000]); AppleWM.FrameDraw(0, win, 65535, r(65535), 30, 30, 500, 50, 0, 0, 550, 100, "title title");}
         //setInterval(df, 100);
         X.on('event', function(ev) { console.log("Event", ev); df(); });
    });
    X.on('error', function(err) { console.log("Error", err); });

});
