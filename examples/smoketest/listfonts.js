var x11 = require('../../lib/x11');
var X = x11.createClient(function(display) {
    X.ListFonts('*', 1000, function(err, list) {
        list.forEach(function(ext) {
            console.log(ext);
        });
        X.terminate();
    });
});
