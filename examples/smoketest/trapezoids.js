const _ = require('underscore');
const x11 = require('../../lib');
const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;
const ButtonPress = x11.eventMask.ButtonPress;

let draw;

let useConvo3 = true;

x11.createClient({ debug: true}, (err, display) => {

  const X = display.client;
  const root = display.screen[0].root;

  const wid = X.AllocID();
  X.CreateWindow(
     wid, root,
     0, 0, 800, 600,
     0, 0, 0, 0,
     {
        eventMask: Exposure|PointerMotion|ButtonPress
     }
  );
  X.MapWindow(wid);


  X.require('render', (err, Render) => {

    Render.QueryFilters(console.log);

    const pixMask = X.AllocID();
    X.CreatePixmap(pixMask, wid, 8, 600, 600);
    const pictTraps = X.AllocID();
    Render.CreatePicture(pictTraps, pixMask, Render.a8);

    const pictWin = X.AllocID();
    Render.CreatePicture(pictWin, wid, Render.rgb24);

    const pictSolid = X.AllocID();
    r = 0.2; g = 0.2; b = 0.2; a = 1;
    Render.CreateSolidFill(pictSolid, r, g, b, a);

    const pixBuff = X.AllocID();
    X.CreatePixmap(pixBuff, wid, 24, 600, 600);
    const pictBuff = X.AllocID();
    Render.CreatePicture(pictBuff, pixBuff, Render.rgb24);

    let convo5 = [ 5, 5, 0.0030,    0.0133,    0.0219,    0.0133,    0.0030,
      0.0133,    0.0596,    0.0983,    0.0596,    0.0133,
      0.0219,    0.0983,    0.1621,    0.0983,    0.0219,
      0.0133,    0.0596,    0.0983,    0.0596,    0.0133,
      0.0030,    0.0133,    0.0219,    0.0133,    0.0030];
    const convo3 = [3, 3, 0.01, 0.08, 0.01, 0.08, 0.64, 0.08, 0.01, 0.08, 0.01];

    convo5 = [21, 21].concat(require('./blur-convolution')(21, 11));

    //Render.SetPictureFilter(pictBuff, 'convolution', convo3);
    //Render.SetPictureFilter(pictTraps, 'convolution', convo3);
    //Render.SetPictureFilter(pictBuff, 'bilinear', []);
    Render.SetPictureFilter(pictBuff, 'best', []);

    draw1 = (x, y) => {
      console.log('draw 1', x, y);
      let r = 3 + 2*Math.floor(x / 100);
      const convo = [r, r].concat(require('./blur-convolution')(r, r));
      Render.SetPictureFilter(pictBuff, 'convolution', convo);

      let a = (x-400)/500;
      const m = [
       Math.cos(a), Math.sin(a), 0,
       -Math.sin(a), Math.cos(a), 0,
       0, 0, 1
     ];

      // Render.SetPictureTransform(pictTraps, m)

      let g;
      let b;

      // fill window: white at half alpha. Colours are premultiplied, so each
      // channel is scaled by the alpha rather than left at full scale.
      a = 0.5; r = a; g = a; b = a;
      Render.FillRectangles(1, pictBuff, [r, g, b, a], [0, 0, 1000, 1000])

      // fill traps
      r = 0;g = 0;b = 0;a = 0;
      Render.FillRectangles(1, pictTraps, [r, g, b, a], [0, 0, 1000, 1000])

      Render.AddTraps(pictTraps, 0, 0, [
        x, 200, y,
        //150, 200, 50,
        5, 250, 300,
        110, 200, 310,
        50, 150, 500
      ]);


      // (op, src, mask, dst, srcX, srcY, maskX, maskY, dstX, dstY, width, height)
      //Render.Composite(Render.PictOp.Over, pictSolid, pictTraps, pictWin, 0, 0, 0, 0, 0, 0, 800, 600);
      //Render.PictOp.Over

      Render.Composite(Render.PictOp.Over, pictSolid, pictTraps, pictBuff, 0, 0, 0, 0, 0, 0, 800, 600);
      Render.Composite(Render.PictOp.Over, pictBuff, 0, pictWin, 0, 0, 0, 0, 0, 0, 800, 600);
    };

    draw = (x, y) => {
      const f = _.debounce(() => {
        draw1(x, y);
      }, 100);
      f();
    };

  });

}).on('error', err => {
   console.log(err);
}).on('event', ev => {
    //console.log(ev);
    if (ev.name == 'MotionNotify') {
      draw(ev.x, ev.y);
    } else if (ev.name == 'ButtonPress') {
      useConvo3 = !useConvo3;
      draw(ev.x, ev.y);
      //console.log(ev);
    }
});
