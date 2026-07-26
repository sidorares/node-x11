export default {
  id: 'glx-triangle',
  title: 'OpenGL triangle (GLX)',
  description: 'Indirect GLX rendering: the classic RGB triangle, drawn through the X protocol onto WebGL.',
  requiresWebGL: true,
  code: `// The same code as examples/opengl/triangle.js in the repo: indirect GLX.
// In the browser the GLX protocol is executed on WebGL.
const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const root = display.screen[0].root;
  const width = 400, height = 400;

  X.require('glx', (err, GLX) => {
    if (err) throw err;
    GLX.GetVisualConfigs(0, (err, configs) => {
      if (err) throw err;
      const cfg = configs.find(c => c.rgbMode && c.doubleBufferMode);
      if (!cfg) throw new Error('no double-buffered RGBA GL visual');

      let depth = 24;
      const depths = display.screen[0].depths;
      for (const d in depths)
        if (Object.keys(depths[d]).indexOf(String(cfg.visualID)) !== -1)
          depth = parseInt(d);

      const cmid = X.AllocID();
      X.CreateColormap(cmid, root, cfg.visualID, 0);
      const win = X.AllocID();
      X.CreateWindow(win, root, 100, 20, width, height, 0, depth, 1, cfg.visualID, {
        colormap: cmid, backgroundPixel: 0, borderPixel: 0,
        eventMask: x11.eventMask.StructureNotify | x11.eventMask.Exposure
      });
      X.MapWindow(win);

      let started = false;
      X.on('event', ev => {
        if (ev.name !== 'MapNotify' || started) return;
        started = true;
        setTimeout(draw, 100);
      });

      function draw() {
        const ctx = X.AllocID();
        GLX.CreateContext(ctx, cfg.visualID, 0, 0, 0);
        GLX.MakeCurrent(win, ctx, 0, (err, tag) => {
          if (err) throw err;
          const gl = GLX.renderPipeline(tag);
          gl.Viewport(0, 0, width, height);
          gl.MatrixMode(gl.PROJECTION);
          gl.LoadIdentity();
          gl.Ortho(-1, 1, -1, 1, -1, 1);
          gl.MatrixMode(gl.MODELVIEW);
          gl.LoadIdentity();
          gl.ClearColor(0.2, 0.2, 0.2, 1);
          gl.Clear(gl.COLOR_BUFFER_BIT);
          gl.Begin(gl.TRIANGLES);
          gl.Color3f(1, 0, 0);
          gl.Vertex3f(0, 0.8, 0);
          gl.Color3f(0, 1, 0);
          gl.Vertex3f(-0.8, -0.8, 0);
          gl.Color3f(0, 0, 1);
          gl.Vertex3f(0.8, -0.8, 0);
          gl.End();
          gl.Render();
          gl.SwapBuffers(win);
          console.log('triangle drawn through GLX -> WebGL');
        });
      }
    });
  });
});
`,
};
