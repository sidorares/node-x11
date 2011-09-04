# About
 X11 protocol client for node.js
# install

`npm install x11`

Windows users:
1) install [XMing](http://www.straightrunning.com/XmingNotes/) or [Cygwin/X](http://x.cygwin.com/) 
2) get node-x11 copy (using [git](http://code.google.com/p/msysgit/downloads/list?can=3) or from [Github](https://github.com/sidorares/node-x11/archives/master ))

# status

[implemented requests documentation](https://github.com/sidorares/node-x11/wiki/Core-requests)

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


'click&draw' demo using simple Window wrapper:

    var x11 = require('../lib/x11');
    var Window = require('./wndwrap');

    x11.createClient(function(display) {

        var pts = [];
        new Window(display.client, 0, 0, 700, 500)
            .handle({

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
                    if (ev.keycode == 1) { // left button                    
                        this.pressed = true;
                        pts.push([]);    // start next polyline
    		    }            
                },

                mouseup: function(ev) {
                    if (ev.keycode == 1) // left button
                       this.pressed = false;
                },

                expose: function(ev) {        
                    for (var i=0; i < pts.length ; ++i)
                        this.gc.polyLine(pts[i]);
                }

            })
           .map()
           .title = 'Hello, world!';
    });

# Screenshots

  ![tetris game](https://lh6.googleusercontent.com/-RCRY9A7WwnA/Tlww0FHP7NI/AAAAAAAAAwo/nxfSxsw6xow/s400/tetris.png)
  ![XRENDER gradients](https://lh4.googleusercontent.com/-VS0BMYYmq6M/Tlww0Y1ij0I/AAAAAAAAAws/pVWsPZ63Yeo/s400/render-gradients.png)
  

# Protocol documentation

  - http://www.x.org/releases/X11R7.6/doc/
  - http://www.x.org/releases/X11R7.6/doc/xproto/x11protocol.pdf

# Other implementations

  - C: XLib - http://codesearch.google.com/codesearch/p?hl=en#xEHUuo8Crmg/sites/ftp.x.org/pub/X11R7.2/src/update/everything/libX11-X11R7.2-1.1.1.tar.bz2%7CnOqwAyDlYlo/libX11-X11R7.2-1.1.1/src/OpenDis.c&q=XOpenDisplay&d=3
  - C: XCB - http://xcb.freedesktop.org/
  - Python/twisted:  https://launchpad.net/twisted-x11
  - Perl: http://search.cpan.org/~smccam/X11-Protocol-0.56/Protocol.pm
