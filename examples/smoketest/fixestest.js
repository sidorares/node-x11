const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('fixes', (err, Fixes) => {
        console.log(Fixes);
        const win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, 100, 100);
        //Fixes.ChangeSaveSet(win, Fixes.SaveSetMode.Insert, Fixes.SaveSetTarget.Nearest, Fixes.SaveSetMap.Map);
        X.on('event', ev => {
          console.log(ev);
        });
    });
    X.on('error', err => { console.log(err); });

});
