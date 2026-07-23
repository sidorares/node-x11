const x11 = require('../../lib');
const X = x11.createClient((err, display) => {
    X.ListFonts('*', 1000, (err, list) => {
        list.forEach(ext => {
            console.log(ext);
        });
        X.terminate();
    });
});
