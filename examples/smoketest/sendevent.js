var x11 = require('../../lib');

var xclient = x11.createClient({debug: true});
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var pts = [];

xclient.on('connect', function(display) {
    var X = this;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    function createWindow()
    {
      var wid = X.AllocID();
      // id, parentId, x, y, width, height, borderWidth, depth, _class, visual, values
      X.CreateWindow(
        wid, root, 
        10, 10, 400, 300, 
        0, 0, 0, 0, { 
          backgroundPixel: white, eventMask: Exposure|PointerMotion  
      });
      X.MapWindow(wid);
      return wid;
    }

    var wid = createWindow();
    var wid1 = createWindow();
  
    var gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );
    
    X.on('event', function(ev) {
        //console.log(ev);
        if (ev.type == 12)
        {
            // expose
        } else if (ev.type == 6) {
            X.PolyPoint(0, ev.wid, gc, [ev.x, ev.y]);
            // send copy of event to the second window
            if (ev.wid == wid) // don't send it from second window
            {
                // set window in the event we are sending
                var n = wid1;
                var offset = 12;
                var buf = ev.rawData;
                buf[offset++] = n & 0xff;
                buf[offset++] = (n >> 8) & 0xff;
                buf[offset++] = (n >> 16) & 0xff;
                buf[offset++] = (n >> 24) & 0xff;

                X.SendEvent(wid1, 1, PointerMotion, ev.rawData);
            } else {
                console.log('GotData!');
            }
        }
    });

    //X.on('error', function(e) {
    //    console.log(e);
    //});
});
