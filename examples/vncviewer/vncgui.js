"use strict";

const rfb = require('./rfbclient');
const x11 = require('../../lib');

// TODO: use optimist for args parsing
let host = process.argv[2];
let port = process.argv[3];
const password = process.argv[4];
if (!host)
    host = '127.0.0.1';
if (!port)
    port = 5900;

const opts = {};
opts.host = host;
opts.port = port;
opts.password = password;
opts.rfbfile = process.argv[5];
//opts.rfbFileOut = process.argv[5];




const Exposure = x11.eventMask.Exposure;
const PointerMotion = x11.eventMask.PointerMotion;
const ButtonPress = x11.eventMask.ButtonPress;
const ButtonRelease = x11.eventMask.ButtonRelease;
const KeyPress = x11.eventMask.KeyPress;
const KeyRelease = x11.eventMask.KeyRelease;

x11.createClient((err, display) => {
    const X = display.client;
    X.require('big-requests', (err, BigReq) => {
        BigReq.Enable((err, maxLen) => {
            const keycode2keysym = [];
            const min = display.min_keycode;
            const max = display.max_keycode;
            X.GetKeyboardMapping(min, max-min, (err, list) => {
                for (let i=0; i < list.length; ++i)
                {
                    const keycode = i + min;
                    const keysyms = list[i];
                    keycode2keysym[keycode] = keysyms;
                }


        const root = display.screen[0].root;
        const white = display.screen[0].white_pixel;
        const black = display.screen[0].black_pixel;

        const r = rfb.createConnection(opts);
        r.on('connect', () => {

            const wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, r.width, r.height);
            X.ChangeWindowAttributes(wid, {
                backgroundPixel: black,
                eventMask: Exposure|PointerMotion|ButtonPress|ButtonRelease|KeyPress|KeyRelease
            });
            X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, r.title);
            X.MapWindow(wid);

            const gc = X.AllocID();
            X.CreateGC(gc, wid, { foreground: black, background: white } );

            //var pixbuf = X.AllocID();
            //X.CreatePixmap(pixbuf, wid, 32, r.width, r.height);
            //var pic = X.AllocID();
            //Render.CreatePicture(pic, pixbuf, Render.rgba32);

            let buttonsState = 0;
            X.on('error', err => {
                console.log(err);
            });

            X.on('event', ev => {
                if (ev.type == 12) // expose
                {
                    // TODO: update only expose rect
                    //X.PutImage(2, wid, gc, 128, 128, 0, 0, 0, 24, bitmap);
                } else if (ev.type == 6) { // mousemove
                    r.pointerEvent(ev.x, ev.y, buttonsState);
                } else if (ev.type == 4 || ev.type == 5) { // mousedown
                    const buttonBit = 1 << (ev.keycode - 1);
                    // set button bit
                    if (ev.type == 4)
                        buttonsState |= buttonBit;
                    else
                        buttonsState &= ~buttonBit;
                    r.pointerEvent(ev.x, ev.y, buttonsState);
                } else if (ev.type == 2 || ev.type == 3) {
                    const shift = ev.buttons & 1;
                    const keysym = keycode2keysym[ev.keycode][shift];
                    const isDown = (ev.type == 2) ? 1 : 0;
                    r.keyEvent(keysym, isDown);
                }
            });

            r.on('resize', rect => {
                X.ResizeWindow(wid, rect.width, rect.height);
            });
            r.on('rect', rect => {
                if (rect.encoding == rfb.encodings.raw) {
                    // format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data
                    X.PutImage(2, wid, gc, rect.width, rect.height, rect.x, rect.y, 0, 24, rect.buffer);
                } else if (rect.encoding == rfb.encodings.copyRect) {
                    X.CopyArea(wid, wid, gc, rect.src.x, rect.src.y, rect.x, rect.y, rect.width, rect.height);
                } else if (rect.encoding == rfb.encodings.hextile) {
                     console.log('hextile rec! (currently not fully supported');
                     console.log(rect);
                     rect.on('tile', tile => {
                         X.PutImage(2, wid, gc, 16, 16, tile.x, tile.y, 0, 24, tile.buffer);
                     });
                }
            });

            X.on('end', () => {
                r.terminate();
            });

        }); // r.on('connect)
    }); // GetKeyboardMapping
}); // BigReq.Enable

}); // require('big-requests

}); // x11.createClient
