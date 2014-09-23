/*
     node-x11 JavaScript version of glxgears
     https://github.com/sidorares/node-x11
     adopted version is intentionally as much close to glxgears.c as possible
     Andrey Sidorov sidorares@yandex.ru

     original code (C) Brian Paul
 */

/*
 * Copyright (C) 1999-2001  Brian Paul   All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
 * BRIAN PAUL BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
 * AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
/* $XFree86: xc/programs/glxgears/glxgears.c,v 1.2 2001/04/03 15:56:26 dawes Exp $ */

/*
 * This is a port of the infamous "gears" demo to straight GLX (i.e. no GLUT)
 * Port by Brian Paul  23 March 2001
 *
 * Command line options:
 *    -info      print GL implementation information
 *
 */



var view_rotx = 20.0, view_roty = 30.0, view_rotz = 0.0;
var gear1, gear2, gear3;
var angle = 0.0;
var M_PI = Math.PI;
var sin = Math.sin;
var cos = Math.cos;
var sqrt = Math.sqrt;

/*
 *
 *  Draw a gear wheel.  You'll probably want to call this function when
 *  building a display list since we do a lot of trig here.
 *
 *  Input:  inner_radius - radius of hole at center
 *          outer_radius - radius at center of teeth
 *          width - width of gear
 *          teeth - number of teeth
 *          tooth_depth - depth of tooth
 */

function gear(gl, inner_radius, outer_radius, width, teeth, tooth_depth)
{
   var i;
   var r0, r1, r2;
   var angle, da;
   var u, v, len;

   r0 = inner_radius;
   r1 = outer_radius - tooth_depth / 2.0;
   r2 = outer_radius + tooth_depth / 2.0;

   da = 2.0 * M_PI / teeth / 4.0;

   gl.ShadeModel(gl.FLAT);
   gl.Normal3f(0.0, 0.0, 1.0);

   /* draw front face */
   gl.Begin(gl.QUAD_STRIP);
   for (i = 0; i <= teeth; i++) {
      angle = i * 2.0 * M_PI / teeth;
      gl.Vertex3f(r0 * cos(angle), r0 * sin(angle), width * 0.5);
      gl.Vertex3f(r1 * cos(angle), r1 * sin(angle), width * 0.5);
      if (i < teeth) {
        gl.Vertex3f(r0 * cos(angle), r0 * sin(angle), width * 0.5);
        gl.Vertex3f(r1 * cos(angle + 3 * da), r1 * sin(angle + 3 * da),
        width * 0.5);
      }
   }
   gl.End();

   /* draw front sides of teeth */
   gl.Begin(gl.QUADS);
   da = 2.0 * M_PI / teeth / 4.0;
   for (i = 0; i < teeth; i++) {
      angle = i * 2.0 * M_PI / teeth;

      gl.Vertex3f(r1 * cos(angle), r1 * sin(angle), width * 0.5);
      gl.Vertex3f(r2 * cos(angle + da), r2 * sin(angle + da), width * 0.5);
      gl.Vertex3f(r2 * cos(angle + 2 * da), r2 * sin(angle + 2 * da),
     width * 0.5);
      gl.Vertex3f(r1 * cos(angle + 3 * da), r1 * sin(angle + 3 * da),
     width * 0.5);
   }
   gl.End();

   gl.Normal3f(0.0, 0.0, -1.0);

   /* draw back face */
   gl.Begin(gl.QUAD_STRIP);
   for (i = 0; i <= teeth; i++) {
      angle = i * 2.0 * M_PI / teeth;
      gl.Vertex3f(r1 * cos(angle), r1 * sin(angle), -width * 0.5);
      gl.Vertex3f(r0 * cos(angle), r0 * sin(angle), -width * 0.5);
      if (i < teeth) {
         gl.Vertex3f(r1 * cos(angle + 3 * da), r1 * sin(angle + 3 * da),
        -width * 0.5);
         gl.Vertex3f(r0 * cos(angle), r0 * sin(angle), -width * 0.5);
      }
   }
   gl.End();

   /* draw back sides of teeth */
   gl.Begin(gl.QUADS);
   da = 2.0 * M_PI / teeth / 4.0;
   for (i = 0; i < teeth; i++) {
      angle = i * 2.0 * M_PI / teeth;

      gl.Vertex3f(r1 * cos(angle + 3 * da), r1 * sin(angle + 3 * da),
     -width * 0.5);
      gl.Vertex3f(r2 * cos(angle + 2 * da), r2 * sin(angle + 2 * da),
     -width * 0.5);
      gl.Vertex3f(r2 * cos(angle + da), r2 * sin(angle + da), -width * 0.5);
      gl.Vertex3f(r1 * cos(angle), r1 * sin(angle), -width * 0.5);
   }
   gl.End();

   /* draw outward faces of teeth */
   gl.Begin(gl.QUAD_STRIP);
   for (i = 0; i < teeth; i++) {
      angle = i * 2.0 * M_PI / teeth;

      gl.Vertex3f(r1 * cos(angle), r1 * sin(angle), width * 0.5);
      gl.Vertex3f(r1 * cos(angle), r1 * sin(angle), -width * 0.5);
      u = r2 * cos(angle + da) - r1 * cos(angle);
      v = r2 * sin(angle + da) - r1 * sin(angle);
      len = sqrt(u * u + v * v);
      u /= len;
      v /= len;
      gl.Normal3f(v, -u, 0.0);
      gl.Vertex3f(r2 * cos(angle + da), r2 * sin(angle + da), width * 0.5);
      gl.Vertex3f(r2 * cos(angle + da), r2 * sin(angle + da), -width * 0.5);
      gl.Normal3f(cos(angle), sin(angle), 0.0);
      gl.Vertex3f(r2 * cos(angle + 2 * da), r2 * sin(angle + 2 * da),
     width * 0.5);
      gl.Vertex3f(r2 * cos(angle + 2 * da), r2 * sin(angle + 2 * da),
     -width * 0.5);
      u = r1 * cos(angle + 3 * da) - r2 * cos(angle + 2 * da);
      v = r1 * sin(angle + 3 * da) - r2 * sin(angle + 2 * da);
      gl.Normal3f(v, -u, 0.0);
      gl.Vertex3f(r1 * cos(angle + 3 * da), r1 * sin(angle + 3 * da),
     width * 0.5);
      gl.Vertex3f(r1 * cos(angle + 3 * da), r1 * sin(angle + 3 * da),
     -width * 0.5);
      gl.Normal3f(cos(angle), sin(angle), 0.0);
   }

   gl.Vertex3f(r1 * cos(0), r1 * sin(0), width * 0.5);
   gl.Vertex3f(r1 * cos(0), r1 * sin(0), -width * 0.5);

   gl.End();

   gl.ShadeModel(gl.SMOOTH);

   /* draw inside radius cylinder */
   gl.Begin(gl.QUAD_STRIP);
   for (i = 0; i <= teeth; i++) {
      angle = i * 2.0 * M_PI / teeth;
      gl.Normal3f(-cos(angle), -sin(angle), 0.0);
      gl.Vertex3f(r0 * cos(angle), r0 * sin(angle), -width * 0.5);
      gl.Vertex3f(r0 * cos(angle), r0 * sin(angle), width * 0.5);
   }
   gl.End();
}


function draw(gl)
{
   gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

   gl.PushMatrix();
   gl.Rotatef(view_rotx, 1.0, 0.0, 0.0);
   gl.Rotatef(view_roty, 0.0, 1.0, 0.0);
   gl.Rotatef(view_rotz, 0.0, 0.0, 1.0);

   gl.PushMatrix();
   gl.Translatef(-3.0, -2.0, 0.0);
   gl.Rotatef(angle, 0.0, 0.0, 1.0);
   gl.CallList(gear1);
   gl.PopMatrix();

   gl.PushMatrix();
   gl.Translatef(3.1, -2.0, 0.0);
   gl.Rotatef(-2.0 * angle - 9.0, 0.0, 0.0, 1.0);
   gl.CallList(gear2);
   gl.PopMatrix();

   gl.PushMatrix();
   gl.Translatef(-3.1, 4.2, 0.0);
   gl.Rotatef(-2.0 * angle - 25.0, 0.0, 0.0, 1.0);
   gl.CallList(gear3);
   gl.PopMatrix();
   gl.PopMatrix();
}


/* new window size or exposure */
function reshape(gl, width, height)
{
   var h = height / width;
   gl.Viewport(0, 0, width, height);
   gl.MatrixMode(gl.PROJECTION);
   gl.LoadIdentity();
   gl.Frustum(-1.0, 1.0, -h, h, 5.0, 60.0);
   gl.MatrixMode(gl.MODELVIEW);
   gl.LoadIdentity();
   gl.Translatef(0.0, 0.0, -40.0);
   gl.Scalef(0.1, 0.1, 0.1);
}


function init(gl, done)
{
   var pos = [5.0, 5.0, 10.0, 0.0]
   var red = [ 0.8, 0.1, 0.0, 1.0 ];
   var green = [ 0.0, 0.8, 0.2, 1.0 ];
   var blue = [ 0.2, 0.2, 1.0, 1.0 ];

   gl.Lightfv(gl.LIGHT0, gl.POSITION, pos);
   gl.Enable(gl.CULL_FACE);
   gl.Enable(gl.LIGHTING);
   gl.Enable(gl.LIGHT0);
   gl.Enable(gl.DEPTH_TEST);

   /* make the gears */
   gl.GenLists(3, function(err, startIndex) {
       if (err)
       {
           console.log(err);
           return;
       }
       gear1 = startIndex;
       gl.NewList(gear1, gl.COMPILE);
       gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, red);
       gear(gl, 1.0, 4.0, 1.0, 20, 0.7);
       gl.EndList();

       gear2 = startIndex + 1;
       gl.NewList(gear2, gl.COMPILE);
       gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, green);
       gear(gl, 0.5, 2.0, 2.0, 10, 0.7);
       gl.EndList();

       gear3 = startIndex + 2;
       gl.NewList(gear3, gl.COMPILE);
       gl.Materialfv(gl.FRONT, gl.AMBIENT_AND_DIFFUSE, blue);
       gear(gl, 1.3, 2.0, 0.5, 10, 0.7);
       gl.EndList();
       gl.Enable(gl.NORMALIZE);
       done();
   });
}

var x11 = require('../../lib');
//var eventmask = x11.eventMask.PointerMotion|x11.eventMask.PointerMotionHint|x11.eventMask.ButtonPress|x11.eventMask.ButtonRelease|x11.eventMask.StructureNotify|x11.eventMask.Exposure;
var eventmask = x11.eventMask.PointerMotion;
//var eventmask = x11.eventMask.PointerMotion|x11.eventMask.ButtonPress|x11.eventMask.ButtonRelease|x11.eventMask.StructureNotify|x11.eventMask.Exposure;
var exec = require('child_process').exec;

function findBestVisual(display, done) {
    exec('glxinfo -i -b', function(error, stdout, stderr) {
        console.log(stdout);
        if (error)
            return done(error);
        done(null, parseInt(stdout)+1);
        //done(null, 0xb1);
    })
}


x11.createClient(function(error, display) {
    var X = display.client;
    var root = display.screen[0].root;
    var width = 500;
    var height = 500;
    X.require('glx', function(err, GLX) {
        var depth = 24;
        findBestVisual(display, function(err, visual) {

        /*
        var visual = 147;
        var rgbaVisuals = Object.keys(display.screen[0].depths[depth]);
        for (v in rgbaVisuals)
        {
           var vid = rgbaVisuals[v];
           var visualClass = display.screen[0].depths[depth][vid].class;
           if (visualClass == 4 || visualClass == 5)
           {
              visual = vid;
              break;
           }
        }
        */

        var cmid = X.AllocID();
        X.CreateColormap(cmid, root, visual, 0);
        var win = X.AllocID();
        console.log(eventmask);
        X.CreateWindow(win, root, 0, 0, width, height, 0, depth, 0, visual, { eventMask: eventmask, colormap: cmid, backgroundPixel: 0, borderPixel: 0 });
        X.MapWindow(win);

        var ctx = X.AllocID();
        GLX.CreateContext(ctx, visual, 0, 0, 0);
        GLX.MakeCurrent(win, ctx, 0, function() {});
        var gl = GLX.renderPipeline(ctx);

        var initialized = false;
        init(gl, function() {
          initialized = true;
          setInterval(function() {
              angle += 2;
              reshape(gl, width, height);
              draw(gl);
              gl.SwapBuffers(win);
          }, 50);
        });

        X.on('event', function(ev) {
           console.log(ev);
           switch(ev.type) {
           case 22:
              reshape(gl, ev.width, ev.height);
              width = ev.width;
              height = ev.height;
              break;
           case 6:
              X.QueryPointer(win, function(err, pointer) {
                view_rotx = pointer.childX;
                view_roty = pointer.childY;
                reshape(gl, width, height);
                if (initialized)
                  draw(gl);
                gl.SwapBuffers(win);
              });
              return;
           }
           reshape(gl, width, height);
           if (initialized)
              draw(gl);
           gl.SwapBuffers(win);
        });

 }); // findBestVisual

    });
    X.on('error', function(err) { console.log(err); });
});
;
