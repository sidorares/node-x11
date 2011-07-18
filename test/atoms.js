var x11 = require('../lib/x11');

var xclient = x11.createClient();

xclient.on('connect', function(display) {
    var X = this;
    var hello = 'Hello, node.js';
    X.InternAtom(false, hello, function(atomId) {
        X.GetAtomName(atomId, function(str) {
            console.log('Value for atom ' + atomId + ' is \"' + str + '\"');
        });
    });
});
