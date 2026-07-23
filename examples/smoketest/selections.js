const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const id = parseInt(process.argv[2]);
    const root = display.screen[0].root;
    X.SetSelectionOwner(root, X.atoms.PRIMARY);
    X.GetSelectionOwner(X.atoms.PRIMARY, (err, win) => {
        console.log(err, win, root);
    });
    X.on('event', console.log);
    X.on('error', console.error);
});
