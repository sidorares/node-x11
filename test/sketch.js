var x11 = require('../lib/x11');
var Window = require('./wndwrap');

var width = 700;
var height = 500;

var xclient = x11.createClient(function(display) {

    new Window(xclient, 0, 0, width, height)
        .handle({
            mousemove: function(ev) {
                pts.push(ev.x); 
                pts.push(ev.y);
            },

            expose: function(ev) {        
                for (var i=0; i < pts.length/2 ; ++i)
                   ev.gc.drawText(pts[i], pts[i+1], 'Hello, NodeJS!');
            }
        })
       .map()
       .title = 'Hello, world!';
});
