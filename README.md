# About
 X11 protocol client for node.js

# status

stage 2) ( see [roadmap.txt](node-x11/blob/master/roadmap.txt) )
next todo: dispatch replies and errors, decode all evnt types

# example

    var X = require('x11').createClient();
    X.on('connect', function(display) {
        var root = display.screen[0].root;
        var wid = X.AllocID();
        X.CreateWindow(wid, root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: 0, eventMask: 0x00000040 });
        X.MapWindow(wid);
    });


# Protocol documentation

  - http://www.x.org/releases/X11R7.6/doc/
  - http://www.x.org/releases/X11R7.6/doc/xproto/x11protocol.pdf

# Other implementations

  - C: XLib - http://codesearch.google.com/codesearch/p?hl=en#xEHUuo8Crmg/sites/ftp.x.org/pub/X11R7.2/src/update/everything/libX11-X11R7.2-1.1.1.tar.bz2%7CnOqwAyDlYlo/libX11-X11R7.2-1.1.1/src/OpenDis.c&q=XOpenDisplay&d=3
  - C: XCB - http://xcb.freedesktop.org/
  - Python/twisted:  https://launchpad.net/twisted-x11
  - Perl: http://search.cpan.org/~smccam/X11-Protocol-0.56/Protocol.pm
