var Buffer = require('buffer').Buffer;
var x11 = require('../../lib');

var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;

var bitmap = new Buffer(128*128*4); // 16384 bits, 2048 bytes bitmap
for (var i=0; i < bitmap.length; ++i)
{
    var byteNum = i%4;
    if (byteNum == 0)
        bitmap[i] = parseInt((i/512)%256);
    if (byteNum == 1)
        bitmap[i] = parseInt((i/2048)%256);
    if (byteNum == 2)
        bitmap[i] = parseInt((i/256)%256);
    if (byteNum == 2)
        bitmap[i] = parseInt((i/1024)%256);

}

x11.createClient(function(err, display) {
    if (err) throw err;

    var X = display.client;
X.require('render', function(err, Render) {

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
       }
    );
    X.MapWindow(wid);

    var gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );

    var pixmap1 = X.AllocID();
    X.CreatePixmap(pixmap1, wid, 32, 128, 128);
    var pic = X.AllocID();
    Render.CreatePicture(pic, pixmap1, Render.rgba32);


    var pic1 = X.AllocID();
    Render.CreatePicture(pic1, wid, Render.rgb24);

    X.on('event', function(ev) {
        if (ev.type == 12) // expose
        {
            X.PutImage(2, wid, gc, 128, 128, 0, 0, 0, 24, bitmap);
            X.PutImage(2, pixmap1, gc, 128, 128, 0, 0, 0, 32, bitmap);
            //Render.Composite(3, pic1, 0, pic, 0, 0, 0, 0, 30, 40, 128, 128);

        }
    });
    X.on('error', function(e) {
        console.log(e);
    });

});

});
