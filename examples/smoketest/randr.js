var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('randr', function(err, Randr) {
        //console.log(Randr);
        //Randr.QueryVersion(1, 4, console.log);
        Randr.SelectInput(root, Randr.NotifyMask.ScreenChange);
        X.on('event', function(ev) {
          console.log(ev);
        });
    });
    X.on('error', function(err) { console.log(err); });
});
