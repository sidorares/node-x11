const x11 = require('../../lib');

const xclient = x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    display.client.require('xtest', (err, Test) => {
        console.log(Test);
        setInterval(() => {
           Test.FakeInput(Test.KeyPress, 65, 0, root, 0, 0);   // space
           Test.FakeInput(Test.KeyRelease, 65, 0, root, 0, 0); // space
           console.log('click');
        }, 1000);
    });
    display.client.on('error', err => { console.log(err); });
});
