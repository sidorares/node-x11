// http://www.xfree86.org/current/AppleWM.3.html
// http://opensource.apple.com/source/X11server/X11server-106.3/Xquartz/xorg-server-1.10.2/hw/xquartz/applewm.c
// /usr/X11/include/X11/extensions/applewm.h

const x11 = require('..');
const xutil = require('../xutil');
// TODO: move to templates

/*
#define X_AppleWMFrameGetRect           1
#define X_AppleWMFrameHitTest           2
#define X_AppleWMFrameDraw              3
#define X_AppleWMDisableUpdate          4
#define X_AppleWMReenableUpdate         5
#define X_AppleWMSetWindowMenuCheck     7
#define X_AppleWMSetWindowMenu          11
#define X_AppleWMSendPSN                12
#define X_AppleWMAttachTransient        13
*/

exports.requireExt = (display, callback) => {
    const X = display.client;
    X.QueryExtension('Apple-WM', (err, ext) => {

        if (!ext.present)
            callback(new Error('extension not available'));

        ext.QueryVersion = cb => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return [buf.readUInt16LE(0), buf.readUInt16LE(2), buf.readUInt32LE(4)];
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.FrameRect = {
            Titlebar: 1,
            Tracking: 2,
            Growbox: 3
        };

        ext.FrameGetRect = (frame_class, frame_rect, ix, iy, iw, ih, ox, oy, ow, oh, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(24);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(1, 1);
            b.writeUInt16LE(6, 2);
            b.writeUInt16LE(frame_class, 4);
            b.writeUInt16LE(frame_rect, 6);
            b.writeUInt16LE(ix, 8);
            b.writeUInt16LE(iy, 10);
            b.writeUInt16LE(iw, 12);
            b.writeUInt16LE(ih, 14);
            b.writeUInt16LE(ox, 16);
            b.writeUInt16LE(oy, 18);
            b.writeUInt16LE(ow, 20);
            b.writeUInt16LE(oh, 22);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return {
                        x: buf.readUInt16LE(0),
                        y: buf.readUInt16LE(2),
                        w: buf.readUInt16LE(4),
                        h: buf.readUInt16LE(6)
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.FrameHitTest = (frame_class, px, py, ix, iy, iw, ih, ox, oy, ow, oh, cb) => {
            X.seq_num++;
            const b = Buffer.alloc(28);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(2, 1);
            b.writeUInt16LE(7, 2);
            b.writeUInt16LE(frame_class, 4);
            b.writeUInt16LE(px, 6);
            b.writeUInt16LE(py, 8);
            b.writeUInt16LE(ix, 12);
            b.writeUInt16LE(iy, 14);
            b.writeUInt16LE(iw, 16);
            b.writeUInt16LE(ih, 18);
            b.writeUInt16LE(ox, 20);
            b.writeUInt16LE(oy, 22);
            b.writeUInt16LE(ow, 24);
            b.writeUInt16LE(oh, 26);
            X.pack_stream.put(b);
            X.replies[X.seq_num] = [
                (buf, opt) => {
                    return buf.readUInt32LE(0);
                },
                cb
            ];
            X.pack_stream.flush();
        }


// from /usr/include/Xplugin.h
        ext.FrameClass = {
            DecorLarge: 1,
            Reserved1: 2,
            Reserved2: 4,
            Reserved3: 8,
            DecorSmall: 16,
            Reserved5: 32,
            Reserved6: 64,
            Reserved8: 128,
            Managed: 1<<15,
            Transient: 1<<16,
            Stationary: 1<<17
        };

        ext.FrameAttr = {
            Active:   1,
            Urgent:   2,
            Title:    4,
            Prelight: 8,
            Shaded:  16,
            CloseBox: 0x100,
            Collapse: 0x200,
            Zoom:     0x400,
            CloseBoxClicked: 0x800,
            CollapseBoxClicked: 0x1000,
            ZoomBoxClicked: 0x2000,
            GrowBox: 0x4000
        };

        ext.FrameDraw = (screen, window, frameClass, attr, ix, iy, iw, ih, ox, oy, ow, oh, title) => {
            X.seq_num++;
            const titleReqWords = xutil.padded_length(title.length)/4;
            const titleBuf = xutil.padded_string(title);
            const b = Buffer.alloc(36);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(3, 1);
            b.writeUInt16LE(9 + titleReqWords, 2);
            b.writeUInt32LE(screen >>> 0, 4);
            b.writeUInt32LE(window >>> 0, 8);
            b.writeUInt16LE(frameClass, 12);
            b.writeUInt16LE(attr, 14);
            b.writeUInt16LE(ix, 16);
            b.writeUInt16LE(iy, 18);
            b.writeUInt16LE(iw, 20);
            b.writeUInt16LE(ih, 22);
            b.writeUInt16LE(ox, 24);
            b.writeUInt16LE(oy, 26);
            b.writeUInt16LE(ow, 28);
            b.writeUInt16LE(oh, 30);
            b.writeUInt32LE(title.length >>> 0, 32);
            X.pack_stream.put(b);
            X.pack_stream.put(titleBuf);
            X.pack_stream.flush();
        }

        ext.NotifyMask = {
            Controller: 1,
            Activation: 2,
            Pasteboard: 4,
            All: 7
        };

// TODO: decode events
/*
#define AppleWMMinimizeWindow           0
#define AppleWMZoomWindow               1
#define AppleWMCloseWindow              2
#define AppleWMBringAllToFront          3
#define AppleWMHideWindow               4
#define AppleWMHideAll                  5
#define AppleWMShowAll                  6
#define AppleWMWindowMenuItem           9
#define AppleWMWindowMenuNotify         10
#define AppleWMNextWindow               11
#define AppleWMPreviousWindow           12

#define AppleWMIsActive                 0
#define AppleWMIsInactive               1
#define AppleWMReloadPreferences        2

#define AppleWMCopyToPasteboard         0
*/

        ext.SelectInput = mask => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(6, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt32LE(mask >>> 0, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.SetFrontProcess = () => {
            X.seq_num++;
            const b = Buffer.alloc(4);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(8, 1);
            b.writeUInt16LE(1, 2);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.WindowLevel = {
            Normal: 0,
            Floating: 1,
            TornOff: 2,
            Dock: 3,
            Desktop: 4
        };

        ext.SetWindowLevel = (window, level) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(9, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(window >>> 0, 4);
            b.writeUInt32LE(level >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.CanQuit = state => {
            X.seq_num++;
            const b = Buffer.alloc(8);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(10, 1);
            b.writeUInt16LE(2, 2);
            b.writeUInt8(state, 4);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        // shortcut is single-byte ASCII (optional, 0=no shortcut)
        // items example: [ 'item1', 'some item', ['C', 'item with C shortcut'] ]
        ext.SetWindowMenu = items => {
           const reqlen = 8;
           const extlength = 0;
           items.forEach(i => {

           });
        }

        // https://developer.apple.com
        //    /library/mac/documentation/Carbon/Reference/Process_Manager/Reference/reference.html#//apple_ref/doc/c_ref/ProcessSerialNumber
        ext.SendPSN = (hi, lo) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(12, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(hi >>> 0, 4);
            b.writeUInt32LE(lo >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        ext.AttachTransient = (child, parent) => {
            X.seq_num++;
            const b = Buffer.alloc(12);
            b.writeUInt8(ext.majorOpcode, 0);
            b.writeUInt8(13, 1);
            b.writeUInt16LE(3, 2);
            b.writeUInt32LE(child >>> 0, 4);
            b.writeUInt32LE(parent >>> 0, 8);
            X.pack_stream.put(b);
            X.pack_stream.flush();
        }

        callback(null, ext);
        /*
        ext.QueryVersion(function(err, vers) {
            ext.major = vers[0];
            ext.minor = vers[1];
            ext.patch = vers[2];
            callback(null, ext);
        });
        */

        ext.events = {
            AppleWMControllerNotify: 0,
            AppleWMActivationNotify: 1,
            AppleWMPasteboardNotify: 2,
        }

        ext.EventKind = {
          Controller: {
            MinimizeWindow: 0,
            ZoomWindow: 1,
            CloseWindow: 2,
            BringAllToFront: 3,
            WideWindow: 4,
            HideAll: 5,
            ShowAll: 6,
            WindowMenuItem: 9,
            WindowMenuNotify: 10,
            NextWindow: 11,
            PreviousWindow: 12
          },
          Activation: {
            IsActive: 0,
            IsInactive:1,
            ReloadPreferences: 2
          },
          Pasteboard: {
            CopyToPasteboard: 0
          }
        };

        X.eventParsers[ext.firstEvent + ext.events.AppleWMControllerNotify] =
        X.eventParsers[ext.firstEvent + ext.events.AppleWMActivationNotify] =
        X.eventParsers[ext.firstEvent + ext.events.AppleWMPasteboardNotify] = (type, seq, extra, code, raw) => {
            const event = {};
            switch(type) {
                case ext.firstEvent + ext.events.AppleWMControllerNotify: event.name = 'AppleWMControllerNotify'; break;
                case ext.firstEvent + ext.events.AppleWMActivationNotify: event.name = 'AppleWMActivationNotify'; break;
                case ext.firstEvent + ext.events.AppleWMPasteboardNotify: event.name = 'AppleWMPasteboardNotify'; break;
            }
            event.type = code;
            event.time = extra;
            event.arg = raw.readUInt32LE(2);
            return event;
        };


    });
}
