var x11 = require('../lib/x11');

x11.createClient(function(display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('shape', function(Shape) {
        var win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, 200, 200);
        var gc = X.AllocID();
        X.CreateGC(gc, win);     
        //X.MapWindow(win);
        Shape.SelectInput(win, 1);
        Shape.InputSelected(win, function(err, isSelected) {
            console.log("IsSelected: " + isSelected);
        });
        //var pid = X.AllocID();
        //X.CreatePixmap(pid, win, 2, 200, 200);
        //X.PolyText8(pid, gc, 0, 0, ['Hello, Node.JS!', ' Hello, world!']);
        //Shape.Mask(Shape.Op.Set, Shape.Kind.Input, win, 0, 0, pid);

        X.on('event', function(ev) {
          console.log(ev);
        });
    });
    X.on('error', function(err) { console.log(err); });
 
});
