const x11 = require('../../../lib');
const keysym = require('keysym');


const ks = x11.keySyms;
const ks2Name = {};
for (const key in ks)
    ks2Name[ ks[key].code ] = key;
const kk2Name = {};

x11.createClient((err, display) => {
    const X = display.client;
    const min = display.min_keycode;
    const max = display.max_keycode;
    X.GetKeyboardMapping(min, max-min, (err, list) => {
	for (let i=0; i < list.length; ++i)
        {
            const name = kk2Name[i+min] = [];
            const sublist = list[i];
            for (let j =0; j < sublist.length; ++j)
		name.push([ks2Name[sublist[j]], sublist[j]]);
        }

        const root = display.screen[0].root;
        const wid = X.AllocID();
        const white = display.screen[0].white_pixel;
        const black = display.screen[0].black_pixel;
        X.CreateWindow(wid, root, 10, 10, 400, 300, 0, 0, 0, 0, { backgroundPixel: white, eventMask: x11.eventMask.KeyPress});
        X.MapWindow(wid);

        X.on('event', ev => {
            console.log(ev.type);
            console.log(ev);
            //console.log([ev.keycode, kk2Name[ev.keycode], keysym.fromKeysym(kk2Name[ev.keycode][0][1])]);
            const shift = ev.buttons & 1;
            const keySyms = kk2Name[ev.keycode];
            if (keySyms) {
              let codePoint = keysym.fromKeysym(keySyms[shift ? 1 : 0][1]).unicode;
              if (codePoint == 13)
                codePoint = 10;
              if (codePoint != 0)
                process.stdout.write(String.fromCharCode(codePoint));
               //console.log('\n', codePoint);
            }
        });
    });
});
