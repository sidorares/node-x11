const Buffer = require('buffer').Buffer;
const x11 = require('../../lib');

const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;

const bitmap = Buffer.alloc(128*128*4); // 16384 bits, 2048 bytes bitmap
for (let i=0; i < bitmap.length; ++i)
{
    const byteNum = i%4;
    if (byteNum == 0)
        bitmap[i] = parseInt((i/512)%256);
    if (byteNum == 1)
        bitmap[i] = parseInt((i/2048)%256);
    if (byteNum == 2)
        bitmap[i] = parseInt((i/256)%256);
    if (byteNum == 2)
        bitmap[i] = parseInt((i/1024)%256);

}

x11.createClient((err, display) => {
    if (err) throw err;

    const X = display.client;
X.require('render', (err, Render) => {

    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;
    //console.log(display.screen[0]);

    const wid = X.AllocID();
    X.CreateWindow(
       wid, root,
       10, 10, 400, 300,
       1, 1, 0,
       {
           backgroundPixel: white, eventMask: Exposure|PointerMotion
       }
    );
    X.MapWindow(wid);

    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );

    const pixmap1 = X.AllocID();
    X.CreatePixmap(pixmap1, wid, 32, 128, 128);
    const pic = X.AllocID();
    Render.CreatePicture(pic, pixmap1, Render.rgba32);


    const pic1 = X.AllocID();
    Render.CreatePicture(pic1, wid, Render.rgb24);

    X.on('event', ev => {
        if (ev.type == 12) // expose
        {
            X.PutImage(2, wid, gc, 128, 128, 0, 0, 0, 24, bitmap);
            X.PutImage(2, pixmap1, gc, 128, 128, 0, 0, 0, 32, bitmap);
            //Render.Composite(3, pic1, 0, pic, 0, 0, 0, 0, 30, 40, 128, 128);

        }
    });
    X.on('error', e => {
        console.log(e);
    });

});

});
