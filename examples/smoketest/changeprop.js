const x11 = require('../../lib');

const PointerMotion = x11.eventMask.PointerMotion;
x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    const wid = X.AllocID();
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    X.CreateWindow(wid, root, 0, 0, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion });
    X.MapWindow(wid);

    // mode: 0 replace, 1 prepend, 2 append
    // mode, wid, name, type, format, data
    X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'Hello, NodeJS');
    const interval = setInterval(() => {
           X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, `Hello, NodeJS ${new Date()}`);
    }, 100);
    X.on('end', () => {
        clearInterval(interval);
    });
});
