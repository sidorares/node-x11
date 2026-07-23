const x11 = require('../../lib');
x11.createClient((err, display) => {
    const X = display.client;
    const hello = 'Hello, node.js';
    X.InternAtom(false, hello, (err, atomId) => {
        X.GetAtomName(atomId, (err, str) => {
            console.log(`Value for atom ${atomId} is "${str}"`);
            X.terminate();
        });
    });
});
