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
    this.xclient.CreateWindow(
        this.id, this.parent.id, this.x, this.y, this.w, this.h, 1, 1, 0, { backgroundPixel: this.bg, eventMask: 0x00000040 }
    );
    this.map();
    // very ineffitient this way!!!
    var wnd = this;
    this.xclient.on('event', function(ev) 
    {
         if (ev.type == 6 && ev.wid == wnd.id)
         {
             wnd.emit('mousemove', ev);
         }
    });
    /*
    // TODO: right way to handle events
    // need to modify xcore to dispatch events to event_consumers
    // 
    eventType2eventName = {
        6: 'mousemove'
    };

    this.xclient.event_consumers[wnd.id] = function( ev )
    {      
        wnd.emit(eventType2eventName, ev); // convert to mousemove? (ev already event-spacific)               
    };    

    */
}
util.inherits(Window, EventEmitter);

Window.prototype.map = function() {
    this.xclient.MapWindow(this.id);
}

Window.prototype.unmap = function() {
    this.xclient.UnapWindow(this.id);
}

module.exports = Window;
