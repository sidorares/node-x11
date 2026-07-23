const x11 = require('../../lib');

const xclient = x11.createClient();
const PointerMotion = x11.eventMask.PointerMotion;
let mapped = true;

xclient.on('connect', function(err, display) {
    const X = this;
    const root = display.screen[0].root;
    const wid = X.AllocID();
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: white, eventMask: PointerMotion });
    X.MapWindow(wid);
    setInterval(() => {
        if (!mapped) {
            X.MapWindow(wid);
        } else {
            X.UnmapWindow(wid);
        }
        mapped = !mapped;
    }, 1000);
    
});