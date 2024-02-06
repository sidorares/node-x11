var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;

    X.QueryKeymap(function query(err, keys) {
        console.log(keys);

        X.QueryKeymap(query);
    });
});
