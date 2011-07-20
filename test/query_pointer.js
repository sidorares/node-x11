var x11 = require('../lib/x11');
var X = x11.createClient();

X.on('connect', function(display) {

    var screen = display.screen[0];
    var wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: screen.white_pixel });
    X.MapWindow(wid);
    setInterval( function() {
        X.QueryPointer(wid, function(res) {
            console.log(res);
        });
    }, 1000);

});

X.on('error', function(err) {
    console.log(err);
});
