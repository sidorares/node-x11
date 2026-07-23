const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('shape', (err, Shape) => {
        const win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, 200, 200);
        X.ChangeWindowAttributes(win, { backgroundPixel: display.screen[0].white_pixel });
        X.MapWindow(win);
        X.ClearArea(win, 0, 0, 200, 200, false);

        Shape.SelectInput(win, true);
        Shape.InputSelected(win, (err, isSelected) => {
            console.log(`IsSelected: ${isSelected}`);
        });

        const bitmap = X.AllocID();
        X.CreatePixmap(bitmap, win, 1, 200, 200);
        const gc = X.AllocID();
        X.CreateGC(gc, bitmap, { foreground: 1 });
//        X.PolyText8(bitmap, gc, 0, 0, ['Hello, Node.JS!', ' Hello, world!']);
        X.PolyFillArc(bitmap, gc, [0, 0, 200, 200, 0, 360 * 64]);
        Shape.Mask(Shape.Op.Set, Shape.Kind.Bounding, win, 0, 0, bitmap);

        X.on('event', ev => {
          console.log(ev);
        });
    });
    X.on('error', err => { console.log(err); });

});
