export default {
  id: 'clip-rects',
  title: 'Clipping',
  description:
    'SetClipRectangles turns a GC into a stencil: the same fill request, sent twice, produces completely different ink.',
  screenWidth: 640,
  screenHeight: 340,
  code: `const x11 = require('x11');

// The clip list lives on the GC, not on the request. So a "shape" in core X11
// is often not a shape at all — it is a rectangle list installed as a clip,
// with something ordinary drawn through it.

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const W = 640, H = 340;

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 0, 0, W, H, 0, 0, 0, 0, {
    backgroundPixel: 0x0f1216,
    eventMask: x11.eventMask.Exposure
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0xdfe4ea, background: 0x0f1216 });

  // A second GC carrying the clip, so the unclipped one stays available.
  const clipped = X.AllocID();
  X.CreateGC(clipped, wid, { foreground: 0x4fc3f7 });

  let phase = 0;

  // A ring of rectangles approximating a circle — the clip list is unsorted
  // (ordering 0), which is the only ordering that needs no care about
  // overlap.
  function discClip(cx, cy, r) {
    const rects = [];
    for (let y = -r; y < r; y += 2) {
      const half = Math.round(Math.sqrt(r * r - y * y));
      if (half > 0) rects.push(cx - half, cy + y, half * 2, 2);
    }
    return rects;
  }

  // "CLIP", built out of bars rather than drawn as text: the letters are the
  // clip list, and the fill below is what makes them visible.
  function textClip(x, y) {
    const letters = {
      C: [[0, 0, 10, 64], [0, 0, 30, 10], [0, 54, 30, 10]],
      L: [[0, 0, 10, 64], [0, 54, 30, 10]],
      I: [[10, 0, 10, 64], [0, 0, 30, 10], [0, 54, 30, 10]],
      P: [[0, 0, 10, 64], [0, 0, 30, 10], [20, 0, 10, 37], [0, 27, 30, 10]]
    };
    const rects = [];
    'CLIP'.split('').forEach((ch, i) => {
      for (const [bx, by, bw, bh] of letters[ch])
        rects.push(x + i * 42 + bx, y + by, bw, bh);
    });
    return rects;
  }

  function paint() {
    X.ChangeGC(gc, { foreground: 0x0f1216 });
    X.PolyFillRectangle(wid, gc, [0, 0, W, H]);

    X.ChangeGC(gc, { foreground: 0xdfe4ea });
    X.ImageText8(wid, gc, 20, 28,
      'one PolyFillRectangle covering the whole panel, three different clips');

    const panels = [
      { x: 20, label: 'no clip', rects: null },
      { x: 230, label: 'disc clip', rects: discClip(100, 105, 78) },
      { x: 440, label: 'glyph clip', rects: textClip(18, 68) }
    ];

    for (const panel of panels) {
      X.ChangeGC(gc, { foreground: 0x1a2028 });
      X.PolyFillRectangle(wid, gc, [panel.x, 50, 180, 190]);

      if (panel.rects) {
        // clip origins are relative to the drawable, so shift the list into
        // the panel by setting the origin rather than by moving every rect
        X.SetClipRectangles(clipped, 0, panel.x, 50, panel.rects);
      } else {
        // an empty list would clip everything away; None restores "no clip"
        X.ChangeGC(clipped, { clipMask: 0 });
      }

      // the identical request every time — only the GC changed
      const hue = (phase + panels.indexOf(panel) * 40) % 360;
      X.ChangeGC(clipped, { foreground: hsv(hue) });
      X.PolyFillRectangle(wid, clipped, [panel.x, 50, 180, 190]);

      X.ChangeGC(gc, { foreground: 0x8892a0 });
      X.ImageText8(wid, gc, panel.x, 262, panel.label);
    }
  }

  function hsv(h) {
    const f = (n) => {
      const k = (n + h / 60) % 6;
      const v = 0.55 + 0.45 * Math.max(0, Math.min(1, Math.min(k, 4 - k, 1)));
      return Math.round(v * 255);
    };
    return (f(5) << 16) | (f(3) << 8) | f(1);
  }

  X.on('event', ev => {
    if (ev.name !== 'Expose') return;
    paint();
    console.log('clip lists are GC state — ' + discClip(100, 105, 78).length / 4 +
      ' rects in the disc');
  });

  setInterval(() => { phase = (phase + 6) % 360; paint(); }, 90);
  X.on('error', e => console.error(e));
});
`,
};
