#!/home/laplace/node/node

const Buffer = require('buffer').Buffer;
const x11 = require('../../lib');

const Exposure = x11.eventMask.Exposure;
const KeyPress = x11.eventMask.KeyPress;
const KeyRelease = x11.eventMask.KeyRelease;
const ButtonPress = x11.eventMask.ButtonPress;
const ButtonRelease = x11.eventMask.ButtonRelease;

// image and coords file from http://www.patrick-wied.at/projects/heatmap-keyboard/
// TODO: add simple tool to use&tag coords in own keyboard photo
// jpeg decoder is slightly modified version of https://github.com/notmasteryet/jpgjs
const kbdImg = require('./node-jpg').readJpeg(`${__dirname}/keyboard.jpg`);
const keycoords = require('./coordinates');

// from https://github.com/substack/node-keysym
const keysyms = require('./keysyms').records;
const ks2name = {};
for (const k in keysyms)
    ks2name[keysyms[k].keysym] = keysyms[k].names;
const kk2name = {};


x11.createClient((err, display) => {
    const X = display.client;
    X.require('big-requests', (err, BigReq) => {
        X.require('render', (err, Render) => {
            X.Render = Render;
            BigReq.Enable((err, maxLen) => {
                const min = display.min_keycode;
                const max = display.max_keycode;
		X.GetKeyboardMapping(min, max-min, (err, list) => {
        // map keycode to key name
    for (let i=0; i < list.length; ++i)
    {
        const name = kk2name[i+min] = [];
        const sublist = list[i];
        for (let j =0; j < sublist.length; ++j)
            name.push(ks2name[sublist[j]]);

    }
            main(X);
         });
            });
        });
    });
});

function main(X)
{
    const display = X.display;
    const Render = X.Render;
    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;

    const win = X.AllocID();
    X.CreateWindow(
       win, root,
       0, 0, kbdImg.width, kbdImg.height,
       0, 0, 0, 0,
       {
           backgroundPixel: white, eventMask: Exposure|KeyPress|ButtonPress
       }
    );
    X.MapWindow(win);

    const win1 = X.AllocID();
    X.CreateWindow(
       win1, root,
       0, 0, kbdImg.width, kbdImg.height,
       0, 0, 0, 0,
       {
           backgroundPixel: white, eventMask: Exposure|KeyPress|ButtonPress
       }
    );
    X.MapWindow(win1);

    const gc = X.AllocID();
    X.CreateGC(gc, win);

            const picGrad = X.AllocID();
            Render.RadialGradient(picGrad, [150/2,150/2], [150/2,150/2], 0, 150/2,
                [
                  [0,   [0,0,0,0x15000 ] ],
                  [1,   [0, 0, 0, 0x0] ]
                ]);
            const pixmapHeatPush = X.AllocID();
            X.CreatePixmap(pixmapHeatPush, win, 32, 150, 150);
            const picHeatPush = X.AllocID();
            Render.CreatePicture(picHeatPush, pixmapHeatPush, Render.rgba32);
            Render.FillRectangles(1, picHeatPush, [0, 0, 0, 0], [0, 0, 150, 150]);
            Render.Composite(3, picGrad, 0, picHeatPush, 0, 0, 0, 0, 0, 0, 150, 150);

            const pixmapKbd = X.AllocID();
            X.CreatePixmap(pixmapKbd, win, 24, kbdImg.width, kbdImg.height);
            const picKbd = X.AllocID();
            X.PutImage(2, pixmapKbd, gc, kbdImg.width, kbdImg.height, 0, 0, 0, 24, kbdImg.data);
            Render.CreatePicture(picKbd, pixmapKbd, Render.rgb24);

            const pixmapHeat = X.AllocID();
            X.CreatePixmap(pixmapHeat, win, 32, kbdImg.width, kbdImg.height);
            const picHeat = X.AllocID();
            Render.CreatePicture(picHeat, pixmapHeat, Render.rgba32);

            const picWin = X.AllocID();
            Render.CreatePicture(picWin, win, Render.rgb24);

            const picWin1 = X.AllocID();
            Render.CreatePicture(picWin1, win1, Render.rgb24);

    X.on('event', ev => {
        if (ev.type == 12) // expose
        {
            Render.Composite(3, picKbd, 0, picWin, 0, 0, 0, 0, 0, 0, kbdImg.width, kbdImg.height);
        } if (ev.type == 4) {
            const x = ev.x;
            const y = ev.y;
            let mindist = 1e10;
            let minkey = '';
            for (const k in keycoords)
            {
                const xdist = keycoords[k][0] - x;
                const ydist = keycoords[k][1] - y;
                const dist = xdist*xdist + ydist+ydist;
                if (dist < mindist)
                {
                    minkey = k;
                    mindist = dist;
                }
            }

            Render.Composite(3, picKbd, 0, picWin, 0, 0, 0, 0, 0, 0, kbdImg.width, kbdImg.height);
            Render.Composite(3, picHeatPush, 0, picWin, 0, 0, 0, 0, x -150/2, y-150/2, 150, 150);

        } if (ev.type == 2) {

            const name = kk2name[ev.keycode];
            for (const n in name)
            {
                const pt = keycoords[name[n]];
                if (pt)
                {
                    Render.Composite(3, picHeatPush, 0, picWin, 0, 0, 0, 0, pt[0] -150/2, pt[1]-150/2, 150, 150);

                    Render.Composite(3, picHeatPush, 0, picHeat, 0, 0, 0, 0, pt[0] -150/2, pt[1]-150/2, 150, 150);
                    Render.Composite(3, picHeatPush, 0, picWin1, 0, 0, 0, 0, pt[0] -150/2, pt[1]-150/2, 150, 150);


                    break;
                } else {
                    //console.log(name);
                }
            }
        } else {
            //console.log(ev);
        }
    })
    X.on('error', e => {
        console.error(e.message, ' error in request ',  e.stack);
        process.exit(1);
    });
}
