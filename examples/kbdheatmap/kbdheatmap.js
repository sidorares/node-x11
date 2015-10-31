#!/home/laplace/node/node

var Buffer = require('buffer').Buffer;
var x11 = require('../../lib');

var Exposure = x11.eventMask.Exposure;
var KeyPress = x11.eventMask.KeyPress;
var KeyRelease = x11.eventMask.KeyRelease;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;

// image and coords file from http://www.patrick-wied.at/projects/heatmap-keyboard/
// TODO: add simple tool to use&tag coords in own keyboard photo
// jpeg decoder is slightly modified version of https://github.com/notmasteryet/jpgjs
var kbdImg = require('./node-jpg').readJpeg(__dirname+'/keyboard.jpg');
var keycoords = require('./coordinates');

// from https://github.com/substack/node-keysym
var keysyms = require('./keysyms').records;
var ks2name = {};
for (var k in keysyms)
    ks2name[keysyms[k].keysym] = keysyms[k].names;
var kk2name = {};


x11.createClient(function(err, display)
{
    var X = display.client;
    X.require('big-requests', function(err, BigReq)
    {
        X.require('render', function(err, Render) {
            X.Render = Render;
            BigReq.Enable(function(err, maxLen)
            {
                var min = display.min_keycode;
                var max = display.max_keycode;
		X.GetKeyboardMapping(min, max-min, function(err, list)
                {
	            // map keycode to key name
		    for (var i=0; i < list.length; ++i)
		    {
		        var name = kk2name[i+min] = [];
		        var sublist = list[i];
		        for (var j =0; j < sublist.length; ++j)
		            name.push(ks2name[sublist[j]]);

		    }
                    main(X);
                 });
            });
        });
    });
});

function main(X)
{
    var display = X.display;
    var Render = X.Render;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var win = X.AllocID();
    X.CreateWindow(
       win, root,
       0, 0, kbdImg.width, kbdImg.height,
       0, 0, 0, 0,
       {
           backgroundPixel: white, eventMask: Exposure|KeyPress|ButtonPress
       }
    );
    X.MapWindow(win);

    var win1 = X.AllocID();
    X.CreateWindow(
       win1, root,
       0, 0, kbdImg.width, kbdImg.height,
       0, 0, 0, 0,
       {
           backgroundPixel: white, eventMask: Exposure|KeyPress|ButtonPress
       }
    );
    X.MapWindow(win1);

    var gc = X.AllocID();
    X.CreateGC(gc, win);

            var picGrad = X.AllocID();
            Render.RadialGradient(picGrad, [150/2,150/2], [150/2,150/2], 0, 150/2,
                [
                  [0,   [0,0,0,0x15000 ] ],
                  [1,   [0, 0, 0, 0x0] ]
                ]);
            var pixmapHeatPush = X.AllocID();
            X.CreatePixmap(pixmapHeatPush, win, 32, 150, 150);
            var picHeatPush = X.AllocID();
            Render.CreatePicture(picHeatPush, pixmapHeatPush, Render.rgba32);
            Render.FillRectangles(1, picHeatPush, [0, 0, 0, 0], [0, 0, 150, 150]);
            Render.Composite(3, picGrad, 0, picHeatPush, 0, 0, 0, 0, 0, 0, 150, 150);

            var pixmapKbd = X.AllocID();
            X.CreatePixmap(pixmapKbd, win, 24, kbdImg.width, kbdImg.height);
            var picKbd = X.AllocID();
            X.PutImage(2, pixmapKbd, gc, kbdImg.width, kbdImg.height, 0, 0, 0, 24, kbdImg.data);
            Render.CreatePicture(picKbd, pixmapKbd, Render.rgb24);

            var pixmapHeat = X.AllocID();
            X.CreatePixmap(pixmapHeat, win, 32, kbdImg.width, kbdImg.height);
            var picHeat = X.AllocID();
            Render.CreatePicture(picHeat, pixmapHeat, Render.rgba32);

            var picWin = X.AllocID();
            Render.CreatePicture(picWin, win, Render.rgb24);

            var picWin1 = X.AllocID();
            Render.CreatePicture(picWin1, win1, Render.rgb24);

    X.on('event', function(ev) {
        if (ev.type == 12) // expose
        {
            Render.Composite(3, picKbd, 0, picWin, 0, 0, 0, 0, 0, 0, kbdImg.width, kbdImg.height);
        } if (ev.type == 4) {
            var x = ev.x;
            var y = ev.y;
            var mindist = 1e10;
            var minkey = '';
            for (var k in keycoords)
            {
                var xdist = keycoords[k][0] - x;
                var ydist = keycoords[k][1] - y;
                var dist = xdist*xdist + ydist+ydist;
                if (dist < mindist)
                {
                    minkey = k;
                    mindist = dist;
                }
            }

            Render.Composite(3, picKbd, 0, picWin, 0, 0, 0, 0, 0, 0, kbdImg.width, kbdImg.height);
            Render.Composite(3, picHeatPush, 0, picWin, 0, 0, 0, 0, x -150/2, y-150/2, 150, 150);

        } if (ev.type == 2) {

            var name = kk2name[ev.keycode];
            for (var n in name)
            {
                var pt = keycoords[name[n]];
                if (pt)
                {
                    Render.Composite(3, picHeatPush, 0, picWin, 0, 0, 0, 0, pt[0] -150/2, pt[1]-150/2, 150, 150);

                    Render.Composite(3, picHeatPush, 0, picHeat, 0, 0, 0, 0, pt[0] -150/2, pt[1]-150/2, 150, 150);
                    Render.Composite(3, picHeatPush, 0, picWin1, 0, 0, 0, 0, pt[0] -150/2, pt[1]-150/2, 150, 150);


                    break;
                } else {
                    //console.log(name);
                }
            }
        } else {
            //console.log(ev);
        }
    })
    X.on('error', function(e) {
        console.error(e.message, ' error in request ',  e.stack);
        process.exit(1);
    });
}
