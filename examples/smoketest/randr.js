const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('randr', (err, Randr) => {
        //console.log(Randr);
        //Randr.QueryVersion(1, 4, console.log);
        Randr.SelectInput(root, Randr.NotifyMask.ScreenChange);
        X.on('event', ev => {
          console.log(ev);
        });
    });
    X.on('error', err => { console.log(err); });
});
