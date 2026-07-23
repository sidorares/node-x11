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
            X.PolyFillRectangle(wid, gc, [20, 30, 50, 90]); 
            X.PolyFillRectangle(wid, gc, [40, 50, 90, 10]); 
            X.PolyFillRectangle(wid, gc, [20, 80, 50, 30]); 

         } else if (ev.type == 6) {
            //console.log(ev.x, ev.y);
            //console.log(X.replies);
        }
    });

    X.on('error', e => {
        console.log(e);
    });
});