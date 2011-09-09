var Buffer = require('buffer').Buffer;
var x11 = require('../lib/x11');

var xclient = x11.createClient();
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
                
}

xclient.on('connect', function(display) {

    var X = display.client;   
    X.require('big-requests', function(BigReq) {
       
        BigReq.Enable(function(maxLen) { console.log( maxLen ); });

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

    X.on('event', function(ev) {
        if (ev.type == 12) // expose
        {
            X.PutImage(2, wid, gc, 128, 128, 0, 0, 0, 24, bitmap);
        } 
    });
    X.on('error', function(e) {
        console.log(e);
    });

    });
});
