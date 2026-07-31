const x11 = require('../../lib');

const xclient = x11.createClient({debug: true});
const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;
const pts = [];

xclient.on('connect', function(display) {
    const X = this;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    function createWindow()
    {
      const wid = X.AllocID();
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

    const wid = createWindow();
    const wid1 = createWindow();
  
    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );
    
    X.on('event', ev => {
        //console.log(ev);
        if (ev.type == 12)
        {
            // expose
        } else if (ev.type == 6) {
            X.PolyPoint(0, ev.wid, gc, [ev.x, ev.y]);
            // send copy of event to the second window
            if (ev.wid == wid) // don't send it from second window
            {
                // same event, re-addressed to the second window
                X.SendEvent(wid1, 1, PointerMotion, Object.assign({}, ev, { wid: wid1 }));
            } else {
                console.log('GotData!');
            }
        }
    });

    //X.on('error', function(e) {
    //    console.log(e);
    //});
});
