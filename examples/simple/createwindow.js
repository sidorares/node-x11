var x11 = require('../../lib/x11');
x11.createClient(function(display) {
    var X = display.client;
    var wid = X.AllocID();
    X.CreateWindow(wid, display.screen[0].root, 100, 100, 400, 300);
    X.MapWindow(wid);
});
