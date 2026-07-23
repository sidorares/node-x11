const x11 = require('../../lib');
x11.createClient((err, display) => {
    const X = display.client; 
    const screen = display.screen[0];
    const wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 0, 0, 400, 300);
    X.MapWindow(wid);
    const interval = setInterval( () => {
        X.QueryPointer(wid, (err, res) => {
            console.log(res);
        });
    }, 1000);

    X.on('error', err => {
        console.log(err);
    });
    X.on('end', () => { clearInterval(interval); });
});

