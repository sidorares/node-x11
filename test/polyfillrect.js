var x11 = require('../lib/x11');

var xclient = x11.createClient();
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;

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

    var gc2
    X.AllocColor({ cmap: display.screen[0].default_colormap, red: 0xffff, blue: 0, green: 0 }, function(redcolor) {
      gc2 = X.AllocID();
      X.CreateGC({ cid: gc2, drawable: wid, value_mask: { Foreground: redcolor.pixel, Background: white } });
    })

    X.on('event', function(ev) {
        if (ev.type == 12)
        {
            X.PolyFillRectangle({ drawable: wid, gc: gc, rectangles: 
                                  [ { x: 20, y: 30, width: 50, height: 90}
                                  , { x: 40, y: 50, width: 90, height: 10}
            ]})
            X.PolyFillRectangle({ drawable: wid, gc: gc2 || gc, rectangles: { x: 20, y: 80, width: 50, height: 30} })

         } else if (ev.type == 6) {
            //console.log(ev.x, ev.y);
            //console.log(X.replies);
        }
    });

    X.on('error', function(e) {
        console.log(e);
    });
});
