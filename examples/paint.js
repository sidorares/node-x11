var x11 = require('../lib');
var PointerMotion = x11.eventMask.PointerMotion;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;

var X, Render;
var pressed = false;
var gradNo = 0;

var xclient = x11.createClient(function(err, display) {
    X = display.client;
    var root = display.screen[0].root;
    X.require('render', function(err, rendExt) {
        Render = rendExt;
        var wid = X.AllocID();

        var white = display.screen[0].white_pixel;
        var black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion|ButtonPress|ButtonRelease });
        X.MapWindow(wid);

        var pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgb24);
        var pictGrad = [];
        for (var i=0; i < 10; ++i)
        {
            pictGrad[i] = X.AllocID();
            Render.RadialGradient(pictGrad[i], [50,56], [50,50], 0, 50,
            [
                [0,   [0,0,0,0x0fff ] ],
                [0.1 + 0.8*i/10,   [0,0,0,0x0fff ] ],
                [0.997,   [0xffff, 0xf, 0, 0x1] ],
                [1,   [0xffff, 0xffff, 0, 0x0] ]
            ]);
        }

        function draw(x, y) {
            Render.Composite(3, pictGrad[gradNo], 0, pict, 0, 0, 0, 0, x-50, y-50, 100, 100);
        }

        X.on('event', function(ev) {
            if (ev.type == 4 && ev.keycode == 1)
                pressed = true;
            else if (ev.type == 5 && ev.keycode == 1)
                pressed = false;
            else if (ev.type == 5 && ev.keycode == 4)
            {
                gradNo--;
                if (gradNo < 0)
                    gradNo = 0;
                console.log(gradNo);
            }
            else if (ev.type == 5 && ev.keycode == 5)
            {
                gradNo++;
                if (gradNo > 9)
                    gradNo = 9;
                console.log(gradNo);
            }
            else if (pressed)
                draw(ev.x, ev.y);
            //console.log(ev.type, ev.keycode);
        });
    });
});
