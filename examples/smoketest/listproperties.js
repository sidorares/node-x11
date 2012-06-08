var x11 = require('../../lib/x11');

x11.createClient(function(display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.ListProperties(root, function(err, atoms) { console.log(atoms); });
    //X.on('event', console.log);
    //X.on('error', console.error);
});
