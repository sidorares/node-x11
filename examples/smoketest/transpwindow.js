const x11 = require('../../lib');

x11.createClient((err, display) => {
    let visual;
    const rgbaVisuals = Object.keys(display.screen[0].depths[32]);
    for (v in rgbaVisuals)
    {
        const vid = rgbaVisuals[v];
        if (display.screen[0].depths[32][vid].class === 4)
        {
            visual = vid;
            break;
        }
    }
    if (visual === undefined)
    {
        console.log('No RGBA visual found');
        return;
    }
    const X = display.client;
    const root = display.screen[0].root;
    const wid = X.AllocID();
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    const cmid = X.AllocID();
    const depth = 32;
    X.CreateColormap(cmid, root, visual, 0); // 0=AllocNone, 1 AllocAll

    X.CreateWindow(wid, root, 10, 10, 168, 195, 1, depth, 1, visual, { eventMask: x11.eventMask.Exposure, colormap: cmid, backgroundPixel: 0, borderPixel: 0 });
    X.MapWindow(wid);

    const gc = X.AllocID();
    X.require('render', (err, Render) => {

        const pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgba32);
        const gradients = [];

        function randomLinear() {
            const stops = [];
            for (let i=0; i<3; ++i)
                stops.push(Math.random());
            stops.sort();
            // Colours are floats 0..1, premultiplied by alpha. These used to be
            // random 16-bit values, every one of which clamped to 1 — so the
            // "random" gradient was always opaque white.
            const colors = [];
            for (let i=0; i<stops.length; ++i) {
                const a = Math.random();
                colors.push([stops[i], [
                    Math.random()*a,
                    Math.random()*a,
                    Math.random()*a,
                    a]]);
            }

            console.log(colors);

            const gradient = X.AllocID();
            Render.LinearGradient(gradient, [0, 0], [100+parseInt(Math.random()*500), parseInt(100+Math.random()*300)], colors);
            return gradient;
        }

        for (let i=0; i < 50; ++i)
            gradients.push(randomLinear());

        setInterval(() => {
            const gid = parseInt(Math.random()*gradients.length);
            console.log(gradients[gid]);
            Render.Composite(1, gradients[gid], 0, pict, 0, 0, 0, 0, 0, 0, 400, 300);
        }, 2000);
    });
    //X.CreateGC(gc, wid, { foreground: black, background: white } );
    //setInterval(function() {
    //    X.PolyLine(0, wid, gc, [10, 10, 1430, 10, 1430, 868, 10, 868, 10, 10]);
    //}, 10000);
}).on('error', err => {
    console.log(err);
}).on('event', ev => {
    console.log(ev);
});
