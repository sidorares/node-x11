var figs = [
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

var Buffer = require('buffer').Buffer;

var startpos = [4, 15];
var cupsize = [10, 20];
var cup = new Buffer(cupsize[0]*cupsize[1]);

function clearCup()
{
    for (var i=0; i <cup.length; ++i)
        cup[i] = 0;
}

var anglecoeff = [1, 0,  0, 1, 
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
    var fig = getTransformedFigure(num, angle, pos);
    for (var i=0; i < fig.length; i+= 2)
    {
        var x = fig[i];
        var y = fig[i+1]
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
    var fig = getTransformedFigure(num, angle, pos);
    for (var i=0; i < fig.length; i+= 2)
    {
        var x = fig[i];
        var y = fig[i+1]
        var ind = x + y*cupsize[0];
        cup[ind] = 1;
    }
}

function deleteLines()
{
    for (var y=0; y < cupsize[1]; ++y)
    {
        var count = 0;
        for (var x=0; x < cupsize[0]; ++x)
        {
           var i = x + y*cupsize[0];
           if (cup[i] == 1)
               count++;
        }
        if (count == cupsize[0]) // full line;
        {
            var count = 0;
            for (var yy=y; yy < cupsize[1] - 1; ++yy)
            {
                for (var xx=0; xx < cupsize[0]; ++xx)
                {
                   var ii = xx + yy*cupsize[0];
                   cup[ii] = cup[ii+cupsize[0]];
                }
            }
            y--;
        }
    }
}

var x11 = require('../lib/x11');
var Exposure = x11.eventMask.Exposure;
var KeyPress = x11.eventMask.KeyPress;
var sqsize = 50;
var wid, cidBlack, cidWhite;
var angle = 0;
var gamestate = 'stopped';
var timer;
var X;
var pos = [4, 13];
var fignum = 0;

function timerMove()
{
    var newpos = [pos[0], pos[1]];
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
    setInterval(timerMove, 200);
}

function getTransformedFigure(num, angle, pos)
{
    var tfig = [];
    var fig = figs[num];
    for (var i=0; i < fig.length; i+=2)
    {
        var figx = fig[i];
        var figy = fig[i+1]
        var x = pos[0] + anglecoeff[angle*4]*figx + anglecoeff[angle*4+1]*figy;
        var y = pos[1] + anglecoeff[angle*4+2]*figx + anglecoeff[angle*4+3]*figy;
        tfig.push(x);
        tfig.push(y);
    }
    return tfig;
}

function draw()
{
    var whiterects = [];
    var blackrects = [];
    for (var x=0; x < cupsize[0]; ++x)
    {
        for (var y=0; y < cupsize[1]; ++y)
        {
            var index = x + y*cupsize[0];
            var rect = [x*sqsize, (cupsize[1]-1)*sqsize - y*sqsize, sqsize, sqsize];
            if (cup[index] != 0)
                blackrects = blackrects.concat(rect);
            else
                whiterects = whiterects.concat(rect);
        }
    }
    var fig = getTransformedFigure(fignum, angle, pos);
    for (var i=0; i < fig.length; i+=2)
    {
        var x = fig[i];
        var y = fig[i+1]
        blackrects = blackrects.concat([x*sqsize, (cupsize[1]-1)*sqsize - y*sqsize, sqsize, sqsize]);
    }
    X.PolyFillRectangle(wid, cidWhite, whiterects);
    X.PolyFillRectangle(wid, cidBlack, blackrects);
}

function rotate(v)
{
    var newangle = angle + v;
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
    var newpos = [pos[0] + v, pos[1]];
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
    var newpos = [pos[0], pos[1]];
    while (!intersects(fignum, newpos, angle))
        newpos[1]--;
    newpos[1]++;
    pos = [newpos[0], newpos[1]];
    draw();
}


x11.createClient(function(display) {
    X = display.client;
    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel; 
    wid = X.AllocID();
    X.CreateWindow(wid, root, 0, 0, cupsize[0]*sqsize, cupsize[1]*sqsize, 1, 1, 0, { backgroundPixel: white, eventMask: KeyPress|Exposure });
    cidBlack = X.AllocID();
    cidWhite = X.AllocID();
    X.CreateGC(cidBlack, wid,  { foreground: black, background: white } );
    X.CreateGC(cidWhite, wid,  { foreground: white, background: black } );
    X.MapWindow(wid);

    clearCup();
    startGame();


    var up = 111;
    var down = 116;
    var left = 113;
    var right = 114;

//TODO keykode -> keysym
/*
    var up = 98;
    var down = 104;
    var left = 100;
    var right = 102;
*/
    X.on('event', function(ev) {
         switch(ev.type) {
         case 6:
              break;
         case 12: // expose
              draw(); break;              
         case 2:
              //console.log('keycode', ev);
              //console.log(X.keymap[ev.keycode]);
              // 111, 113, 114, 116, 65
              switch(ev.keycode) {            
                  case up: rotateUp(); break;
                  case down: rotateDown(); break;
                  case left: moveLeft(); break;
                  case right: moveRight(); break;
                  case 65: drop(); break;
              }
              break;
         default:
              console.log('default event', ev);
         }
    });
});
