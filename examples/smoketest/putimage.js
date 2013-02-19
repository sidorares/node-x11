var Buffer = require('buffer').Buffer;
var x11 = require('../../lib');
var fs = require('fs');
var logo1bit = fs.readFileSync('./nodejs-black.bmp');
var pixmap = require('./bmp').decodeBuffer(logo1bit);

var xclient = x11.createClient();
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;

var bitmap = new Buffer(128*128/8); // 16384 bits, 2048 bytes bitmap
for (var i=0; i < bitmap.length; ++i)
{
    bitmap[i] = i % 256;
}

xclient.on('connect', function(err, display) {
    var X = this;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;
    //console.log(display.screen[0]);

    var wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       10, 10, 400, 300, 
       1, 1, 0,
       { 
           backgroundPixel: white, eventMask: Exposure|PointerMotion  
       wid, root,
       10, 10, 400, 300,
       0, 0, 0, 0,
       {
           backgroundPixel: white, eventMask: Exposure|PointerMotion
       }
    );
    X.MapWindow(wid);
  
    var gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );

    X.on('event', function(ev) {
        if (ev.type == 12) // expose
        {
            //X.PutImage(0, wid, gc, 128, 128, 20, 20, 0, 1, bitmap);
            X.PutImage(0, wid, gc, pixmap.width, pixmap.height, 20, 20, 0, pixmap.depth, pixmap.data);
        } 
    });
    X.on('error', function(e) {
        console.log(e);
    });
});
