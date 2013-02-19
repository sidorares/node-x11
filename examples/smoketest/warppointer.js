var angle = 0;
var x11 = require('../../lib').createClient(function(err, display) {
    setInterval(function() {
        var x = 500 + 100*Math.cos(angle);
        var y = 500 + 100*Math.sin(angle);
        display.client.WarpPointer(0, display.screen[0].root, 0, 0, 0, 0, parseInt(x), parseInt(y));
        angle += 0.05;
    }, 100);
});
