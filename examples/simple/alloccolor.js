var x11 = require('../../lib');

var Exposure = x11.eventMask.Exposure;

x11.createClient(function(err, display) {
    var repaint;
    var X = display.client;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       10, 10, 400, 300 
    );
    X.MapWindow(wid);
  
    // parameters: colormap, red, green, blue
    X.AllocColor(display.screen[0].default_colormap, 0xffff, 0xffff, 0, function(err, color) {
        var gc = X.AllocID();
        X.CreateGC(gc, wid, { foreground: color.pixel, background: black } );
        repaint = setInterval(function() {
            X.PolyFillRectangle(wid, gc, [100, 100, 200, 100]);
        }, 1000);
    });
    X.on('error', function(e) {
        console.log(e);
    });
    X.on('end', function() {
        console.log('client destroyed');
        clearInterval(repaint);
    });
});
