var x11 = require('../../lib');
var X = x11.createClient();
X.on('connect', function(err, display) {
    X.ListExtensions(function(err, list) {
        list.forEach(function(ext) {
            console.log(ext);
        });
        X.terminate();
    });
});
