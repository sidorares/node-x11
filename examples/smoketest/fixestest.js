var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('fixes', function(err, Fixes) {
        console.log(Fixes);
        var win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, 100, 100);
        //Fixes.ChangeSaveSet(win, Fixes.SaveSetMode.Insert, Fixes.SaveSetTarget.Nearest, Fixes.SaveSetMap.Map);
        X.on('event', function(ev) {
          console.log(ev);
        });
    });
    X.on('error', function(err) { console.log(err); });

});
