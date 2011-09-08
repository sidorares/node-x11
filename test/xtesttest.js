var x11 = require('../lib/x11');

var xclient = x11.createClient(function(display) {
    var X = display.client;
    var root = display.screen[0].root;
    display.client.require('xtest', function(Test) {
        console.log(Test);
        setInterval(function() {
           Test.FakeInput(Test.KeyPress, 65, 0, root, 0, 0);   // space
           Test.FakeInput(Test.KeyRelease, 65, 0, root, 0, 0); // space
           console.log('click');
        }, 1000);
    });
    display.client.on('error', function(err) { console.log(err); });
});
