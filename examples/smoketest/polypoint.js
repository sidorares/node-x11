const x11 = require('../../lib');

const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;
const pts = [];

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    const wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       0, 0, 400, 300, 
       0, 0, 0, 0,
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
            //X.PolyPoint(0, wid, gc, pts);
        } else if (ev.type == 6) {
            //pts.push(ev.x);
            //pts.push(ev.y);
            X.PolyPoint(0, wid, gc, [ev.x, ev.y]);
        }
    });

    X.on('error', e => {
        console.log(e);
    });
});
