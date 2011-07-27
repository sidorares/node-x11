var x11 = require('../lib/x11');
var Window = require('./wndwrap');

x11.createClient(function(display) {

    var pts = [];
    new Window(display.client, 0, 0, 600, 400, display.screen[0].white_pixel)
        .handle({

            create: function(ev) {
                console.log(eve);
            },

            map: function(ev) {
                console.log(ev);

                for (var i=0; i < 29; ++i)
                    for (var j=0; j < 19; ++j)
                    {
                        new Window( this, 10+i*20, 10+j*20, 17, 17, display.screen[0].black_pixel)
                           .handle({
                               mousemove: function() {
                                   var self = this;
                                   self.unmap();
                                   setTimeout(function() {
                                       self.map();
                                   }, 500);
                               }
                            
                           })
                           .map();
                    }
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
                //for (var i=0; i < pts.length ; ++i) {
                //    this.gc.polyLine(pts[i]);
                //}
            }

        })
       .map()
       .title = 'Hello, world!';
});
