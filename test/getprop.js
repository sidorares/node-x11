var x11 = require('../lib/x11');

var xclient = x11.createClient();
var PropertyChange = x11.eventMask.PropertyChange;

xclient.on('connect', function(display) {
    var X = this;
    var root = display.screen[0].root;
    var wid = X.AllocID();
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    X.CreateWindow({ depth: 0, wid: wid, parent: root, x: 10, y: 10, width: 400, height: 300, border_width: 1, _class: 1, visual: 0, 
                   value_mask: { BackPixel: white, EventMask: PropertyChange } });
    X.MapWindow({ window: wid });

    // mode: 0 replace, 1 prepend, 2 append
    // mode, wid, name, type, format, data
    X.ChangeProperty({ mode: 0, window: wid, property: xclient.atoms.WM_NAME, type: xclient.atoms.STRING, format: 8, data: 'Hello, NodeJS' });
    setInterval(function() {
      X.ChangeProperty({ mode: 0, window: wid, property: xclient.atoms.WM_NAME, type: xclient.atoms.STRING, format: 8, data: 'Hello, NodeJS' + new Date() });
    }, 1000);

    xclient.on('event', function(ev) {
        X.GetProperty({ _delete: 0, window: wid, property: xclient.atoms.WM_NAME, type: xclient.atoms.STRING, long_offset: 0, long_length: 10000000 }, function(prop) {
            if (prop.type == xclient.atoms.STRING) prop.data = prop.value.toString();
            console.log(prop.value);
        }); 
    });
});
