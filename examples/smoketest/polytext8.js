const x11 = require('../../lib');

const xclient = x11.createClient();
const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;

xclient.on('connect', function(err, display) {
    const X = this;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

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

    X.on('event', ev => {
        if (ev.type == 12)
        {
            X.PolyText8(wid, gc, 50, 50, ['Hello, Node.JS!', ' Hello, world!']); 
        } 
    });
    X.on('error', e => {
        console.log(e);
    });
});
