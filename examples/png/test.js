//var logo = require('./node-png').readPng('./node-logo.png');
var x11 = require('../../lib/x11');

var Exposure = x11.eventMask.Exposure;
var KeyPress = x11.eventMask.KeyPress;
var KeyRelease = x11.eventMask.KeyRelease;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;
var PointerMotion = x11.eventMask.PointerMotion;

var interv = 0;
var total_frames = 0;
var last_frames = 0;

x11.createClient(function(display)
{

    console.log('111111');
    var X = display.client;
    X.require('big-requests', function(BigReq)
    {
         X.require('render', function(Render) {
             X.Render = Render;
             BigReq.Enable(function(err, maxLen)
             {      

      console.log('222222');
 
      var root = display.screen[0].root;
      var white = display.screen[0].white_pixel;
      var black = display.screen[0].black_pixel;
  
      var win, picWin, piclogoi, pic;


      function showpic(path)
      {

      console.log(path);

      pic = require('./node-png').readPng(path);
          /*
          var d = pic.data; var l = pic.data.length;
          for (var p=0; p < l; p+=4)
          {
              b = d[p];
              d[p] = d[p+2];
              d[p+2] = b;
          }
          */

      console.log(pic);
      win = X.AllocID();
      X.CreateWindow(
         win, root,
         0, 0, pic.width, pic.height,
         0, 0, 0, 0,
         {
             backgroundPixel: white, eventMask: Exposure|KeyPress|ButtonPress|PointerMotion
         }
      );
      X.MapWindow(win);

      X.gc = X.AllocID();
      X.CreateGC(X.gc, win);

      //X.PutImage(2, win, X.gc, pic.width, pic.height, 0, 0, 0, 24, pic.data);
      //piclogo = X.AllocID();
      //Render.CreatePicture(piclogo, pixmaplogo, Render.rgb24);
      //picWin = X.AllocID();
      //Render.CreatePicture(picWin, win, Render.rgb24);

      }

      
      showpic(process.argv[2]);


X.on('event', function(ev) {
        if (ev.type == 12) // expose
        {
             X.PutImage(2, win, X.gc, pic.width, pic.height, 0, 0, 0, 24, pic.data);
             //Render.Composite(3, piclogo, 0, picWin, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
        }
});

X.on('error', function(err) {
    console.log(err);
});

             });
         });
    });
});
