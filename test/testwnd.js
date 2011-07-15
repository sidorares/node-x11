var x11 = require('../lib/x11');
var Window = require('./wndwrap');

var width = 700;
var height = 500;

var xclient = x11.createClient();
xclient.on('connect', function(display) {
    var white = xclient.display.screen[0].white_pixel;
    var black = xclient.display.screen[0].black_pixel;

    var mainwnd = new Window(xclient, 0, 0, width, height, black);
    for (var x = 0; x < width; x += 20) {
        for (var y = 0; y < width; y += 20) {
            // TODO: wnd.createChild() ?
            var ch = new Window(xclient, x + 1, y + 1, 18, 18, 0, white);
            ch.on('mousemove', function(ev) {
                ch.unmap();
                setTimeout( function() { ch.map() }, 500);
            });
        }
    }
});
