var x11 = require('../lib/x11');
var wid = process.argv[2];
console.log(wid);
var wids = [];
x11.createClient(function(display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.QueryTree(wid ? wid : root, function(err, tree) {
        console.log(tree);    
        X.terminate();
    });
});
