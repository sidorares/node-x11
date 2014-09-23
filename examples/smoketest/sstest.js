var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    //X.ForceScreenSaver(0);
    X.SetScreenSaver(20, 10, 2, 2);


    X.require('screen-saver', function(err, SS) {
        SS.SelectInput(root, SS.eventMask.Notify|SS.eventMask.Cycle);
        //console.log(SS);
        //setTimeout(function() {
        //    X.ForceScreenSaver(1);
        //}, 5000);
        setInterval(function() {
        SS.QueryInfo(root, function(err, info) {
            console.log(info.until);
            //SS.SelectInput(root, SS.eventMask.Notify|SS.eventMask.Cycle);
        });
        }, 1000);
        X.on('event', function(ev) {
            console.log(ev);
        });
    });
    X.on('error', function(err) { console.log(err); });

});
