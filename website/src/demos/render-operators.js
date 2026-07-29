export default {
  id: 'render-operators',
  title: 'RENDER: Porter-Duff operators',
  description:
    'All fourteen compositing operators side by side. Each cell composites the same translucent source over the same translucent destination, changing only the operator.',
  screenWidth: 640,
  screenHeight: 460,
  code: `const x11 = require('x11');

// The compositing operators only differ from one another when BOTH sides
// carry alpha, so each cell is built up in its own depth-32 pixmap and then
// laid over a checkerboard — the checks are what make the transparency the
// operators produce visible at all.

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  X.require('render', (err2, render) => {
    if (err2) throw err2;

    const wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 0, 0, 640, 460, 0, 0, 0, 0, {
      backgroundPixel: 0x1b1f24,
      eventMask: x11.eventMask.Exposure
    });
    X.MapWindow(wid);

    const gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x1b1f24 });

    const dstPicture = X.AllocID();
    render.CreatePicture(dstPicture, wid, render.rgb24);

    // one scratch pixmap reused for every cell
    const CELL_W = 112, CELL_H = 86;
    const pixmap = X.AllocID();
    X.CreatePixmap(pixmap, wid, 32, CELL_W, CELL_H);
    const cell = X.AllocID();
    render.CreatePicture(cell, pixmap, render.rgba32);

    const ops = [
      'Clear', 'Src', 'Dst', 'Over', 'OverReverse',
      'In', 'InReverse', 'Out', 'OutReverse', 'Atop',
      'AtopReverse', 'Xor', 'Add', 'Saturate'
    ];

    // destination shape: a cyan square on the left
    // source shape:      a magenta square on the right, overlapping
    const DST_RECT = [8, 14, 58, 58];
    const SRC_RECT = [40, 30, 58, 58];
    const DST_COLOR = [0.15, 0.68, 0.78, 0.75];
    const SRC_COLOR = [0.85, 0.24, 0.55, 0.6];

    function checkerboard(x, y, w, h) {
      // 8px checks, drawn with the core protocol rather than RENDER
      X.ChangeGC(gc, { foreground: 0x2c333c });
      X.PolyFillRectangle(wid, gc, [x, y, w, h]);
      X.ChangeGC(gc, { foreground: 0x394450 });
      const squares = [];
      for (let cy = 0; cy < h; cy += 8)
        for (let cx = ((cy / 8) % 2) * 8; cx < w; cx += 16)
          squares.push(x + cx, y + cy, Math.min(8, w - cx), Math.min(8, h - cy));
      X.PolyFillRectangle(wid, gc, squares);
    }

    function drawCell(name, col, row) {
      const x = 12 + col * (CELL_W + 12);
      const y = 30 + row * (CELL_H + 34);

      // Build the composite off-screen: clear to fully transparent, lay down
      // the destination, then apply the operator with the source.
      render.FillRectangles(render.PictOp.Clear, cell, [0, 0, 0, 0],
        [0, 0, CELL_W, CELL_H]);
      render.FillRectangles(render.PictOp.Src, cell, DST_COLOR, DST_RECT);
      render.FillRectangles(render.PictOp[name], cell, SRC_COLOR, SRC_RECT);

      checkerboard(x, y, CELL_W, CELL_H);
      render.Composite(render.PictOp.Over, cell, 0, dstPicture,
        0, 0, 0, 0, x, y, CELL_W, CELL_H);

      X.ChangeGC(gc, { foreground: 0xdfe4ea });
      X.ImageText8(wid, gc, x + 2, y + CELL_H + 14, name);
    }

    X.on('event', ev => {
      if (ev.name !== 'Expose') return;
      X.ChangeGC(gc, { foreground: 0xdfe4ea });
      X.ImageText8(wid, gc, 12, 18,
        'cyan = destination, magenta = source, checks = transparent');
      ops.forEach((name, i) => drawCell(name, i % 5, Math.floor(i / 5)));
      console.log(ops.length + ' operators composited');
    });

    X.on('error', e => console.error(e));
  });
});
`,
};
