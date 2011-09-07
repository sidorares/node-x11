var angle = 0;
var x11 = require('../lib/x11').createClient(function(display) {
    setInterval(function() {
        var x = 500 + 100*Math.cos(angle*100);
        var y = 500 + 100*Math.sin(angle*100);
        display.client.WarpPointer(0, display.screen[0].root, 0, 0, 0, 0, parseInt(x), parseInt(y));
        angle += 0.05;
    }, 100);
});
