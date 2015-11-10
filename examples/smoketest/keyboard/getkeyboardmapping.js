var x11 = require('../../../lib');
var keysym = require('keysym');


var ks = x11.keySyms;
var ks2Name = {};
for (var key in ks)
    ks2Name[ ks[key].code ] = key;
var kk2Name = {};

x11.createClient(function(err, display) {
    var X = display.client;
    var min = display.min_keycode;
    var max = display.max_keycode;
    X.GetKeyboardMapping(min, max-min, function(err, list) {
	for (var i=0; i < list.length; ++i)
        {
            var name = kk2Name[i+min] = [];
            var sublist = list[i];
            for (var j =0; j < sublist.length; ++j)
		name.push([ks2Name[sublist[j]], sublist[j]]);
        }

        var root = display.screen[0].root;
        var wid = X.AllocID();
        var white = display.screen[0].white_pixel;
        var black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: x11.eventMask.KeyPress});
        X.MapWindow(wid);

        X.on('event', function(ev) {
            console.log(ev.type);
            console.log(ev);
            //console.log([ev.keycode, kk2Name[ev.keycode], keysym.fromKeysym(kk2Name[ev.keycode][0][1])]);
            var shift = ev.buttons & 1;
            var keySyms = kk2Name[ev.keycode];
            if (keySyms) {
              var codePoint = keysym.fromKeysym(keySyms[shift ? 1 : 0][1]).unicode;
              if (codePoint == 13)
                codePoint = 10;
              if (codePoint != 0)
                process.stdout.write(String.fromCharCode(codePoint));
               //console.log('\n', codePoint);
            }
        });
    });
});
