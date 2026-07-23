const x11 = require('../../lib');
const X = x11.createClient();
let numExt = 0;
X.on('connect', (err, display) => {
    X.ListExtensions((err, list) => {
        console.log(list);
        list.forEach(ext => {
            numExt++;
            X.QueryExtension(ext, (err, e) => {
                e.name = ext;
                console.log(e);
                if (--numExt == 0)
                    X.terminate();
            });
        });
    });
});
