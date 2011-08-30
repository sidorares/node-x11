var x11 = require('../lib/x11');

var xclient = x11.createClient();
var ks = x11.keySyms;
var ks2Name = {};
for (var key in ks)
    ks2Name[ ks[key] ] = key;
var kk2Name = {};

xclient.on('connect', function(display) {
    var X = this;
    var min = display.min_keycode;
    var max = display.max_keycode;
    X.GetKeyboardMapping(min, max-min, function(list) {
	for (i in list)
        {
            var sublist = list[i];
            kk2Name[i] = [];
            for (j in sublist)
                kk2Name[i].push(ks2Name[sublist[j]]);
        }

        var root = display.screen[0].root;
        var wid = X.AllocID();
        var white = display.screen[0].white_pixel;
        var black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: white, eventMask: x11.eventMask.KeyPress});
        X.MapWindow(wid);

        X.on('event', function(ev) {
            console.log(kk2Name[ev.keycode]);
        });
    });
});
