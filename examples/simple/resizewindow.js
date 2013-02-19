var x11 = require('../../lib');
x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    X.CreateWindow(wid, root, 10, 10, 400, 300);
    X.MapWindow(wid);
    setInterval( function() { 
         X.ResizeWindow(wid, 800, 200);
    }, 1200);
    var interval = setInterval( function() { 
         X.ResizeWindow(wid, 400, 300);
    }, 510);
    X.on('end', function() { clearInterval(interval)});
});
