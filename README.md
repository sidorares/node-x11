# About
 X11 protocol client for node.js
# install

`npm install x11`

Windows users:
1) install [XMing](http://www.straightrunning.com/XmingNotes/) or [Cygwin/X](http://x.cygwin.com/) 
2) get node-x11 copy (using [git](http://code.google.com/p/msysgit/downloads/list?can=3) or from [Github](https://github.com/sidorares/node-x11/archives/master ))

# example

Core requsests usage:

    var x11 = require('x11');

    var Exposure = x11.eventMask.Exposure;
    var PointerMotion = x11.eventMask.PointerMotion;

    x11.createClient(function(display) {
        var X = display.client;
        var root = display.screen[0].root;
        var wid = X.AllocID();
        X.CreateWindow(
           wid, root,        // new window id, parent
           0, 0, 100, 100,   // x, y, w, h
           0, 0, 0, 0,       // border, depth, class, visual
           { eventMask: Exposure|PointerMotion } // other parameters
        );
        X.MapWindow(wid);      
        var gc = X.AllocID();
        X.CreateGC(gc, wid);
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

# Screenshots

  ![tetris game](https://lh6.googleusercontent.com/-RCRY9A7WwnA/Tlww0FHP7NI/AAAAAAAAAwo/nxfSxsw6xow/s400/tetris.png)
  ![XRENDER gradients](https://lh4.googleusercontent.com/-VS0BMYYmq6M/Tlww0Y1ij0I/AAAAAAAAAws/pVWsPZ63Yeo/s400/render-gradients.png)
  

# Protocol documentation

  - http://www.x.org/releases/X11R7.6/doc/
  - http://www.x.org/releases/X11R7.6/doc/xproto/x11protocol.pdf
  - C Xlib to X11 request mapping table http://tronche.com/gui/x/xlib/appendix/a.html

# Other implementations

  - C: XLib - http://codesearch.google.com/codesearch/p?hl=en#xEHUuo8Crmg/sites/ftp.x.org/pub/X11R7.2/src/update/everything/libX11-X11R7.2-1.1.1.tar.bz2%7CnOqwAyDlYlo/libX11-X11R7.2-1.1.1/src/OpenDis.c&q=XOpenDisplay&d=3
  - C: XCB - http://xcb.freedesktop.org/
  - Python:  http://sourceforge.net/projects/python-xlib/ ( github fork: https://github.com/Ademan/python-xlib-branch pypi: http://pypi.python.org/pypi/Python%20Xlib )
  - Python/twisted:  https://launchpad.net/twisted-x11
  - Perl: http://search.cpan.org/~smccam/X11-Protocol-0.56/Protocol.pm
