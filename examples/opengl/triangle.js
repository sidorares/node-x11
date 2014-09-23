var x11 = require('../../lib');

var randomarr = [];
for(var i=0; i < 20000; ++i) {
    randomarr.push([Math.random()*30-15, Math.random()*30-15, Math.random()*30-15]);
}

var xclient = x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('glx', function(err, GLX) {
        var screen = 0;
        var isDirect = 0;
        var ctx = X.AllocID();
        var visual = 0xa1;
        var shareListCtx = 0;
        var width = 800;
        var height = 800;
        GLX.CreateContext(ctx, visual, screen, shareListCtx, isDirect);
        var win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, width, height, 0, 0, 0, 0, { eventMask: x11.eventMask.PointerMotion });
        X.MapWindow(win);
        GLX.MakeCurrent(win, ctx, 0, function(err, res) {


GLX.NewList(ctx, 1, 0x00001300);
var gl = GLX.renderPipeline();
gl.Begin(0x0004);
for (var i=0; i < 10000; ++i)
{
    gl.Vertex3f(randomarr[i][0], randomarr[i][1], randomarr[i][2]);
    gl.Color3f((randomarr[i+10000][0]+15/30), (randomarr[i+10000][1]+15)/30, (randomarr[i+10000][2]+15)/30);
}
gl.End();
gl.render(ctx);
GLX.EndList(ctx);

            var i = 0.0;
            X.on('event', function(ev) {
                var gl = GLX.renderPipeline();

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

  var list = false;
  if (list) {
    gl.CallList(1);
  } else {
    for (var i=0; i < 500; ++i)
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
    X.on('error', function(err) { console.log(err); });
});
