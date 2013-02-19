var x11 = require('../../lib');

var PointerMotion = x11.eventMask.PointerMotion;
x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var wid = X.AllocID();
    X.CreateWindow(wid, root, 0, 0, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion }); 
    var gc = X.AllocID();
    X.CreateGC(gc, wid);     
    X.MapWindow(wid);
});
