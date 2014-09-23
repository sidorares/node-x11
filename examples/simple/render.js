var x11 = require('../../lib');
var PointerMotion = x11.eventMask.PointerMotion;

var xclient = x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    display.client.require('render', function(err, Render) {
        var wid = X.AllocID();
        var white = display.screen[0].white_pixel;
        varblack = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion });
        X.MapWindow(wid);

        var pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgb24);
        var pictGrad = X.AllocID();
        Render.RadialGradient(pictGrad, [26,26], [26,26], 0, 26,
            [
                [0,   [0,0,0,0x0fff ] ],
                [0.3,   [0,0,0,0x0fff ] ],
                [0.997,   [0xffff, 0xf, 0, 0x1] ],
                [1,   [0xffff, 0xffff, 0, 0x0] ]
            ]);

        function draw(x, y) {
            Render.Composite(3, pictGrad, 0, pict, 0, 0, 0, 0, x-26, y-26, 52, 52);
        }

        X.on('event', function(ev) {
           draw(ev.x, ev.y);
        });
    });
});
