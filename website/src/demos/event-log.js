export default {
  id: 'event-log',
  title: 'Event log',
  description: 'Select a broad event mask and print every event the server delivers to the console.',
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 20, 20, 560, 400, 0, 0, 0, 0, {
    backgroundPixel: 0xe8ecf0,
    eventMask: x11.eventMask.Exposure |
               x11.eventMask.ButtonPress |
               x11.eventMask.ButtonRelease |
               x11.eventMask.PointerMotion |
               x11.eventMask.EnterWindow |
               x11.eventMask.LeaveWindow |
               x11.eventMask.KeyPress |
               x11.eventMask.KeyRelease |
               x11.eventMask.StructureNotify
  });
  X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'event log');
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0x333333, background: 0xe8ecf0 });

  X.on('event', ev => {
    if (ev.name === 'Expose') {
      X.ImageText8(wid, gc, 16, 28, 'move / click / type here,');
      X.ImageText8(wid, gc, 16, 52, 'watch the console below the editor');
      return;
    }
    if (ev.name === 'MotionNotify') {
      // motion is noisy: log coordinates only
      console.log('MotionNotify x=' + ev.x + ' y=' + ev.y);
      return;
    }
    console.log(ev.name + ' ' + JSON.stringify(ev));
  });
});
`,
};
