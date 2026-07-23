const x11 = require('../../lib');

x11.createClient((err, display) => {
    if (err) {
        throw err;
    }
    const X = display.client;

    X.QueryKeymap(function query(err, keys) {
        if (err) {
            throw err;
        }
        console.log(keys);
        X.QueryKeymap(query);
    });
});
