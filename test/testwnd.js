var x11 = require('../lib/x11');
var Window = require('./wndwrap');

var width = 700;
var height = 500;

var xclient = x11.createClient();
xclient.on('connect', function(display) {
    console.log(xclient.display.white_pixel);
    var mainwnd = new Window(xclient, 0, 0, width, height, xclient.display.white_pixel);
    /*
    for (var x = 0; x < width; x += 10) {
        for (var y = 0; y < width; y += 10) {
            var ch = new Window(mainwnd, x, y, 10, 10, 0);
        }
    }
    */
    //mainwnd.on('mousemove', function(ev) {
    //    console.log(ev.x, ev.y);
    //});
});
