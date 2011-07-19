var x11 = require('../lib/x11');
var X = x11.createClient();
var numExt = 0;
X.on('connect', function(display) {
    X.ListExtensions(function(list) {
        console.log(list);
        list.forEach(function(ext) {
            numExt++;
            X.QueryExtension(ext, function(e) {
                e.name = ext;
                console.log(e);
                if (--numExt == 0)
                    X.terminate();
            });
        });
    });
});
