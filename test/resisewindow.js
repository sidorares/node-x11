var x11 = require('../lib/x11');
x11.createClient(function(display) {
    var X = display.client;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0);
    X.MapWindow(wid);
    setInterval( function() { 
         X.ResiseWindow(wid, 800, 200);
    }, 1200);
    setInterval( function() { 
         X.ResiseWindow(wid, 400, 300);
    }, 510);
});
