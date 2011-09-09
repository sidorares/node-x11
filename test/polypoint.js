var x11 = require('../lib/x11');

var xclient = x11.createClient();
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var pts = [];

xclient.on('connect', function(display) {
    var X = this;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var wid = X.AllocID();
    X.CreateWindow({ depth: 0, wid: wid, parent: root, x: 10, y: 10, width: 400, height: 300, border_width: 1, _class: 1, visual: 0, 
                   value_mask: { BackPixel: white, EventMask: Exposure|PointerMotion   } });
    X.MapWindow({ window: wid });
  
    var gc = X.AllocID();
    X.CreateGC({ cid: gc, drawable: wid, value_mask: { Foreground: black, Background: white } });
    
    X.on('event', function(ev) {
        if (ev.type == 12)
        {
            //X.PolyPoint(0, wid, gc, pts);
        } else if (ev.type == 6) {
          X.PolyPoint({ coordinate_mode: 0, drawable: wid, gc: gc, points: { x: ev.x, y: ev.y} });
        }
    });

    X.on('error', function(e) {
        console.log(e);
    });
});
