export default {
  id: 'render-transform',
  title: 'RENDER: transforms & filters',
  description:
    'SetPictureTransform rotating and scaling a source picture, with nearest-neighbour beside bilinear so the filter difference is visible.',
  screenWidth: 640,
  screenHeight: 360,
  code: `const x11 = require('x11');

// A picture transform is a 3x3 matrix mapping DESTINATION coordinates back
// to source coordinates — the inverse of the way you would write it for a
// canvas. Nothing is re-uploaded per frame: the client sends nine numbers
// and the server resamples.

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  X.require('render', (err2, render) => {
    if (err2) throw err2;

    const wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 0, 0, 640, 360, 0, 0, 0, 0, {
      backgroundPixel: 0x0e1116,
      eventMask: x11.eventMask.Exposure
    });
    X.MapWindow(wid);

    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x0e1116 });

    const dst = X.AllocID();
    render.CreatePicture(dst, wid, render.rgb24);

    // A small, deliberately chunky source so resampling is easy to see.
    const SRC = 32;
    const pixmap = X.AllocID();
    X.CreatePixmap(pixmap, wid, 32, SRC, SRC);
    const src = X.AllocID();
    render.CreatePicture(src, pixmap, render.rgba32);

    render.FillRectangles(render.PictOp.Src, src, [0.10, 0.13, 0.17, 1],
      [0, 0, SRC, SRC]);
    // four quadrants plus a diagonal, so rotation and filtering both show
    render.FillRectangles(render.PictOp.Src, src, [0.95, 0.35, 0.21, 1], [0, 0, 16, 16]);
    render.FillRectangles(render.PictOp.Src, src, [0.18, 0.72, 0.85, 1], [16, 16, 16, 16]);
    render.FillRectangles(render.PictOp.Src, src, [0.99, 0.85, 0.25, 1], [16, 0, 16, 16]);
    render.FillRectangles(render.PictOp.Src, src, [0.35, 0.78, 0.45, 1], [0, 16, 16, 16]);
    const diagonal = [];
    for (let i = 0; i < SRC; i++) diagonal.push(i, i, 2, 2);
    render.FillRectangles(render.PictOp.Src, src, [1, 1, 1, 1], diagonal);

    // Two copies of the same pixmap, differing only in resampling filter.
    const nearest = X.AllocID();
    render.CreatePicture(nearest, pixmap, render.rgba32);
    render.SetPictureFilter(nearest, 'nearest', []);
    const bilinear = X.AllocID();
    render.CreatePicture(bilinear, pixmap, render.rgba32);
    render.SetPictureFilter(bilinear, 'bilinear', []);

    const SIZE = 160;
    const SCALE = SRC / SIZE;   // dest → src, so >1 shrinks the source

    function rotationAbout(angle, cx, cy) {
      const c = Math.cos(angle), s = Math.sin(angle);
      // translate to centre, rotate, scale, translate back — expressed in
      // destination space because that is the direction RENDER samples in
      return [
        c * SCALE, -s * SCALE, (cx - c * cx + s * cy) * SCALE,
        s * SCALE, c * SCALE, (cy - s * cx - c * cy) * SCALE,
        0, 0, 1
      ];
    }

    let angle = 0;
    let painted = false;

    function frame() {
      if (!painted) return;
      const m = rotationAbout(angle, SIZE / 2, SIZE / 2);
      render.SetPictureTransform(nearest, m);
      render.SetPictureTransform(bilinear, m);
      render.Composite(render.PictOp.Src, nearest, 0, dst,
        0, 0, 0, 0, 90, 70, SIZE, SIZE);
      render.Composite(render.PictOp.Src, bilinear, 0, dst,
        0, 0, 0, 0, 390, 70, SIZE, SIZE);
      angle += 0.03;
    }

    X.on('event', ev => {
      if (ev.name !== 'Expose') return;
      X.ChangeGC(gc, { foreground: 0xdfe4ea });
      X.ImageText8(wid, gc, 20, 30,
        'the same 32x32 pixmap, scaled 5x and rotating: 9 numbers per frame');
      X.ImageText8(wid, gc, 90, 260, "filter 'nearest'");
      X.ImageText8(wid, gc, 390, 260, "filter 'bilinear'");
      painted = true;
      console.log('source is ' + SRC + 'x' + SRC + ', drawn at ' + SIZE + 'x' + SIZE);
    });

    setInterval(frame, 40);
    X.on('error', e => console.error(e));
  });
});
`,
};
