var x11 = require('../lib/x11');

x11.createClient(function(display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('composite', function(Composite) {
        console.log(Composite);
        //Composite.GetOverlayWindow(root, function(overleyid) {
        //  console.log(overlayid);
        //});
        Composite.RedirectWindow(root, Composite.Redirect.Automatic);
        X.on('event', function(ev) {
          console.log(ev);
        });
    });
    X.on('error', function(err) { console.log(err); });
 
});
