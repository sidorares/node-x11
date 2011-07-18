var x11 = require('../lib/x11');

var xclient = x11.createClient();

xclient.on('connect', function(display) {
    var X = this;
    var hello = 'Hello, node.js';
    X.InternAtom(false, hello, function(atomId) {
        console.log(atomId);
    });
    X.InternAtom(true, 'test', function(atomId) {
        console.log(atomId);
    });
});
