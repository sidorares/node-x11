const x11 = require('../../lib');

const Expose = 12;

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('shape', (err, Shape) => {
        const win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, 200, 200);
        X.ChangeWindowAttributes(win, { backgroundPixel: display.screen[0].black_pixel });
        X.MapWindow(win);
        Shape.Rectangles(Shape.Op.Set, Shape.Kind.Bounding, win, 0, 0, [
            [40, 40, 40, 40], [120, 40, 40, 40],
            [0, 120, 20, 20], [180, 120, 20, 20],
            [20, 140, 30, 20], [150, 140, 30, 20],
            [50, 160, 100, 20]
        ]);
    });
    X.on('error', err => { console.log(err); });

});
