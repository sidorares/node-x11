# About
 X11 protocol client for node.js
 
 Implements core X11 protocol, as well as Xrender, Damage, Composite, Big-Requests, Dpms, Screensaver, XFixes, Shape, XTest, XC-Misc, GLX and Apple-WM extensions.
# install

`npm install x11`

Windows users:
1) install [XMing](http://www.straightrunning.com/XmingNotes/) or [Cygwin/X](http://x.cygwin.com/)
2) get node-x11 copy (using [git](http://code.google.com/p/msysgit/downloads/list?can=3) or from [Github](https://github.com/sidorares/node-x11/archives/master ))

#CI build status:

[![Build Status](https://secure.travis-ci.org/sidorares/node-x11.png)](http://travis-ci.org/sidorares/node-x11)

# example

Core requests usage:

    var x11 = require('x11');

    var Exposure = x11.eventMask.Exposure;
    var PointerMotion = x11.eventMask.PointerMotion;

    x11.createClient(function(err, display) {
        if (!err) {
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
	    } else {
		    console.log(err);
        }
    });

# Screenshots

  ![tetris game](https://lh6.googleusercontent.com/-RCRY9A7WwnA/Tlww0FHP7NI/AAAAAAAAAwo/nxfSxsw6xow/s400/tetris.png)
  ![XRENDER gradients](https://lh4.googleusercontent.com/-VS0BMYYmq6M/Tlww0Y1ij0I/AAAAAAAAAws/pVWsPZ63Yeo/s400/render-gradients.png)
  ![OpenGL glxgears](http://img-fotki.yandex.ru/get/4123/37511094.30/0_81712_6c2ebb11_L)
  ![OpenGL teapot](http://img-fotki.yandex.ru/get/4132/37511094.30/0_81713_82a5ac48_L)

# Protocol documentation

  - http://www.x.org/releases/X11R7.6/doc/
  - http://www.x.org/releases/X11R7.6/doc/xproto/x11protocol.pdf
  - C Xlib to X11 request mapping table http://tronche.com/gui/x/xlib/appendix/a.html

# Other implementations

  - C: XLib - http://www.sbin.org/doc/Xlib/ http://www.tronche.com/gui/x/xlib/ http://www.x.org/docs/X11/xlib.pdf
  - C: XCB - http://xcb.freedesktop.org/
  - Python:  http://sourceforge.net/projects/python-xlib/ ( github fork: https://github.com/Ademan/python-xlib-branch pypi: http://pypi.python.org/pypi/Python%20Xlib )
  - Python/twisted:  https://launchpad.net/twisted-x11
  - Perl: http://search.cpan.org/~smccam/X11-Protocol-0.56/Protocol.pm
