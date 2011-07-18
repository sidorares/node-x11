var x11 = require('../lib/x11');
var X = x11.createClient();
X.on('connect', function(display) {
    X.ListExtensions(function(list) {
        list.forEach(function(ext) {
            console.log(ext);
        });
        X.terminate();
    });
});
