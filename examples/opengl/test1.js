var x11 = require('../../lib');

var randomarr = [];
for(var i=0; i < 2000; ++i) {
    randomarr.push([Math.random()*30-15, Math.random()*30-15, Math.random()*30-15]);
}

var width = 500;
var height = 500;
var eventmask = x11.eventMask.PointerMotion;
var listId = 1;

x11.createClient(function(err, display) {
    var X = display.client;
    var root = display.screen[0].root;
    X.require('glx', function(err, GLX) {
        var visual = 0;
        var visuals = display.screen[0].depths[24];
        for (visual in visuals) {
          if (visuals[visual].class == 4 || visuals[visual].class == 5)
            break;
        }

        var win = X.AllocID();
        X.CreateWindow(win, root, 0, 0, width, height, 0, 0, 0, visual, { eventMask: eventmask });
        X.MapWindow(win);
        var ctx = X.AllocID();
        GLX.CreateContext(ctx, visual, 0, 0, 0);
        GLX.MakeCurrent(win, ctx, 0, function(err, ctx) {}); // do we need to wait for reply here?

        function draw(ev) {
            var gl = GLX.renderPipeline();
            gl.Enable(0x0B71);
            gl.Viewport(0, 0, 800, 800);
            gl.MatrixMode(0x1701);
            gl.LoadIdentity();
            gl.Ortho(-30.0, 30.0, -30.0, 30.0, -300.0, 300.0);
            //gl.Frustum(-30.0, 30.0, -30.0, 30.0, 30, 300.0);

            gl.Rotatef(ev.y, 0, 0, 1);
            gl.Rotatef(ev.x, 1, 0, 0);
            gl.MatrixMode(0x1700);
            gl.ClearColor(0.3,0.3,0.3,0.0);
            gl.Clear(0x00004000|0x00000100);
            gl.ShadeModel(0x1D01);
            gl.LoadIdentity();
            gl.CallList(listId);
            gl.render(ctx);
            GLX.SwapBuffers(ctx, win);
        }

        GLX.GenLists(ctx, 1, function(err, startListIndex) {
            listId = startListIndex;
            GLX.NewList(ctx, listId, 0x00001300);
            var gl = GLX.renderPipeline();
            gl.Begin(0x0004);
            for (var i=0; i < 1000; ++i)
            {
               gl.Vertex3f(randomarr[i][0], randomarr[i][1], randomarr[i][2]);
               gl.Color3f((randomarr[i+1000][0]+15/30), (randomarr[i+1000][1]+15)/30, (randomarr[i+1000][2]+15)/30);
            }
            gl.End();
            gl.render(ctx);
            GLX.EndList(ctx);
            draw({x: 10, y: 10});
        });

        X.on('event', draw);
    });
    X.on('error', function(err) { console.log(err); });
});

