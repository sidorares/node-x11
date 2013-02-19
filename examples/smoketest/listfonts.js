var x11 = require('../../lib');
var X = x11.createClient(function(err, display) {
    X.ListFonts('*', 1000, function(err, list) {
        list.forEach(function(ext) {
            console.log(ext);
        });
        X.terminate();
    });
});
