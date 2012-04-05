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
    var X = this;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    X.CreateWindow({ depth: 0, wid: wid, parent: root, x: 10, y: 10, width: 400, height: 300, border_width: 1, _class: 1, visual: 0, 
                   value_mask: { BackPixel: white, EventMask: mask } });
    X.MapWindow({ window: wid });
});

xclient.on('event', function(ev) {
    console.log(ev);
});
