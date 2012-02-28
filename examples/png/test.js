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
    var X = display.client;
    X.InternAtom(false, 'test', function() {
    });
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
      //console.log(logo);
          /*
          var d = logo.data; var l = logo.data.length;
          for (var p=0; p < l; p+=4)
          {
              b = d[p];
              d[p] = d[p+2];
              d[p+2] = b;
          }
          */

      win = X.AllocID();
      X.CreateWindow(
         win, root,
         0, 0, logo.width, logo.height,
         1, 0, 1, 0,
         {
             backgroundPixel: white, eventMask: Exposure|KeyPress|ButtonPress|PointerMotion
         }
      );
      X.MapWindow(win);

      var gc = X.AllocID();
      X.CreateGC(gc, win);

      //var pixmaplogo = X.AllocID();
      //X.CreatePixmap(pixmaplogo, win, 32, logo.width, logo.height);
      //X.PolyFillRectangle(pixmaplogo, gc, [0, 0, 1000, 1000]);
      //X.PutImage(2, pixmaplogo, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);
      

      var lastdelta = 0;
      
      if (interv) clearInterval(interv);
      interv = setInterval(function() {
          //console.log('sending!');
          if (lastdelta > 100)
          {
              lastdelta -= 10;
          } else { 
          var n = +new Date();
          console.log(logo.data.length/(logo.width*logo.height));


 
          console.log("here");
          X.PutImage(2, win, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);
          total_frames++;
          X.GetAtomName(1, function(name) {
              lastdelta = +new Date() - n;
              //console.log(lastdelta);
          });
          }
      }, 200);
      //piclogo = X.AllocID();
      //Render.CreatePicture(piclogo, pixmaplogo, Render.rgb24);
      
      //picWin = X.AllocID();
      //Render.CreatePicture(picWin, win, Render.rgb24);

      }

      var idx = 10070;
      showpic('./node-logo.png');
      //showpic('./pnggrad8rgb.png');
      //var files = require('fs').readFileSync('./qqq').toString().split('\n');


X.on('event', function(ev) {
        if (ev.type == 12) // expose
        {
             //X.PutImage(2, win, gc, logo.width, logo.height, 0, 0, 0, 24, logo.data);
             //Render.Composite(3, piclogo, 0, picWin, 0, 0, 0, 0, 0, 0, logo.width, logo.height);
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

//setInterval(function() {
//    console.log(total_frames - last_frames);
//    last_frames = total_frames;
//}, 1000);
