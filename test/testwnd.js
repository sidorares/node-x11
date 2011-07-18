var x11 = require('../lib/x11');
var Window = require('./wndwrap');

var width = 700;
var height = 500;

var xclient = x11.createClient();
xclient.on('connect', function(display) {
    var white = xclient.display.screen[0].white_pixel;
    var black = xclient.display.screen[0].black_pixel;

    var mainwnd = new Window(xclient, 0, 0, width, height, white);
    mainwnd.on('mousemove', function(ev) {
        console.log(ev.x, ev.y); 
    });
    var ch = new Window(mainwnd, 10, 10, 50, 70, black);
            ch.on('mousemove', function(ev) {
                console.log(ev);
                //ch.unmap();
                //setTimeout( function() { ch.map() }, 500);
            });

    mainwnd.map();
    /*    
    for (var x = 0; x < width; x += 20) {
        for (var y = 0; y < width; y += 20) {
            // TODO: wnd.createChild() ?
            var ch = new Window(mainwnd, x + 1, y + 1, 18, 18, 0, black);
            //ch.map();
            ch.on('mousemove', function(ev) {
                ch.unmap();
                setTimeout( function() { ch.map() }, 500);
            });
        }
    }
    */
});
