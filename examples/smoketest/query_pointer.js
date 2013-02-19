var x11 = require('../../lib');
x11.createClient(function(err, display) {
    var X = display.client; 
    var screen = display.screen[0];
    var wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 0, 0, 400, 300);
    X.MapWindow(wid);
    var interval = setInterval( function() {
        X.QueryPointer(wid, function(err, res) {
            console.log(res);
        });
    }, 1000);

    X.on('error', function(err) {
        console.log(err);
    });
    X.on('end', function () { clearInterval(interval); });
});

