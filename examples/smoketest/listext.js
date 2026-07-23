const x11 = require('../../lib');
const X = x11.createClient();
X.on('connect', (err, display) => {
    X.ListExtensions((err, list) => {
        list.forEach(ext => {
            console.log(ext);
        });
        X.terminate();
    });
});
