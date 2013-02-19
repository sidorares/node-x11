var x11 = require('../../lib');
x11.createClient(function(err, display) {
    var X = display.client;
    var wid = X.AllocID();
    X.CreateWindow(wid, display.screen[0].root, 100, 100, 400, 300, 0, 0, 0, 0, {eventMask: x11.eventMask.PointerMotion});
    X.MapWindow(wid);
    var wid1 = X.AllocID();
    X.CreateWindow(wid1, wid, 10, 10, 380, 280, 0, 0, 0, 0, {eventMask: x11.eventMask.PointerMotion, backgroundPixel: display.screen[0].black_pixel});
    X.MapWindow(wid1);
    X.on('error', function(err) { console.log(err) });
    //X.on('event', console.log);

    var xterm = require('child_process').spawn('xterm', ['-into', wid1]);
    xterm.stderr.pipe(process.stderr);
    xterm.stdout.pipe(process.stdout);
});
