var x11 = require('../lib/x11');
var Window = require('./wndwrap');

x11.createClient(function(display) {

    var pts = [];
    new Window(display.client, 0, 0, 700, 500)
        .handle({

            map: function(ev) {
                this.pixmap = this.createPixmap(700, 500);
            },

            mousemove: function(ev) {
                if (this.pressed)
                {
                    var lastpoly = pts[pts.length - 1];
                    lastpoly.push(ev.x); 
                    lastpoly.push(ev.y);
                    if (lastpoly.length > 3)
                        this.gc.polyLine(lastpoly.slice(-4));
                }
            },

            mousedown: function(ev) {
                if (ev.keycode == 1) // left button
                {
                    this.pressed = true;
                    pts.push([]);
		}            
            },

            mouseup: function(ev) {
                if (ev.keycode == 1) // left button
                   this.pressed = false;
            },

            expose: function(ev) {
                for (var i=0; i < pts.length ; ++i) {
                    this.pixmap.gc.polyLine(pts[i]);
                }
                // todo: resize
                this.gc.copy(this.pixmap, 0, 0, 0, 0, 700, 500);
            }

        })
       .map()
       .title = 'Hello, world!';
}).on('error', function(err) {
    console.error(err);
});
