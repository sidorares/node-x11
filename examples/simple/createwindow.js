var x11 = require('../../lib');
x11.createClient(function(err, display) {
    console.log(display.screen[0])
    var X = display.client;
    var wid = X.AllocID();
    X.CreateWindow(wid, display.screen[0].root, 100, 100, 400, 300,
    11,
    32,
    0,
    613
    );
    X.MapWindow(wid);
    X.on('error', function(err) { console.log(err) });
});
