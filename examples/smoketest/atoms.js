var x11 = require('../lib/x11');
x11.createClient(function(display) {
    var X = display.client;
    var hello = 'Hello, node.js';
    X.InternAtom(false, hello, function(err, atomId) {
        X.GetAtomName(atomId, function(err, str) {
            console.log('Value for atom ' + atomId + ' is \"' + str + '\"');
            X.terminate();
        });
    });
});
