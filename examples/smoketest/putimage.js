const Buffer = require('buffer').Buffer;
const x11 = require('../../lib');
const fs = require('fs');
const logo1bit = fs.readFileSync('./nodejs-black.bmp');
const pixmap = require('./bmp').decodeBuffer(logo1bit);

const xclient = x11.createClient();
const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;

const bitmap = Buffer.alloc(128*128/8); // 16384 bits, 2048 bytes bitmap
for (let i=0; i < bitmap.length; ++i)
{
    bitmap[i] = i % 256;
}

xclient.on('connect', function(err, display) {
    const X = this;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;
    //console.log(display.screen[0]);

    const wid = X.AllocID();
    X.CreateWindow(
       wid, root,
       10, 10, 400, 300,
       0, 0, 0, 0,
       {
           backgroundPixel: white, eventMask: Exposure|PointerMotion
       }
    );
    X.MapWindow(wid);
  
    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );

    X.on('event', ev => {
        if (ev.type == 12) // expose
        {
            //X.PutImage(0, wid, gc, 128, 128, 20, 20, 0, 1, bitmap);
            X.PutImage(0, wid, gc, pixmap.width, pixmap.height, 20, 20, 0, pixmap.depth, pixmap.data);
        } 
    });
    X.on('error', e => {
        console.log(e);
    });
});
