const x11 = require('../../lib');
x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    const wid = X.AllocID();
    X.CreateWindow(wid, root, 10, 10, 400, 300);
    X.MapWindow(wid);
    setInterval( () => { 
         X.ResizeWindow(wid, 800, 200);
    }, 1200);
    const interval = setInterval( () => { 
         X.ResizeWindow(wid, 400, 300);
    }, 510);
    X.on('end', () => { clearInterval(interval)});
});
