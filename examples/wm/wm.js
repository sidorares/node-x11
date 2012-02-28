var x11 = require('../../lib/x11');
var EventEmitter = require('events').EventEmitter;

var X, root;
var events = x11.eventMask.Button1Motion|x11.eventMask.ButtonPress|x11.eventMask.ButtonRelease|x11.eventMask.SubstructureNotify|x11.eventMask.SubstructureRedirect
var frames = {};
var dragStart = null;

function ManageWindow(wid)
{
    X.GetWindowAttributes(wid, function(attrs) {

        if (attrs[8])
        {
            X.MapWindow(wid);
            return;
        }

    var fid = X.AllocID();
    frames[fid] = 1;
    var winX, winY;
    winX = parseInt(Math.random()*300);
    winY = parseInt(Math.random()*300);
    
    X.GetGeometry(wid, function(clientGeom) {
        var width = clientGeom.width + 4;
        var height = clientGeom.height + 24;
        X.CreateWindow(fid, root, winX, winY, width, height, 1, 1, 0,
        { 
            backgroundPixel: 0xffffe0, 
            eventMask: events 
        });
        var ee = new EventEmitter();
        X.event_consumers[fid] = ee;
        ee.on('event', function(ev)
        {
            if (ev.type === 17) // DestroyNotify
            {
               X.DestroyWindow(fid);
            } else if (ev.type == 4) {
                dragStart = { rootx: ev.rootx, rooty: ev.rooty, x: ev.x, y: ev.y, winX: winX, winY: winY };
            } else if (ev.type == 5) {
                dragStart = null;
            } else if (ev.type == 6) {
                winX = dragStart.winX + ev.rootx - dragStart.rootx;
                winY = dragStart.winY + ev.rooty - dragStart.rooty;
                X.MoveWindow(fid, winX, winY);
            }
        });
        X.ChangeSaveSet(1, wid);
        X.ReparentWindow(wid, fid, 1, 21);
        X.MapWindow(fid);
        X.MapWindow(wid);
    });

    });
}

x11.createClient(function(display) {
    X = display.client;
    root = display.screen[0].root;
    console.log('root = ' + root);
    X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.SubstructureRedirect }, function(err) {
        if (err.error == 10)
        {
            console.error('Error: another window manager already running.');
            process.exit(1);
        }
    });
    X.QueryTree(root, function(tree) {
        tree.children.forEach(ManageWindow);
    });
}).on('error', function(err) {
    console.error(err);
}).on('event', function(ev) {
    console.log(ev);
    if (ev.type === 20)        // MapRequest
    {
        if (!frames[ev.wid])
            ManageWindow(ev.wid);
        return;
    } else if (ev.type === 23) // ConfigureRequest
    {
        X.ResizeWindow(ev.wid, ev.width, ev.height);
    }
    console.log(ev);
});
