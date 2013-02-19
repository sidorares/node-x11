var x11 = require('../../lib');
var X = x11.createClient();
var numExt = 0;
X.on('connect', function(err, display) {
    X.ListExtensions(function(err, list) {
        console.log(list);
        list.forEach(function(ext) {
            numExt++;
            X.QueryExtension(ext, function(err, e) {
                e.name = ext;
                console.log(e);
                if (--numExt == 0)
                    X.terminate();
            });
        });
    });
});
