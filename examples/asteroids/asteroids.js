var x11 = require('../../lib/x11');
var watchMobile = require('./staticserver');
var PointerMotion = x11.eventMask.PointerMotion;

var X, Render;
var rocketX = 400;
var rocketY = 300;
var speedX = 0;
var speedY = 0;
var angle = 0;
var acc = 0;


var xclient = x11.createClient(function(display) {
    X = display.client;
    var root = display.screen[0].root;
    X.require('render', function(rendExt) {


        Render = rendExt;
        var wid = X.AllocID();
        
        var white = display.screen[0].white_pixel;
        var black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 900, 600, 1, 1, 0, { backgroundPixel: white, eventMask: PointerMotion });
        X.MapWindow(wid);

        var gc = X.AllocID();
        X.CreateGC(gc, wid, { foreground: white, background: black } );

        var pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgb24);
        var pictGrad = X.AllocID();
        Render.RadialGradient(pictGrad, [50,56], [50,50], 0, 50,
            [
                [0,   [0,0,0xffff,0xffff ] ],
                [0.95,   [0,0,0,0x00ff00 ] ],
                [0.997,   [0xffff, 0xf, 0, 0x1] ],
                [1,   [0xffff, 0xffff, 0, 0x0] ]
            ]);

        var solid = Render.SolidFill
        var dark_grad = X.AllocID();
        Render.LinearGradient(dark_grad, [0,0], [1000,100],
                 [
                   [0,   [0,0,0,0x0 ] ],
                   [0.1, [0xfff, 0, 0xffff, 0] ] ,
                   [0.25, [0xfff, 0, 0xfff, 0] ] ,
                   [0.5, [0xfff, 0, 0xffff, 0] ] ,
                   [1,   [0xfff, 0xffff, 0, 0] ]
                 ]);

        function draw(x, y) {

            X.PolyFillRectangle(wid, gc, [0, 0, 1000, 1000]);
	    Render.Composite(3, pictGrad, 0, pict, 0, 0, 0, 0, rocketX - 50, rocketY - 50, 100, 100);
            // draw directed triangle

            // 
            //
            //
            var pts = [ 
                rocketX + Math.cos(angle)*50, rocketY + Math.sin(angle)*50,
                rocketX + Math.cos(angle + 1)*50, rocketY + Math.sin(angle+1)*50,
                rocketX + Math.cos(angle + 2)*50, rocketY + Math.sin(angle+2)*50,
                
            ];
            //Render.Triangles(3, dark_grad, 0, 0, dark_grad, 0, pts);
            X.PolyLine(0, wid, gc, pts);
        }        
  
        X.on('event', function(ev) {
           //draw(ev.x, ev.y);
        });

        watchMobile(function(x, y, z) {
            //console.log([x, y, z]);
            //console.log(x);
            angle = 2*Math.PI*(y/360); 
            acc = 90 - z;
            draw();
        });

function updateScene()
{
   rocketX += speedX;
   rocketY += speedY;
   speedX += Math.cos(angle + 1)*acc/500;
   speedY += Math.sin(angle + 1)*acc/500;
   console.log(acc);
   if (rocketX+100 > 900)
       speedX = -speedX;
   if (rocketX-100 < 0)
       speedX = -speedX;
   if (rocketY+100 > 600)
       speedY = -speedY;
   if (rocketY-100 < 0)
       speedY = -speedY;
}
    setInterval(updateScene, 50);
    });
});

