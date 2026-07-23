const x11 = require('../../lib');
x11.createClient((err, display) => {
    console.log(display.screen[0])
    const X = display.client;
    const wid = X.AllocID();
    X.CreateWindow(wid, display.screen[0].root, 100, 100, 400, 300,
    11,
    32,
    0,
    613
    );
    X.MapWindow(wid);
    X.on('error', err => { console.log(err) });
});
