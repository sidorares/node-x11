var x11 = require('../../lib');

var xclient = x11.createClient();
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;

xclient.on('connect', function(err, display) {
    var X = this;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       10, 10, 400, 300, 
       1, 1, 0,
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
            X.PolyText8(wid, gc, 50, 50, ['Hello, Node.JS!', ' Hello, world!']); 
        } 
    });
    X.on('error', function(e) {
        console.log(e);
    });
});
