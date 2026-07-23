const x11 = require('..');

// The list provided by GetKeyboardMapping has sublists where each position
// represents the result for some key composition.
keyComposition = [
  'Key',
  'shift + Key',
  'modeSwitch + Key',
  'modeSwitch + shift + Key',
  'altGr + Key',
  'altGr + shift + Key'
]

x11.createClient((err, display) => {
  if (err) throw err

  const // TODO: explain min_keycode
        min = display.min_keycode,
        // TODO: explain max_keycode
        max = display.max_keycode,
        // allow us to find a char by the charcode
        chr2Data = [],
        key2Data = [];              // associate chars to a keycode

  // The keySyms is a hash of mnemonic char names, associated to an integer
  // charcode and its description.
  for (codeName in x11.keySyms) {
    keyData = x11.keySyms[codeName];
    chr2Data[keyData.code] = { codeName, description: keyData.description };
  }

  const X = display.client,
        // Get a free integer id to a new window.
        wid = X.AllocID(),
        // The mother window. Like your window manager.
        root = display.screen[0].root,
        // Allow to filter for KeyPress events.
        evKeyPress = x11.eventMask.KeyPress,
        white = display.screen[0].white_pixel; // Will paint the window.

  // Get the local key mapping to build key2Data.
  X.GetKeyboardMapping(min, max-min, (err, list) => {
    for (let i=0; i < list.length; ++i) {
      const name = key2Data[i+min] = [];
      const sublist = list[i];
      for (let j=0; j < sublist.length; ++j)
        name.push(chr2Data[sublist[j]]);
    }
  });

  // Launch a window to listen by key events:
  X.CreateWindow(wid, root, 0, 0, 100, 100, 0, 0, 0, 0, { backgroundPixel: white, eventMask: evKeyPress });
  X.MapWindow(wid);

  X.on('event', ev => {
    if (ev.type == 2) {  // filter by KeyPress. Useful if you have a more open eventMask.
      const key = key2Data[ev.keycode];  // key is a list of chars related to the pressed key.
      if (key) {
        console.log('\n>> key pressed:', ev.keycode);
        for (let i=0; i<key.length; i++) // Describe each related char
          if (key[i])
            console.log(
              key[i].codeName, '\t', (
                key[i].description ? key[i].description : 'no description'
              ), (
                keyComposition[i] ? `\t${keyComposition[i]}` : ''
              )
            );
      }
      else
        console.log(`>> keyCode ${ev.keycode} was not recognized.`);
    }
  });

});
