//var logo = require('./node-png').readPng('./node-logo.png');
var x11 = require('../../lib/x11');

var Exposure = x11.eventMask.Exposure;
var KeyPress = x11.eventMask.KeyPress;
var KeyRelease = x11.eventMask.KeyRelease;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;
var PointerMotion = x11.eventMask.PointerMotion;

x11.createClient(function(display)
{
    var X = display.client;
    X.require('big-requests', function(BigReq)
    {
         X.require('render', function(Render) {
             X.Render = Render;
             BigReq.Enable(function(maxLen)
             {
       
      var root = display.screen[0].root;
      var white = display.screen[0].white_pixel;
      var black = display.screen[0].black_pixel;
  
      var win, picWin, piclogoi, logo;

      function showpic(path)
      {

      console.log(path);

      logo = require('./node-png').readPng(path);
      win = X.AllocID();
      X.CreateWindow(
         win, root,
         0, 0, logo.width, logo.height,
         1, 1, 0,
         {
             backgroundPixel: white, eventMask: Exposure|KeyPress|ButtonPress|PointerMotion
         }
      );
      X.MapWindow(win);

      var gc = X.AllocID();
      X.CreateGC(gc, win);

      var pixmaplogo = X.AllocID();
      X.CreatePixmap(pixmaplogo, win, 24, logo.width, logo.height);
      X.PolyFillRectangle(pixmaplogo, gc, [0, 0, 1000, 1000]);
      X.PutImage(2, pixmaplogo, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);
      
      piclogo = X.AllocID();
      Render.CreatePicture(piclogo, pixmaplogo, Render.rgb24);
      
      picWin = X.AllocID();
      Render.CreatePicture(picWin, win, Render.rgb24);

      }

      var idx = 10000;
      //showpic('/Applications/iTunes.app/Contents/Resources/FolderAnimationLinenIPadLandscape.png');
      //showpic('./node-logo.png');
      showpic('/Applications/iPhoto.app/Contents/Resources/Themes/Assets/Mistletoe/Mistletoe-Outside-200dpi.png');
      var files = require('fs').readFileSync('./qqq').toString().split('\n');


X.on('event', function(ev) {
        if (ev.type == 12) // expose
        {
             Render.Composite(3, piclogo, 0, picWin, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
        }
        if (ev.type == 2)
        {
            switch(ev.keycode)
            {
                 case 131: 
                     idx -= 10; break;
                 case 132: 
                     idx += 10; break;
                 case 133: 
                     idx -= 1; break;
                 case 134: 
                     idx += 1; break;
            }
            console.log(idx);
            if (idx < 0) idx = 0;
            X.DestroyWindow(win);
            showpic(files[idx]);
        }
});
X.on('error', function(err) {
    console.log(err);
});

             });
         });
    });
});
