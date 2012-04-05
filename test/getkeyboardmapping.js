var x11 = require('../lib/x11');

var ks = x11.keySyms;
var ks2Name = {};
for (var key in ks)
    ks2Name[ ks[key] ] = key;
var kk2Name = {};

x11.createClient(function(display) {
  var X = display.client;
  var min = display.min_keycode;
  var max = display.max_keycode;
  X.GetKeyboardMapping({ first_keycode: min, count: max-min }, function(list) {
    console.log(list)
    for (var i=0; i < list.length; ++i)
    {
      var name = kk2Name[i+min] = [];
      var sublist = list[i];
      for (var j =0; j < sublist.length; ++j) name.push(ks2Name[sublist[j]]);
    }

    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;
    X.CreateWindow({ depth: 0, wid: wid, parent: root, x: 10, y: 10, width: 400, height: 300, border_width: 1, _class: 1, visual: 0, 
                   value_mask: { BackPixel: white, EventMask: x11.eventMask.KeyPress } });
    X.MapWindow({ window: wid });

    X.on('event', function(ev) {
        console.log(kk2Name[ev.keycode]);
    });
  });
});
