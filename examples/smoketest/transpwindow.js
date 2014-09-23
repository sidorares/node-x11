var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var visual;
    var rgbaVisuals = Object.keys(display.screen[0].depths[32]);
    for (v in rgbaVisuals)
    {
        var vid = rgbaVisuals[v];
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
    var X = display.client;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var cmid = X.AllocID();
    var depth = 32;
    X.CreateColormap(cmid, root, visual, 0); // 0=AllocNone, 1 AllocAll

    X.CreateWindow(wid, root, 10, 10, 168, 195, 1, depth, 1, visual, { eventMask: x11.eventMask.Exposure, colormap: cmid, backgroundPixel: 0, borderPixel: 0 });
    X.MapWindow(wid);

    var gc = X.AllocID();
    X.require('render', function(err, Render) {

        var pict = X.AllocID();
        Render.CreatePicture(pict, wid, Render.rgba32);
        var gradients = [];

        function randomLinear() {
            var stops = [];
            for (var i=0; i<3; ++i)
                stops.push(Math.random());
            stops.sort();
            var colors = [];
            for (var i=0; i<stops.length; ++i)
                colors.push([stops[i], [
                    parseInt(Math.random()*65535),
                    parseInt(Math.random()*65535),
                    parseInt(Math.random()*65535),
                    parseInt(Math.random()*65535)]]);

            console.log(colors);

            var gradient = X.AllocID();
            Render.LinearGradient(gradient, [0, 0], [100+parseInt(Math.random()*500), parseInt(100+Math.random()*300)], colors);
            return gradient;
        }

        for (var i=0; i < 50; ++i)
            gradients.push(randomLinear());

        setInterval(function() {
            var gid = parseInt(Math.random()*gradients.length);
            console.log(gradients[gid]);
            Render.Composite(1, gradients[gid], 0, pict, 0, 0, 0, 0, 0, 0, 400, 300);
        }, 2000);
    });
    //X.CreateGC(gc, wid, { foreground: black, background: white } );
    //setInterval(function() {
    //    X.PolyLine(0, wid, gc, [10, 10, 1430, 10, 1430, 868, 10, 868, 10, 10]);
    //}, 10000);
}).on('error', function(err) {
    console.log(err);
}).on('event', function(ev) {
    console.log(ev);
});
