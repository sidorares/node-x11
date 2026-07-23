const x11 = require('../../lib');

const randomarr = [];
for(let i=0; i < 20000; ++i) {
    randomarr.push([Math.random()*30-15, Math.random()*30-15, Math.random()*30-15]);
}

const xclient = x11.createClient((err, display) => {
    const X = display.client;
    const root = display.screen[0].root;
    X.require('glx', (err, GLX) => {
        const screen = 0;
        const isDirect = 0;
        const ctx = X.AllocID();
        const visual = 0xa1;
        const shareListCtx = 0;
        const width = 800;
        const height = 800;
        GLX.CreateContext(ctx, visual, screen, shareListCtx, isDirect);
        const win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, width, height, 0, 0, 0, 0, { eventMask: x11.eventMask.PointerMotion });
        X.MapWindow(win);
        GLX.MakeCurrent(win, ctx, 0, (err, res) => {


GLX.NewList(ctx, 1, 0x00001300);
const gl = GLX.renderPipeline();
gl.Begin(0x0004);
for (let i=0; i < 10000; ++i)
{
    gl.Vertex3f(randomarr[i][0], randomarr[i][1], randomarr[i][2]);
    gl.Color3f((randomarr[i+10000][0]+15/30), (randomarr[i+10000][1]+15)/30, (randomarr[i+10000][2]+15)/30);
}
gl.End();
gl.render(ctx);
GLX.EndList(ctx);

            let i = 0.0; // animation phase
            X.on('event', ev => {
                const gl = GLX.renderPipeline();

  gl.Viewport(0, 0, 800, 800);
  gl.MatrixMode(0x1701);
  gl.LoadIdentity();
  gl.Ortho(-30.0, 30.0, -30.0, 30.0, -300.0, 300.0);
  gl.Rotatef(ev.y, 1, 0, 0);
  gl.MatrixMode(0x1700);

  gl.ClearColor(0.3,0.3,0.3,0.0);
  gl.Clear(0x00004000|0x00000100);
  gl.ShadeModel(0x1D01);
  gl.LoadIdentity();
  //gl.Translatef(ev.x/100+-15.0, ev.y/100+-15.0, 0.0);
  gl.Scalef(0.1, 0.1, 1);

  gl.Translatef(-15.0, -15.0, 0.0);
  //gl.Rotatef(ev.y, 0, 0, 1);
  gl.Begin(0x0004);
  gl.Color3f(1.0, 0.0, 0.0);
  gl.Vertex3f(0.0, 0.0, 0.0);
  gl.Color3f(0.0, 1.0, 0.0);
  gl.Vertex3f(30.0, 0.0, 0.0);
  gl.Color3f(0.0, 0.0, 1.0);
  gl.Vertex3f(0.0, 30.0, 0);

  const list = false;
  if (list) {
    gl.CallList(1);
  } else {
    for (let i=0; i < 500; ++i)
    {
      gl.Vertex3f(randomarr[i][0], randomarr[i][1], randomarr[i][2]);
      gl.Color3f((randomarr[i+500][0]+15/30), (randomarr[i+500][1]+15)/30, (randomarr[i+500][2]+15)/30);
    }
  }

  gl.End();
                gl.render(ctx);
                GLX.SwapBuffers(ctx, win);
            //}, 30);
            });
        });
    });
    X.on('error', err => { console.log(err); });
});
