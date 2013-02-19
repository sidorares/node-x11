var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var id = parseInt(process.argv[2]);
    var root = display.screen[0].root;
    X.SetSelectionOwner(root, X.atoms.PRIMARY);
    X.GetSelectionOwner(X.atoms.PRIMARY, function(err, win) {
        console.log(err, win, root);
    });
    X.on('event', console.log);
    X.on('error', console.error);
});
