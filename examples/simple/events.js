const x11 = require('../../lib');
x11.createClient((err, display) => {
    const X = display.client;
    const wid = X.AllocID();
    X.CreateWindow(wid, display.screen[0].root, 100, 100, 400, 300);
    X.ChangeWindowAttributes(wid, { eventMask: x11.eventMask.PointerMotion|x11.eventMask.KeyPress });
    X.MapWindow(wid)
    X.on('event', ev => {
        if (ev.type === 2) // keypress
            X.terminate(); 
        console.log(ev);
    });
});
