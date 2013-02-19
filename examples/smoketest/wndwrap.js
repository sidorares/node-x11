var x11 = require('../../lib');
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;
var SubstructureNotify = x11.eventMask.SubstructureNotify;
var StructureNotify = x11.eventMask.StructureNotify;

var EventEmitter = require('events').EventEmitter;
var util = require('util'); // util.inherits

function GraphicContext(win)
{
    this.win = win;
    this.xclient = win.xclient;
    this.id = this.xclient.AllocID();
    var screen = this.xclient.display.screen[0];
    //win.xclient.CreateGC(this.id, win.id, { foreground: screen.black_pixel, background: screen.white_pixel});
    this.xclient.CreateGC(this.id, win.id, { foreground: screen.white_pixel, background: screen.black_pixel});
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

GraphicContext.prototype.copy = function(srcDrawable, srcX, srcY, dstX, dstY, width, height)
{
    // CopyArea: srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height
    this.xclient.CopyArea(srcDrawable.id, this.win.id, this.id, srcX, srcY, dstX, dstY, width, height);
}

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
    this.black = this.xclient.display.screen[0].black_pixel;
    this.white = this.xclient.display.screen[0].white_pixel;
    this.id = this.xclient.AllocID();

    if (!bg)
       bg = this.white;

    var borderWidth = 1;
    var _class = 1; // InputOutput
    var visual = 0; // CopyFromParent
    var depth = 0;
    this.xclient.CreateWindow(
        this.id, this.parent.id, this.x, this.y, this.w, this.h, 
        borderWidth, depth, _class, visual, 
        { 
            backgroundPixel: bg, 
            eventMask: Exposure|PointerMotion|ButtonPress|ButtonRelease|SubstructureNotify|StructureNotify
        }
    );

    //this.map();
    var wnd = this;
    eventType2eventName = {
        4: 'mousedown',
        5: 'mouseup',
        6: 'mousemove',        
       12: 'expose',       
       16: 'create',
       19: 'map'
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

Window.prototype.createPixmap = function(width, height)
{
    var pid = this.xclient.AllocID();
    //  function(depth, pid, drawable, width, height) {
    this.xclient.CreatePixmap( this.xclient.display.screen[0].root_depth, pid, this.id, width, height);
    var pixmap = {};
    pixmap.id = pid;
    pixmap.__defineGetter__('gc', function()
    {
       if (!this._gc)
       {
           this._gc = new GraphicContext(this);
       } 
       return this._gc;
    });
    pixmap.xclient = this.xclient;
    return pixmap;
}

module.exports = Window;
