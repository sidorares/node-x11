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

    // mode: 0 replace, 1 prepend, 2 append
    // mode, wid, name, type, format, data
    X.ChangeProperty(0, wid, xclient.atoms.WM_NAME, xclient.atoms.STRING, 8, 'Hello, NodeJS');
 
    setInterval(function() {
           X.ChangeProperty(0, wid, xclient.atoms.WM_NAME, xclient.atoms.STRING, 8, 'Hello, NodeJS ' + new Date());
    }, 100);
});