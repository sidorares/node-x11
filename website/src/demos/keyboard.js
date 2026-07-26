export default {
  id: 'keyboard',
  title: 'Keyboard',
  description: 'KeyPress events decoded through GetKeyboardMapping and echoed with ImageText8.',
  code: `const x11 = require('x11');

x11.createClient((err, display) => {
  if (err) throw err;
  const X = display.client;
  const screen = display.screen[0];

  const wid = X.AllocID();
  X.CreateWindow(wid, screen.root, 40, 40, 520, 200, 0, 0, 0, 0, {
    backgroundPixel: screen.white_pixel,
    eventMask: x11.eventMask.Exposure | x11.eventMask.KeyPress
  });
  X.MapWindow(wid);

  const gc = X.AllocID();
  X.CreateGC(gc, wid, { foreground: 0x222222, background: screen.white_pixel });

  const min = display.min_keycode;
  const count = display.max_keycode - min + 1;
  let typed = '';

  X.GetKeyboardMapping(min, count, (err, keymap) => {
    if (err) throw err;

    X.on('event', ev => {
      if (ev.name === 'Expose') {
        X.ImageText8(wid, gc, 16, 32, 'click the screen, then type:');
        X.ImageText8(wid, gc, 16, 80, typed.length ? typed : ' ');
        return;
      }
      if (ev.name !== 'KeyPress') return;

      const syms = keymap[ev.keycode - min] || [];
      const shifted = (ev.buttons & 1) !== 0; // ShiftMask in the state field
      const keysym = (shifted && syms[1]) ? syms[1] : (syms[0] || 0);

      if (keysym >= 0x20 && keysym <= 0x7e) {
        typed += String.fromCharCode(keysym);
        if (typed.length > 60) typed = typed.slice(-60);
      } else if (keysym === 0xff08) { // BackSpace
        typed = typed.slice(0, -1);
      } else if (keysym === 0xff0d) { // Return
        console.log('you typed: ' + typed);
        typed = '';
      }

      X.ClearArea(wid, 0, 56, 520, 40, 0);
      X.ImageText8(wid, gc, 16, 80, typed.length ? typed : ' ');
    });
  });
});
`,
};
