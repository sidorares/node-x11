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

/*

// from /usr/include/Xplugin.h  
enum xp_frame_class_enum {
    XP_FRAME_CLASS_DECOR_LARGE          = 1 << 0,
    XP_FRAME_CLASS_RESERVED1            = 1 << 1,
    XP_FRAME_CLASS_RESERVED2            = 1 << 2,
    XP_FRAME_CLASS_RESERVED3            = 1 << 3,
    XP_FRAME_CLASS_DECOR_SMALL          = 1 << 4,
    XP_FRAME_CLASS_RESERVED5            = 1 << 5,
    XP_FRAME_CLASS_RESERVED6            = 1 << 6,
    XP_FRAME_CLASS_DECOR_NONE           = 1 << 7,
    XP_FRAME_CLASS_RESERVED8            = 1 << 8,
    XP_FRAME_CLASS_BEHAVIOR_MANAGED     = 1 << 15,
    XP_FRAME_CLASS_BEHAVIOR_TRANSIENT   = 1 << 16,
    XP_FRAME_CLASS_BEHAVIOR_STATIONARY  = 1 << 17,
};
typedef enum xp_frame_class_enum xp_frame_class;

// Attributes of window frames. 

enum xp_frame_attr_enum {
    XP_FRAME_ATTR_ACTIVE                = 0x0001,
    XP_FRAME_ATTR_URGENT                = 0x0002,
    XP_FRAME_ATTR_TITLE                 = 0x0004,
    XP_FRAME_ATTR_PRELIGHT              = 0x0008,
    XP_FRAME_ATTR_SHADED                = 0x0010,
    XP_FRAME_ATTR_CLOSE_BOX             = 0x0100,
    XP_FRAME_ATTR_COLLAPSE              = 0x0200,
    XP_FRAME_ATTR_ZOOM                  = 0x0400,
    XP_FRAME_ATTR_CLOSE_BOX_CLICKED     = 0x0800,
    XP_FRAME_ATTR_COLLAPSE_BOX_CLICKED  = 0x1000,
    XP_FRAME_ATTR_ZOOM_BOX_CLICKED      = 0x2000,
    XP_FRAME_ATTR_GROW_BOX              = 0x4000,
};
typedef enum xp_frame_attr_enum xp_frame_attr;

*/

        ext.FrameDraw = function(screen, window, frameClass, attr, ix, iy, iw, ih, ox, oy, ow, oh, title)
        {
            X.seq_num++;
            var titleReqWords = xutil.padded_length(title.length);
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

// https://developer.apple.com/library/mac/documentation/Carbon/Reference/Process_Manager/Reference/reference.html#//apple_ref/doc/c_ref/ProcessSerialNumber

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

        ext.QueryVersion(function(err, vers) {
            ext.major = vers[0];
            ext.minor = vers[1];
            ext.patch = vers[2];
            callback(ext);
        });
    });
}
