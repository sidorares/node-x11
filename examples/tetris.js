const figs = [
    //[ 0, 0, 4, 0],

    //  0 0
    //  0 0
    [  1, 1, 0, 1, 1, 0, 0, 0],
    //  0000
    [ -2, 0, -1, 0,  0,  0, 1,  0],
    //   00
    //  00
    [ -1, 0,  0, 0,  0,  1, 1,  1],
    //  00
    //   00
    [  0, 0,  0, 1, -1, 1,  1, 0],
    //   0
    //  000
    [  0, 0,  1, 0,  0, 1, -1, 0 ],
    //    0
    //  000
    [ 0, 0, -1, 0, -2, 0, 0, 1 ],
    [ 0, 0, -1, 0, -2, 0, 0, -1 ]
];

const Buffer = require('buffer').Buffer;

const startpos = [4, 15];
const cupsize = [10, 20];
const cup = Buffer.alloc(cupsize[0]*cupsize[1]);
let moveInterval;

function clearCup()
{
    for (let i=0; i <cup.length; ++i)
        cup[i] = 0;
}

const anglecoeff = [1, 0,  0, 1,
                  0, -1, 1, 0,
                  -1, 0, 0, -1,
                  0, 1, -1, 0];
//       0: x = 1x + 0y, y =  0x + 1y
//       1: x = 0x - 1y, y =  1x + 0y
//       2: x =-1x + 0y, y =  0x - 1y
//       2: x = 0x + 1y, y = -1x + 0y;


function intersects(num, pos, angle)
{
    angle %= 4;
    const fig = getTransformedFigure(num, angle, pos);
    for (let i=0; i < fig.length; i+= 2)
    {
        const x = fig[i];
        const y = fig[i+1];
        if (y < 0)
            return true;
        if (x < 0)
            return true;
        if (x >= cupsize[0])
            return true;
        if (y >= cupsize[1])
            return true;
        if (cup[x + y*cupsize[0]])
            return true;
    }
    return false;
}

function putfig(num, pos, angle)
{
    angle %= 4;
    const fig = getTransformedFigure(num, angle, pos);
    for (let i=0; i < fig.length; i+= 2)
    {
        const x = fig[i];
        const y = fig[i+1];
        const ind = x + y*cupsize[0];
        cup[ind] = 1;
    }
}

function deleteLines()
{
    for (let y=0; y < cupsize[1]; ++y)
    {
        let count = 0;
        for (let x=0; x < cupsize[0]; ++x)
        {
           const i = x + y*cupsize[0];
           if (cup[i] == 1)
               count++;
        }
        if (count == cupsize[0]) // full line;
        {
            for (let yy=y; yy < cupsize[1] - 1; ++yy)
            {
                for (let xx=0; xx < cupsize[0]; ++xx)
                {
                   const ii = xx + yy*cupsize[0];
                   cup[ii] = cup[ii+cupsize[0]];
                }
            }
            y--;
        }
    }
}

const x11 = require('../lib');
const Exposure = x11.eventMask.Exposure;
const KeyPress = x11.eventMask.KeyPress;
const sqsize = 15;
let wid, cidBlack, cidWhite;
let angle = 0;
const gamestate = 'stopped';
let timer;
let X;
let pos = [4, 13];
let fignum = 0;

function timerMove()
{
    const newpos = [pos[0], pos[1]];
    newpos[1]--;
    if (intersects(fignum, newpos, angle))
    {
        putfig(fignum, pos, angle);

        deleteLines();

        fignum = parseInt((Math.random()*100)%figs.length);
        pos[0] = startpos[0];
        pos[1] = startpos[1];
        angle = 0;
        if (intersects(fignum, pos, angle)) {
             process.exit(0);
        }
        draw();
    } else {
       pos = newpos;
       draw();
    }
}

function startGame()
{
    // start timers set up cirrent + next figure, clear cup
    clearCup();
    moveInterval = setInterval(timerMove, 200);
}

function getTransformedFigure(num, angle, pos)
{
    const tfig = [];
    const fig = figs[num];
    for (let i=0; i < fig.length; i+=2)
    {
        const figx = fig[i];
        const figy = fig[i+1];
        const x = pos[0] + anglecoeff[angle*4]*figx + anglecoeff[angle*4+1]*figy;
        const y = pos[1] + anglecoeff[angle*4+2]*figx + anglecoeff[angle*4+3]*figy;
        tfig.push(x);
        tfig.push(y);
    }
    return tfig;
}

function draw()
{
    let whiterects = [];
    let blackrects = [];
    for (let x=0; x < cupsize[0]; ++x)
    {
        for (let y=0; y < cupsize[1]; ++y)
        {
            const index = x + y*cupsize[0];
            const rect = [x*sqsize, (cupsize[1]-1)*sqsize - y*sqsize, sqsize, sqsize];
            if (cup[index] != 0)
                blackrects = blackrects.concat(rect);
            else
                whiterects = whiterects.concat(rect);
        }
    }
    const fig = getTransformedFigure(fignum, angle, pos);
    for (let i=0; i < fig.length; i+=2)
    {
        const x = fig[i];
        const y = fig[i+1]
        blackrects = blackrects.concat([x*sqsize, (cupsize[1]-1)*sqsize - y*sqsize, sqsize, sqsize]);
    }
    X.PolyFillRectangle(wid, cidWhite, whiterects);
    X.PolyFillRectangle(wid, cidBlack, blackrects);
}

function rotate(v)
{
    let newangle = angle + v;
    if (newangle < 0)
        newangle = 3;
    if (newangle >= 4)
        newangle = 0;
    if (intersects(fignum, pos, newangle))
        return;

    angle = newangle;
    draw();
}

function rotateUp()
{
   rotate(1);
}

function rotateDown()
{
   rotate(-1);
}

function moveX(v)
{
    const newpos = [pos[0] + v, pos[1]];
    if (intersects(fignum, newpos, angle))
        return;
    pos = [newpos[0], newpos[1]];
    draw();
}

function moveLeft()
{
    moveX(-1);
}

function moveRight()
{
    moveX(1);
}

function drop()
{
    const newpos = [pos[0], pos[1]];
    while (!intersects(fignum, newpos, angle))
        newpos[1]--;
    newpos[1]++;
    pos = [newpos[0], newpos[1]];
    draw();
}


x11.createClient((err, display) => {
    const ks = x11.keySyms;
    const ks2Name = {};
    for (const key in ks)
        ks2Name[ ks[key].code ] = key;
    const kk2Name = {};
    const min = display.min_keycode;
    const max = display.max_keycode;
    X = display.client;
    X.GetKeyboardMapping(min, max-min, (err, list) => {
        for (let i=0; i < list.length; ++i)
        {
            const name = kk2Name[i+min] = [];
            const sublist = list[i];
            for (let j =0; j < sublist.length; ++j)
                name.push(ks2Name[sublist[j]]);
        }

    const root = display.screen[0].root;
    const white = display.screen[0].white_pixel;
    const black = display.screen[0].black_pixel;
    wid = X.AllocID();
    X.CreateWindow(wid, root, 0, 0, cupsize[0]*sqsize, cupsize[1]*sqsize, 0, 0, 0, 0, { backgroundPixel: white, eventMask: KeyPress|Exposure });
    cidBlack = X.AllocID();
    cidWhite = X.AllocID();
    X.CreateGC(cidBlack, wid,  { foreground: black, background: white } );
    X.CreateGC(cidWhite, wid,  { foreground: white, background: black } );
    X.MapWindow(wid);

    clearCup();
    startGame();

    X.on('event', ev => {
         switch(ev.type) {
         case 6:
              break;
         case 12: // expose
              draw(); break;
         case 2:
              const key = kk2Name[ev.keycode][0];
              console.log(key);
              switch(key) {
                  case 'XK_Up': rotateUp(); break;
                  case 'XK_Down': rotateDown(); break;
                  case 'XK_Left': moveLeft(); break;
                  case 'XK_Right': moveRight(); break;
                  case 'XK_space': drop(); break;
              }
              break;
         default:
              console.log('default event', ev);
         }
    });

    X.on('end', () => {
        clearInterval(moveInterval);
    });

  });

});
