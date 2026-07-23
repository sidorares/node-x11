const x11 = require('../../lib');

const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;
const ButtonPress = x11.eventMask.ButtonPress;
const ButtonRelease = x11.eventMask.ButtonRelease;

//function drawEyes(w, h

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    const wid = X.AllocID();
    X.CreateWindow(
       wid, root,
       10, 10, 400, 300,
       0, 0, 0, 0,
       {
           eventMask: Exposure|PointerMotion|ButtonPress|ButtonRelease
       }
    );
    X.MapWindow(wid);

    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );
    const gc1 = X.AllocID();
    X.CreateGC(gc1, wid, { foreground: white, background: black } );

    let angle = 23040;

    X.on('event', ev => {
        if (ev.type == 12)
        {
            X.PolyFillArc(wid, gc, [20, 30, 100, 100, 0, 180]);
            X.PolyFillArc(wid, gc, [100, 100, 100, 100, 0, 360]);
            //X.PolyFillArc(wid, gc, [40, 50, 90, 10]);
            //X.PolyFillArc(wid, gc, [20, 80, 50, 30]);

         } else if (ev.type == 5) {
            //console.log(ev);
            if (ev.keycode == 4)
                angle += 5;
            if (ev.keycode == 5)
                angle -= 5;
            console.log(angle);
         }

            X.PolyFillRectangle(wid, gc1, [0, 0, 1000, 1000]);
            X.PolyFillArc(wid, gc, [0, 0, ev.x*2, ev.y*2, 0, angle]);
            //console.log(ev.x, ev.y);
            //console.log(X.replies);

    });

    X.on('error', e => {
        console.log(e);
    });
});
