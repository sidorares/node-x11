var x11 = require('../../lib');

var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       10, 10, 400, 300, 
       0, 0, 0, 0,
       { 
           eventMask: Exposure|PointerMotion|ButtonPress|ButtonRelease
       }
    );
    X.MapWindow(wid);
  
    var gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );
    var gc1 = X.AllocID();
    X.CreateGC(gc1, wid, { foreground: white, background: black } );

    var angle = 23040;
    
    X.on('event', function(ev) {
        if (ev.type == 12)
        {
            X.PolyFillArc(wid, gc, [20, 30, 100, 100, 0, 180]); 
            X.PolyFillArc(wid, gc, [100, 100, 100, 100, 0, 360]); 
            //X.PolyFillArc(wid, gc, [40, 50, 90, 10]); 
            //X.PolyFillArc(wid, gc, [20, 80, 50, 30]); 

         } else if (ev.type == 5) {
            //console.log(ev);
            if (ev.keycode == 4)
                angle += 5;
            if (ev.keycode == 5)
                angle -= 5;
            console.log(angle);
         }

            X.PolyFillRectangle(wid, gc1, [0, 0, 1000, 1000]); 
            X.PolyFillArc(wid, gc, [0, 0, ev.x*2, ev.y*2, 0, angle]); 
            //console.log(ev.x, ev.y);
            //console.log(X.replies);
        
    });

    X.on('error', function(e) {
        console.log(e);
    });
});
