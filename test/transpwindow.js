var x11 = require('../lib/x11');

var xclient = x11.createClient();
var PointerMotion = x11.eventMask.PointerMotion;
var Button1Motion = x11.eventMask.Button1Motion;
var Button2Motion = x11.eventMask.Button2Motion;
var Button3Motion = x11.eventMask.Button3Motion;
var Button4Motion = x11.eventMask.Button4Motion;
var Button5Motion = x11.eventMask.Button5Motion;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;
var EnterWindow = x11.eventMask.EnterWindow;
var LeaveWindow = x11.eventMask.LeaveWindow;

//var mask = PointerMotion|Button1Motion|Button2Motion|Button3Motion|Button4Motion|Button5Motion|ButtonPress|ButtonRelease;
//var mask = Button1Motion|Button2Motion|Button3Motion|Button4Motion|Button5Motion|ButtonPress|ButtonRelease;
var mask = Button1Motion|ButtonPress|EnterWindow|LeaveWindow;

xclient.on('connect', function(display) {
    //console.log(display.depths);
    console.log(display.screen[0].depths);
    var X = this;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    //X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: white, eventMask: mask, overrideRedirect: 1 });
    var cmid = X.AllocID();
    var visual = 261;//71;
    var depth = 24;//32; 
    X.CreateColormap(cmid, root, visual, 0); // 0=AllocNone, 1 AllocAll 


    //X.CreateWindow(wid, root, 10, 10, 168, 195, 1, depth, 1, visual, { colormap: cmid, backgroundPixel: 0, borderPixel: 0 });
    //X.CreateWindow(wid, root, 10, 10, 168, 195, 1, 0, 1, 0, { backgroundPixel: 0, borderPixel: 0 });
    //X.MapWindow(wid);

    //var gc = X.AllocID();
    //X.CreateGC(gc, wid, { foreground: black, background: white } );
    //setInterval(function() {
    //    X.PolyLine(0, wid, gc, [10, 10, 1430, 10, 1430, 868, 10, 868, 10, 10]);
    //}, 10000);
});

xclient.on('error', function(err) {
    console.log(err);
});

xclient.on('event', function(ev) {
    console.log(ev);
});
