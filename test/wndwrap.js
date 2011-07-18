var EventEmitter = require('events').EventEmitter;
var util = require('util'); // util.inherits

function Window(parent, x, y, w, h, bg)
{
    if (parent.constructor && parent.constructor.name == 'XClient')
    {
        this.xclient = parent;
        if (!this.xclient.rootWindow)
        {
            // quick hack
            var rootWnd = { 
                id: this.xclient.display.screen[0].root,
                xclient: this.xclient
            };
            rootWnd.parent = null;
            this.parent = this.xclient.rootWnd;
            this.xclient.rootWindow = rootWnd;
        }
        this.parent = this.xclient.rootWindow;
    } else {
        this.parent = parent;
        this.xclient = parent.xclient;
    }

    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.bg = bg;
    this.id = this.xclient.AllocID();

    var borderWidth = 1;
    var _class = 1; // InputOutput
    var visual = 0; // CopyFromParent
    this.xclient.CreateWindow(
        this.id, this.parent.id, this.x, this.y, this.w, this.h, 
        borderWidth, _class, visual, 
        { 
          backgroundPixel: this.bg, 
          eventMask: 0x00000040 
        }
    );
    //this.map();

    var wnd = this;
    eventType2eventName = {
        6: 'mousemove'
    };

    var ee = new EventEmitter();
    this.xclient.event_consumers[wnd.id] = ee;
    // TODO: do we need to have wnd as EventEmitter AND EventEmitter stored in event_consumers ?
    ee.on('event', function( ev )
    {   
        wnd.emit(eventType2eventName[ev.type], ev); // convert to mousemove? (ev is already event-spacific)               
    });    
    // TODO: track delete events and remove wmd from consumers list
}
util.inherits(Window, EventEmitter);

Window.prototype.map = function() {
    this.xclient.MapWindow(this.id);
}

Window.prototype.unmap = function() {
    this.xclient.UnmapWindow(this.id);
}

module.exports = Window;
