const x11 = require('../lib');
const PointerMotion = x11.eventMask.PointerMotion;
const ButtonPress = x11.eventMask.ButtonPress;
const ButtonRelease = x11.eventMask.ButtonRelease;

let X, Render;
let pressed = false;
let gradNo = 0;

const xclient = x11.createClient((err, display) => {
    X = display.client;
    const root = display.screen[0].root;
    X.require('render', (err, rendExt) => {
        Render = rendExt;
        const wid = X.AllocID();

        const white = display.screen[0].white_pixel;
        const black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: PointerMotion|ButtonPress|ButtonRelease });
        X.MapWindow(wid);

        const pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgb24);
        // RENDER colours are floats 0..1, premultiplied by alpha (each of
        // r,g,b must end up <= a). Multiplying here keeps the stops readable.
        const rgba = (r, g, b, a) => [r * a, g * a, b * a, a];

        // ten brushes, softest to hardest: flat 6% alpha out to a widening
        // radius, then fading to nothing at the edge
        const pictGrad = [];
        for (let i=0; i < 10; ++i)
        {
            pictGrad[i] = X.AllocID();
            Render.RadialGradient(pictGrad[i], [50,56], [50,50], 0, 50,
            [
                [0,   rgba(0, 0, 0, 0.0625) ],
                [0.1 + 0.8*i/10,   rgba(0, 0, 0, 0.0625) ],
                [0.997,   rgba(1, 0, 0, 0) ],
                [1,   rgba(1, 1, 0, 0) ]
            ]);
        }

        function draw(x, y) {
            Render.Composite(3, pictGrad[gradNo], 0, pict, 0, 0, 0, 0, x-50, y-50, 100, 100);
        }

        X.on('event', ev => {
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
