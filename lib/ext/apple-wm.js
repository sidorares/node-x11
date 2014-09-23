// http://www.xfree86.org/current/AppleWM.3.html
// http://opensource.apple.com/source/X11server/X11server-106.3/Xquartz/xorg-server-1.10.2/hw/xquartz/applewm.c
// /usr/X11/include/X11/extensions/applewm.h

var x11 = require('..');
var xutil = require('../xutil');
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

exports.requireExt = function(display, callback)
{
    var X = display.client;
    X.QueryExtension('Apple-WM', function(err, ext) {

        if (!ext.present)
            callback(new Error('extension not available'));

        ext.QueryVersion = function(cb)
        {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 0, 1]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('SSL');
                    return res;
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

        ext.FrameGetRect = function(frame_class, frame_rect, ix, iy, iw, ih, ox, oy, ow, oh, cb)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSSSSSSSSSSS', [ext.majorOpcode, 1, 6, frame_class, frame_rect, ix, iy, iw, ih, ox, oy, ow, oh, cb]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('SSSS');
                    return {
                        x: res[0],
                        y: res[1],
                        w: res[2],
                        h: res[3]
                    };
                },
                cb
            ];
            X.pack_stream.flush();
        }

        ext.FrameHitTest = function(frame_class, px, py, ix, iy, iw, ih, ox, oy, ow, oh, cb)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSSxxSSSSSSSSSS', [ext.majorOpcode, 2, 7, frame_class, px, py, ix, iy, iw, ih, ox, oy, ow, oh]);
            X.replies[X.seq_num] = [
                function(buf, opt) {
                    var res = buf.unpack('L');
                    return res[0];
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

        ext.FrameDraw = function(screen, window, frameClass, attr, ix, iy, iw, ih, ox, oy, ow, oh, title)
        {
            X.seq_num++;
            var titleReqWords = xutil.padded_length(title.length)/4;
            X.pack_stream.pack('CCSLLSSSSSSSSSSLp', [ext.majorOpcode, 3, 9+titleReqWords, screen, window, frameClass, attr, ix, iy, iw, ih, ox, oy, ow, oh, title.length, title]);
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

        ext.SelectInput = function(mask)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSL', [ext.majorOpcode, 6, 2, mask]);
            X.pack_stream.flush();
        }

        ext.SetFrontProcess = function()
        {
            X.seq_num++;
            X.pack_stream.pack('CCS', [ext.majorOpcode, 8, 1]);
            X.pack_stream.flush();
        }

        ext.WindowLevel = {
            Normal: 0,
            Floating: 1,
            TornOff: 2,
            Dock: 3,
            Desktop: 4
        };

        ext.SetWindowLevel = function(window, level)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 9, 3, window, level]);
            X.pack_stream.flush();
        }

        ext.CanQuit = function(state)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSCxxx', [ext.majorOpcode, 10, 2, state]);
            X.pack_stream.flush();
        }

        // shortcut is single-byte ASCII (optional, 0=no shortcut)
        // items example: [ 'item1', 'some item', ['C', 'item with C shortcut'] ]
        ext.SetWindowMenu = function(items)
        {
           var reqlen = 8;
           var extlength = 0;
           items.forEach(function(i) {

           });
        }

        // https://developer.apple.com
        //    /library/mac/documentation/Carbon/Reference/Process_Manager/Reference/reference.html#//apple_ref/doc/c_ref/ProcessSerialNumber
        ext.SendPSN = function(hi, lo)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 12, 3, hi, lo]);
            X.pack_stream.flush();
        }

        ext.AttachTransient = function(child, parent)
        {
            X.seq_num++;
            X.pack_stream.pack('CCSLL', [ext.majorOpcode, 13, 3, child, parent]);
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
        X.eventParsers[ext.firstEvent + ext.events.AppleWMPasteboardNotify] = function(type, seq, extra, code, raw)
        {
            var event = {};
            switch(type) {
                case ext.firstEvent + ext.events.AppleWMControllerNotify: event.name = 'AppleWMControllerNotify'; break;
                case ext.firstEvent + ext.events.AppleWMActivationNotify: event.name = 'AppleWMActivationNotify'; break;
                case ext.firstEvent + ext.events.AppleWMPasteboardNotify: event.name = 'AppleWMPasteboardNotify'; break;
            }
            event.type = code;
            event.time = extra;
            event.arg = raw.unpack('xxL')[0];
            return event;
        };


    });
}
