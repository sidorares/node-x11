var x11 = require('../../lib');

var PointerMotion = x11.eventMask.PointerMotion;
x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    X.CreateWindow(wid, root, 0, 0, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion });
    X.MapWindow(wid);

    // mode: 0 replace, 1 prepend, 2 append
    // mode, wid, name, type, format, data
    X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'Hello, NodeJS');
    var interval = setInterval(function() {
           X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'Hello, NodeJS ' + new Date());
    }, 100);
    X.on('end', function() {
        clearInterval(interval);
    });
});
