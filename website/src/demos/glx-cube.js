export default {
  id: 'glx-cube',
  title: 'OpenGL spinning cube (GLX)',
  description: 'Animated, lit, depth-tested cube: fixed-function GL 1.x over the GLX wire protocol.',
  requiresWebGL: true,
  code: `// Animated indirect GLX: lighting, depth test and per-frame SwapBuffers.
const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const root = display.screen[0].root;
  const width = 420, height = 420;

  X.require('glx', (err, GLX) => {
    if (err) throw err;
    GLX.GetVisualConfigs(0, (err, configs) => {
      if (err) throw err;
      const cfg = configs.find(c => c.rgbMode && c.doubleBufferMode);
      if (!cfg) throw new Error('no double-buffered RGBA GL visual');

      const cmid = X.AllocID();
      X.CreateColormap(cmid, root, cfg.visualID, 0);
      const win = X.AllocID();
      X.CreateWindow(win, root, 110, 20, width, height, 0, 24, 1, cfg.visualID, {
        colormap: cmid, backgroundPixel: 0, borderPixel: 0,
        eventMask: x11.eventMask.StructureNotify
      });
      X.MapWindow(win);

      let started = false;
      X.on('event', ev => {
        if (ev.name !== 'MapNotify' || started) return;
        started = true;
        setTimeout(start, 100);
      });

      // faces: [normal, 4 corners]
      const faces = [
        [[0, 0, 1],  [-1,-1, 1], [ 1,-1, 1], [ 1, 1, 1], [-1, 1, 1]],
        [[0, 0,-1],  [-1,-1,-1], [-1, 1,-1], [ 1, 1,-1], [ 1,-1,-1]],
        [[0, 1, 0],  [-1, 1,-1], [-1, 1, 1], [ 1, 1, 1], [ 1, 1,-1]],
        [[0,-1, 0],  [-1,-1,-1], [ 1,-1,-1], [ 1,-1, 1], [-1,-1, 1]],
        [[1, 0, 0],  [ 1,-1,-1], [ 1, 1,-1], [ 1, 1, 1], [ 1,-1, 1]],
        [[-1, 0, 0], [-1,-1,-1], [-1,-1, 1], [-1, 1, 1], [-1, 1,-1]]
      ];
      const colors = [
        [0.9, 0.2, 0.2], [0.2, 0.9, 0.2], [0.2, 0.4, 0.9],
        [0.9, 0.8, 0.2], [0.8, 0.3, 0.9], [0.2, 0.9, 0.9]
      ];

      function start() {
        const ctx = X.AllocID();
        GLX.CreateContext(ctx, cfg.visualID, 0, 0, 0);
        GLX.MakeCurrent(win, ctx, 0, (err, tag) => {
          if (err) throw err;
          const gl = GLX.renderPipeline(tag);
          gl.Viewport(0, 0, width, height);
          gl.MatrixMode(gl.PROJECTION);
          gl.LoadIdentity();
          gl.Frustum(-1, 1, -1, 1, 2, 20);
          gl.MatrixMode(gl.MODELVIEW);
          gl.Enable(gl.DEPTH_TEST);
          gl.Enable(gl.LIGHTING);
          gl.Enable(gl.LIGHT0);
          gl.Enable(gl.COLOR_MATERIAL);
          gl.Lightfv(gl.LIGHT0, gl.POSITION, 2, 4, 6, 0);
          gl.ClearColor(0.08, 0.08, 0.12, 1);

          let angle = 0;
          setInterval(() => {
            angle += 2;
            gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.LoadIdentity();
            gl.Translatef(0, 0, -6);
            gl.Rotatef(angle, 0.8, 1, 0.3);
            gl.Begin(gl.QUADS);
            faces.forEach((f, i) => {
              gl.Color3f(colors[i][0], colors[i][1], colors[i][2]);
              gl.Normal3f(f[0][0], f[0][1], f[0][2]);
              for (let v = 1; v <= 4; v++)
                gl.Vertex3f(f[v][0], f[v][1], f[v][2]);
            });
            gl.End();
            gl.Render();
            gl.SwapBuffers(win);
          }, 33);
        });
      }
    });
  });
});
`,
};
