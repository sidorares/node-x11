var x11 = require('../../lib');

var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var pts = [];

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       0, 0, 400, 300, 
       0, 0, 0, 0,
       { 
           backgroundPixel: white, eventMask: Exposure|PointerMotion  
       }
    );
    X.MapWindow(wid);
  
    var gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );
    
    X.on('event', function(ev) {
        if (ev.type == 12)
        {
            //X.PolyPoint(0, wid, gc, pts);
        } else if (ev.type == 6) {
            //pts.push(ev.x);
            //pts.push(ev.y);
            X.PolyPoint(0, wid, gc, [ev.x, ev.y]);
        }
    });

    X.on('error', function(e) {
        console.log(e);
    });
});
