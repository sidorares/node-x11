var x11 = require('../lib/x11');
var Window = require('./wndwrap');

var width = 700;
var height = 500;

var xclient = x11.createClient();
var pts = [];

xclient.on('connect', function(display) {

    var mainwnd = new Window(xclient, 0, 0, width, height);
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
