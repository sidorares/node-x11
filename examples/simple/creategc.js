const x11 = require('../../lib');

const PointerMotion = x11.eventMask.PointerMotion;
x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    const wid = X.AllocID();
    X.CreateWindow(wid, root, 0, 0, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion }); 
    const gc = X.AllocID();
    X.CreateGC(gc, wid);     
    X.MapWindow(wid);
});
