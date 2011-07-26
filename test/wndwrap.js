var x11 = require('../lib/x11');
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;

var EventEmitter = require('events').EventEmitter;
var util = require('util'); // util.inherits

function GraphicContext(win)
{
    this.win = win;
    this.xclient = win.xclient;
    this.id = this.xclient.AllocID();
    win.xclient.CreateGC(this.id, win.id);
}

GraphicContext.prototype.polyLine = function(points)
{
    this.xclient.PolyLine(0, this.win.id, this.id, points);    
}

GraphicContext.prototype.noop = function()
{
    //testing triggering gc creation
}

GraphicContext.prototype.rectangles = function(x, y, xyWHpoints)
{
    this.xclient.PolyFillRectangle(this.win.id, this.id, xyWHpoints);
}

GraphicContext.prototype.text = function(x, y, text)
{
    this.xclient.PolyText8(this.win.id, this.id, x, y, [text]);    
}

GraphicContext.prototype.polyLine = function(points, opts)
{
    var coordinateMode = 0;
    if (opts && opts.coordinateMode === 'previous')
        coordinateMode = 1;                         
    this.xclient.PolyLine(coordinateMode, this.win.id, this.id, points);
}

GraphicContext.prototype.points = function(points, opts)
{
    var coordinateMode = 0;
    if (opts && opts.coordinateMode === 'previous')
        coordinateMode = 1;                         
    this.xclient.PolyPoint(coordinateMode, this.win.id, this.id, points);
}

function Window(parent, x, y, w, h)
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
    this.black = this.xclient.display.screen[0].black_pixel;
    this.white = this.xclient.display.screen[0].white_pixel;
    this.id = this.xclient.AllocID();

    var borderWidth = 1;
    var _class = 1; // InputOutput
    var visual = 0; // CopyFromParent
    this.xclient.CreateWindow(
        this.id, this.parent.id, this.x, this.y, this.w, this.h, 
        borderWidth, _class, visual, 
        { 
            backgroundPixel: this.white, 
            eventMask: Exposure|PointerMotion|ButtonPress|ButtonRelease
        }
    );

    //this.map();
    var wnd = this;
    eventType2eventName = {
        4: 'mousedown',
        5: 'mouseup',
        6: 'mousemove',
       12: 'expose'
    };

    var ee = new EventEmitter();
    this.xclient.event_consumers[wnd.id] = ee;
    // TODO: do we need to have wnd as EventEmitter AND EventEmitter stored in event_consumers ?
    ee.on('event', function( ev )
    {
        if (ev.type == 12) //Expose
            ev.gc = wnd.gc;
        wnd.emit(eventType2eventName[ev.type], ev); // convert to mousemove? (ev is already event-spacific)               
    });    
    // TODO: track delete events and remove wmd from consumers list

    this.__defineSetter__('title', function(title) {
        this._title = title;
        this.xclient.ChangeProperty(0, this.id, this.xclient.atoms.WM_NAME, this.xclient.atoms.STRING, 8, title);
    });

    this.__defineGetter__('title', function() {
        return this._title;
    });
   
    this.__defineGetter__('gc', function()
    {
       if (!this._gc)
       {
           this._gc = new GraphicContext(this);
       } 
       return this._gc;
    });

}
util.inherits(Window, EventEmitter);

Window.prototype.map = function() {
    this.xclient.MapWindow(this.id);
    return this;
}

Window.prototype.unmap = function() {
    this.xclient.UnmapWindow(this.id);
    return this;
}

Window.prototype.handle = function(handlers) {
    // TODO: compare event mask with events names and issue 
    // one ChangeWindowAttributes request adding missing events
    for (var eventName in handlers) {
        this.on(eventName, handlers[eventName]);
    }
    return this;
}

Window.prototype.getProperty = function(name, cb) {
    this.xclient.InternAtom(true, nam, function(nameAtom) {
        this.xclient.GetProperty(0, this.id, nameAtom, 0, 1000000000, function(prop) {
            cb(prop);
        });
    });
    return this;
}

module.exports = Window;
