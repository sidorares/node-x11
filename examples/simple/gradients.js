// this will be eventually moved to lib/node-x11/extensions

const x11 = require('../../lib');

// adding XRender functions manually from
//     http://cgit.freedesktop.org/xcb/proto/tree/src/render.xml?id=HEAD
// and http://www.x.org/releases/X11R7.6/doc/renderproto/renderproto.txt
// TODO: move to templates
x11.createClient(
    (err, display) => {
        const X = display.client;
            X.require('render', (err, Render) => {

            const root = display.screen[0].root;
            const win = X.AllocID();
            const white = display.screen[0].white_pixel;
            const black = display.screen[0].black_pixel;
            X.CreateWindow(win, root, 0, 0, 500, 500, 0, 0, 0, 0,
            {
                  backgroundPixel: white,
                  eventMask: x11.eventMask.Exposure | x11.eventMask.ButtonPress | x11.eventMask.PointerMotion
            });
            X.MapWindow(win);

            const picture = X.AllocID();
            Render.CreatePicture(picture, win, Render.rgb24, { polyEdge: 1, polyMode: 0 } );
            const pixmap = X.AllocID();
            X.CreatePixmap(pixmap, win, 32, 2500, 2500);
            const pix_pict = X.AllocID();
            Render.CreatePicture(pix_pict, pixmap, Render.rgba32, { polyEdge: 1, polyMode: 0 });

            const pic_grad = X.AllocID();
            Render.LinearGradient(pic_grad, [0,0], [1000,100],
            //RenderRadialGradient(pic_grad, [0,0], [1000,100], 10, 1000,
            //RenderConicalGradient(pic_grad, [250,250], 360,
                [
                  [0,   [0,0,0,0x3000 ] ],
                  [0.1, [0xfff, 0, 0xffff, 0x1000] ] ,
                  [0.25, [0xffff, 0, 0xfff, 0x3000] ] ,
                  [0.5, [0xffff, 0, 0xffff, 0x4000] ] ,
                  [1,   [0xffff, 0xffff, 0, 0x8000] ]
                ]);

            const pic_grad1 = X.AllocID();

            Render.ConicalGradient(pic_grad1, [250,250], 10,
                [
                  [0,   [0,0,0,0x5000 ] ],
                  [0.1, [0xfff, 0, 0xffff, 0x3000] ] ,
                  [0.25, [0xffff, 0, 0xfff, 0x2000] ] ,
                  [0.5, [0xffff, 0, 0xffff, 0x1000] ] ,
                  [1,   [0xffff, 0xffff, 0, 0x8000] ]
                ]);

            const pic_grad2 = X.AllocID();
            Render.RadialGradient(pic_grad2, [250,250], [250,250], 0, 250,
                [
                  [0,   [0,0,0,0x5000 ] ],
                  [0.99,   [0xffff, 0xffff, 0, 0xffff] ],
                  [1,   [0xffff, 0xffff, 0, 0x0] ]
                ]);

            const pixmap1 = X.AllocID();
            X.CreatePixmap(pixmap1, win, 32, 2500, 2500);
            const pix_pict1 = X.AllocID();
            Render.CreatePicture(pix_pict1, pixmap1, Render.rgba32, { polyEdge: 1, polyMode: 0 });
            Render.Composite(3, pic_grad2, 0, pix_pict1, 0, 0, 0, 0, 0, 0, 2500, 2500);

            const pixmap2 = X.AllocID();
            X.CreatePixmap(pixmap2, win, 32, 2500, 2500);
            const pix_pict2 = X.AllocID();
            Render.CreatePicture(pix_pict2, pixmap2, Render.rgba32, { polyEdge: 1, polyMode: 0 });
            for(let i=0; i < 100; ++i)
            {
                const pts  = [];
                for (let coord = 0; coord < 6; coord++)
                    pts.push(Math.random()*500);
                Render.Triangles(3, pic_grad, Math.random()*2500, Math.random()*2500, pix_pict2, 0, pts);
            }

            function update()
            {
                Render.FillRectangles(1, pix_pict, [0xffff, 0xffff, 0xffff, 0xffff], [0, 0, 2500, 2500]);
                Render.Composite(3, pix_pict2, 0, pix_pict, 0, 0, 0, 0, X.x1, X.y1, 2500, 2500);
                //Render.Composite(3, pic_grad, 0, pix_pict, 0, 0, 0, 0, 0, 0, 500, 500);
                Render.Composite(3, pix_pict1, 0, pix_pict, 0, 0, 0, 0, X.x2, X.y2, 2500, 2500);
            }

            function draw()
            {
                Render.Composite(3, pix_pict, 0, picture, 0, 0, 0, 0, 0, 0, 2500, 2500);
            }

            X.x1 = X.y1 = X.x2 = X.y2 = 0;
            update();
            draw();

            X.on('event', ev => {
                if (ev.type == 4)
                {
                   if (ev.keycode == 4)
                     X.x1 += 10;
                   else
                     X.x1 -= 10;
                   update();
                   draw();
                } else if (ev.type == 6) // mouse move
                {
                   X.x2 = ev.x - 250;
                   X.y2 = ev.y - 250;
                   update();
                   draw();
                } else {
                   draw();
                }
            });
        });
     }

).on('error', err => {
    console.log(['error! : ', err]);
});
