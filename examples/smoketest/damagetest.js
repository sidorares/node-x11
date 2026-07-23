const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('damage', (err, Damage) => {
        console.log(Damage);
        const id = parseInt(process.argv[2]);
        const damage = X.AllocID();
        Damage.Create(damage, id, Damage.ReportLevel.NonEmpty);
        X.on('event', ev => {
          Damage.Subtract(damage, 0, 0);
          console.log(ev);
        });
    });
    X.on('error', err => { console.log(err); });

});
