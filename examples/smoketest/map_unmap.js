var x11 = require('../../lib');

var xclient = x11.createClient();
var PointerMotion = x11.eventMask.PointerMotion;
var mapped = true;

xclient.on('connect', function(err, display) {
    var X = this;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: white, eventMask: PointerMotion });
    X.MapWindow(wid);
    setInterval(function() {
        if (!mapped) {
            X.MapWindow(wid);
        } else {
            X.UnmapWindow(wid);
        }
        mapped = !mapped;
    }, 1000);
    
});