"use strict";

var rfb = require('./rfbclient');
var x11 = require('../../lib');

// TODO: use optimist for args parsing
var host = process.argv[2];
var port = process.argv[3];
var password = process.argv[4]
if (!host)
    host = '127.0.0.1';
if (!port)
    port = 5900;

var opts = {};
opts.host = host;
opts.port = port;
opts.password = password;
opts.rfbfile = process.argv[5];
//opts.rfbFileOut = process.argv[5];




var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;
var KeyPress = x11.eventMask.KeyPress;
var KeyRelease = x11.eventMask.KeyRelease;

x11.createClient(function(err, display) {
    var X = display.client;
    X.require('big-requests', function(err, BigReq) {
        BigReq.Enable(function(err, maxLen) {
            var keycode2keysym = [];
            var min = display.min_keycode;
            var max = display.max_keycode;
            X.GetKeyboardMapping(min, max-min, function(err, list) {
                for (var i=0; i < list.length; ++i)
                {
                    var keycode = i + min;
                    var keysyms = list[i];
                    keycode2keysym[keycode] = keysyms;
                }


        var root = display.screen[0].root;
        var white = display.screen[0].white_pixel;
        var black = display.screen[0].black_pixel;

        var r = rfb.createConnection(opts);
        r.on('connect', function() {

            var wid = X.AllocID();
            X.CreateWindow(wid, root, 0, 0, r.width, r.height);
            X.ChangeWindowAttributes(wid, {
                backgroundPixel: black,
                eventMask: Exposure|PointerMotion|ButtonPress|ButtonRelease|KeyPress|KeyRelease
            });
            X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, r.title);
            X.MapWindow(wid);

            var gc = X.AllocID();
            X.CreateGC(gc, wid, { foreground: black, background: white } );

            //var pixbuf = X.AllocID();
            //X.CreatePixmap(pixbuf, wid, 32, r.width, r.height);
            //var pic = X.AllocID();
            //Render.CreatePicture(pic, pixbuf, Render.rgba32);

            var buttonsState = 0;
            X.on('error', function(err) {
                console.log(err);
            });

            X.on('event', function(ev) {
                if (ev.type == 12) // expose
                {
                    // TODO: update only expose rect
                    //X.PutImage(2, wid, gc, 128, 128, 0, 0, 0, 24, bitmap);
                } else if (ev.type == 6) { // mousemove
                    r.pointerEvent(ev.x, ev.y, buttonsState);
                } else if (ev.type == 4 || ev.type == 5) { // mousedown
                    var buttonBit = 1 << (ev.keycode - 1);
                    // set button bit
                    if (ev.type == 4)
                        buttonsState |= buttonBit;
                    else
                        buttonsState &= ~buttonBit;
                    r.pointerEvent(ev.x, ev.y, buttonsState);
                } else if (ev.type == 2 || ev.type == 3) {
                    var shift = ev.buttons & 1;
                    var keysym = keycode2keysym[ev.keycode][shift];
                    var isDown = (ev.type == 2) ? 1 : 0;
                    r.keyEvent(keysym, isDown);
                }
            });

            r.on('resize', function(rect)
            {
                X.ResizeWindow(wid, rect.width, rect.height);
            });
            r.on('rect', function(rect) {
                if (rect.encoding == rfb.encodings.raw) {
                    // format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data
                    X.PutImage(2, wid, gc, rect.width, rect.height, rect.x, rect.y, 0, 24, rect.buffer);
                } else if (rect.encoding == rfb.encodings.copyRect) {
                    X.CopyArea(wid, wid, gc, rect.src.x, rect.src.y, rect.x, rect.y, rect.width, rect.height);
                } else if (rect.encoding == rfb.encodings.hextile) {
                     console.log('hextile rec! (currently not fully supported');
                     console.log(rect);
                     rect.on('tile', function(tile) {
                         X.PutImage(2, wid, gc, 16, 16, tile.x, tile.y, 0, 24, tile.buffer);
                     });
                }
            });

            X.on('end', function() {
                r.terminate();
            });

        }); // r.on('connect)
    }); // GetKeyboardMapping
}); // BigReq.Enable

}); // require('big-requests

}); // x11.createClient
