const x11 = require('../../lib');
const wid = process.argv[2];
console.log(wid);
const wids = [];
x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.QueryTree(wid ? wid : root, (err, tree) => {
        console.log(tree);    
        X.terminate();
    });
});
