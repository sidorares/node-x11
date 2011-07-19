# About
 X11 protocol client for node.js

# status

( see [List of implemented requests](https://github.com/sidorares/node-x11/wiki/CoreRequests) )

# example

Core requsests usage:

    var x11 = require('../lib/x11');

    var xclient = x11.createClient();
    var Exposure = x11.eventMask.Exposure;
    var PointerMotion = x11.eventMask.PointerMotion;

    xclient.on('connect', function(display) {
        var X = this;
        var root = display.screen[0].root;
        var white = display.screen[0].white_pixel;
        var black = display.screen[0].black_pixel;

        var wid = X.AllocID();
        X.CreateWindow(
           wid, root, 
           0, 0, 100, 100, 
           1, 1, 0,
           { 
               backgroundPixel: white, eventMask: Exposure|PointerMotion  
           }
        );
        X.MapWindow(wid);
      
        var gc = X.AllocID();
        X.CreateGC(gc, wid, { foreground: black, background: white } );

        X.on('event', function(ev) {
            if (ev.type == 12)
            {
                X.PolyText8(wid, gc, 50, 50, ['Hello, Node.JS!']); 
            } 
        });
        X.on('error', function(e) {
            console.log(e);
        });
    });


Simple core requests Window wrapper:

    var x11 = require('x11');
    var Window = require('./wndwrap');
    var xclient = x11.createClient();
    xclient.on('connect', function(display) {
        var mainwnd = new Window(xclient, 0, 0, 100, 100);
        mainwnd.on('expose', function(ev) {        
            ev.gc.drawText(50, 50, 'Hello, NodeJS!');
        });
        mainwnd.map();
    });


# Protocol documentation

  - http://www.x.org/releases/X11R7.6/doc/
  - http://www.x.org/releases/X11R7.6/doc/xproto/x11protocol.pdf

# Other implementations

  - C: XLib - http://codesearch.google.com/codesearch/p?hl=en#xEHUuo8Crmg/sites/ftp.x.org/pub/X11R7.2/src/update/everything/libX11-X11R7.2-1.1.1.tar.bz2%7CnOqwAyDlYlo/libX11-X11R7.2-1.1.1/src/OpenDis.c&q=XOpenDisplay&d=3
  - C: XCB - http://xcb.freedesktop.org/
  - Python/twisted:  https://launchpad.net/twisted-x11
  - Perl: http://search.cpan.org/~smccam/X11-Protocol-0.56/Protocol.pm
