const x11 = require('../../lib');

const Exposure = x11.eventMask.Exposure;

x11.createClient((err, display) => {
    let repaint;
    const X = display.client;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    const wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       10, 10, 400, 300 
    );
    X.MapWindow(wid);
  
    // parameters: colormap, red, green, blue
    X.AllocColor(display.screen[0].default_colormap, 0xffff, 0xffff, 0, (err, color) => {
        const gc = X.AllocID();
        X.CreateGC(gc, wid, { foreground: color.pixel, background: black } );
        repaint = setInterval(() => {
            X.PolyFillRectangle(wid, gc, [100, 100, 200, 100]);
        }, 1000);
    });
    X.on('error', e => {
        console.log(e);
    });
    X.on('end', () => {
        console.log('client destroyed');
        clearInterval(repaint);
    });
});
