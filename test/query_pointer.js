var x11 = require('../lib/x11');
var X = x11.createClient();

X.on('connect', function(display) {

    var screen = display.screen[0];
    var wid = X.AllocID();
    X.CreateWindow({ depth: 0, wid: wid, parent: screen.root, x: 10, y: 10, width: 400, height: 300, border_width: 1, _class: 1, visual: 0, 
                   value_mask: { BackPixel: screen.white_pixel } });
    X.MapWindow({ window: wid });
    setInterval( function() {
        X.QueryPointer({ window: wid }, function(res) {
            console.log(res);
        });
    }, 1000);

});

X.on('error', function(err) {
    console.log(err);
});
