const x11 = require('../../lib');
const EventEmitter = require('events').EventEmitter;

let X, root, white;
const events = x11.eventMask.Button1Motion|x11.eventMask.ButtonPress|x11.eventMask.ButtonRelease|x11.eventMask.SubstructureNotify|x11.eventMask.SubstructureRedirect|x11.eventMask.Exposure;
const frames = {};
let dragStart = null;

function ManageWindow(wid)
{
    console.log(`MANAGE WINDOW: ${wid}`);
    X.GetWindowAttributes(wid, (err, attrs) => {

        if (attrs[8]) // override-redirect flag
        {
            // don't manage
            console.log("don't manage");
            X.MapWindow(wid);
            return;
        }

    const fid = X.AllocID();
    frames[fid] = 1;
    let winX, winY;
    winX = parseInt(Math.random()*300);
    winY = parseInt(Math.random()*300);

    X.GetGeometry(wid, (err, clientGeom) => {

        console.log("window geometry: ", clientGeom);
        const width = clientGeom.width + 4;
        const height = clientGeom.height + 24;
        console.log("CreateWindow", fid, root, winX, winY, width, height);
        X.CreateWindow(fid, root, winX, winY, width, height, 0, 0, 0, 0,
        {
            backgroundPixel: white,
            eventMask: events
        });

         const bggrad = X.AllocID();
         X.Render.LinearGradient(bggrad, [0,0], [0,24],
                [
                  [0,   [0,0,0xffff,0xffffff ] ],
                  [1,   [0x00ff, 0xff00, 0, 0xffffff] ]
                ]);

        const framepic = X.AllocID();
        X.Render.CreatePicture(framepic, fid, X.Render.rgb24);


        const ee = new EventEmitter();
        X.event_consumers[fid] = ee;
        ee.on('event', ev => {
            console.log(['event', ev]);
            if (ev.type === 17) // DestroyNotify
            {
               X.DestroyWindow(fid);
            } else if (ev.type == 4) {
                dragStart = { rootx: ev.rootx, rooty: ev.rooty, x: ev.x, y: ev.y, winX, winY };
            } else if (ev.type == 5) {
                dragStart = null;
            } else if (ev.type == 6) {
                winX = dragStart.winX + ev.rootx - dragStart.rootx;
                winY = dragStart.winY + ev.rooty - dragStart.rooty;
                X.MoveWindow(fid, winX, winY);
            } else if (ev.type == 12) {
                X.Render.Composite(3, bggrad, 0, framepic, 0, 0, 0, 0, 0, 0, width, height);
            }
        });
        X.ChangeSaveSet(1, wid);
        X.ReparentWindow(wid, fid, 1, 21);
        console.log("MapWindow", fid);
        X.MapWindow(fid);
        X.MapWindow(wid);
    });

    });
}

x11.createClient((err, display) => {
    X = display.client;
    X.require('render', (err, Render) => {
    X.Render = Render;

    root = display.screen[0].root;
    white = display.screen[0].white_pixel;
    console.log(`root = ${root}`);
    X.ChangeWindowAttributes(root, { eventMask: x11.eventMask.Exposure|x11.eventMask.SubstructureRedirect }, err => {
        if (err.error == 10)
        {
            console.error('Error: another window manager already running.');
            process.exit(1);
        }
    });
    X.QueryTree(root, (err, tree) => {
        tree.children.forEach(ManageWindow);
    });

    X.bggrad = X.AllocID();
    Render.LinearGradient(X.bggrad, [-10,0], [0,1000],
            //RenderRadialGradient(pic_grad, [0,0], [1000,100], 10, 1000,
            //RenderConicalGradient(pic_grad, [250,250], 360,
                [
                  [0,   [0,0,0,0xffffff ] ],
                  //[0.1, [0xfff, 0, 0xffff, 0x1000] ] ,
                  //[0.25, [0xffff, 0, 0xfff, 0x3000] ] ,
                  //[0.5, [0xffff, 0, 0xffff, 0x4000] ] ,
                  [1,   [0xffff, 0xffff, 0, 0xffffff] ]
                ]);

    X.rootpic = X.AllocID();
    Render.CreatePicture(X.rootpic, root, Render.rgb24);
})

}).on('error', err => {
    console.error(err);
}).on('event', ev => {
    console.log(ev);
    if (ev.type === 20)        // MapRequest
    {
        if (!frames[ev.wid])
            ManageWindow(ev.wid);
        return;
    } else if (ev.type === 23) // ConfigureRequest
    {
        X.ResizeWindow(ev.wid, ev.width, ev.height);
    } else if (ev.type === 12) {
        console.log('EXPOSE', ev);
        X.Render.Composite(3, X.bggrad, 0, X.rootpic, 0, 0, 0, 0, 0, 0, 1000, 1000);
    }
    console.log(ev);

});
