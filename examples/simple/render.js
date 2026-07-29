const x11 = require('../../lib');
const PointerMotion = x11.eventMask.PointerMotion;

const xclient = x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    display.client.require('render', (err, Render) => {
        const wid = X.AllocID();
        const white = display.screen[0].white_pixel;
        const black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion });
        X.MapWindow(wid);

        const pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgb24);
        // RENDER colours are floats 0..1, premultiplied by alpha (each of
        // r,g,b must end up <= a). Multiplying here keeps the stops readable.
        const rgba = (r, g, b, a) => [r * a, g * a, b * a, a];

        // a soft dark disc: flat 6% alpha out to 0.3, then fading to nothing
        const pictGrad = X.AllocID();
        Render.RadialGradient(pictGrad, [26,26], [26,26], 0, 26,
            [
                [0,   rgba(0, 0, 0, 0.0625) ],
                [0.3,   rgba(0, 0, 0, 0.0625) ],
                [0.997,   rgba(1, 0, 0, 0) ],
                [1,   rgba(1, 1, 0, 0) ]
            ]);

        function draw(x, y) {
            Render.Composite(3, pictGrad, 0, pict, 0, 0, 0, 0, x-26, y-26, 52, 52);
        }

        X.on('event', ev => {
           draw(ev.x, ev.y);
        });
    });
});
