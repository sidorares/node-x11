var x11 = require('../../lib');
var Window = require('./wndwrap');

var width = 700;
var height = 500;

var pts = [];
x11.createClient(function(err, display) {

    var mainwnd = new Window(display.client, 0, 0, width, height);
    mainwnd.on('mousemove', function(ev) 
    {
        pts.push(ev.x); 
        pts.push(ev.y);
        this.gc.text(ev.x, ev.y, 'Hello, NodeJS!');
        mainwnd.title = ev.x + ' ' + ev.y;    
    });
    mainwnd.on('expose', function(ev) {        
        for (var i=0; i < pts.length/2 ; ++i)
            ev.gc.drawText(pts[i], pts[i+1], 'Hello, NodeJS!');
    });
    mainwnd.map();
});
