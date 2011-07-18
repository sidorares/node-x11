var x11 = require('../lib/x11');

var xclient = x11.createClient();
var PointerMotion = x11.eventMask.PointerMotion;

xclient.on('connect', function(display) {
    var X = this;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: white, eventMask: PointerMotion });
    X.MapWindow(wid);

    var wid1 = X.AllocID();    
    X.CreateWindow(wid1, root, 10, 10, 40, 30, 1, 1, 0, { backgroundPixel: black, eventMask: PointerMotion });
    X.MapWindow(wid1);
});