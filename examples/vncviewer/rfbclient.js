"use strict";

var util = require('util'); // util.inherits
var net = require('net');

var EventEmitter = require('events').EventEmitter;
var PackStream = require('./unpackstream');
var hexy = require('./hexy').hexy;

// constants
var rfb = require('./constants');

function RfbClient(stream, params)
{
    EventEmitter.call(this);
    this.params = params;
    var cli = this;
    cli.stream = stream;
    cli.pack_stream = new PackStream();
    cli.pack_stream.on('data', function( data ) {
        console.log(hexy(data, {prefix: 'from client '}));
        cli.stream.write(data);
    });
    stream.on('data', function( data ) {
        var dump = data.length >  20 ? data.slice(0,20) : data;
        console.log(hexy(dump, {prefix: 'from server '}));
        cli.pack_stream.write(data);
    });

    // TODO: check if I need that at all
    cli.pack_stream.serverBigEndian = !true;
    cli.pack_stream.clientBigEndian = !true;
    cli.readServerVersion();
}
util.inherits(RfbClient, EventEmitter);

PackStream.prototype.readString = function(strcb)
{
    var stream = this;
    stream.unpack('L', function(res) {
        //console.log(res[0]);
        stream.get(res[0], function(strBuff) {
            strcb(strBuff.toString());
        });
    });
}

RfbClient.prototype.readError = function()
{
    this.pack_stream.readString(function(str) {
         //console.log(str);
         cli.emit('error', str);
    });
}

RfbClient.prototype.readServerVersion = function()
{
    var stream = this.pack_stream;
    var cli = this;
    stream.get(12, function(rfbver) {
        console.log(rfbver);
        stream.pack('a', [ 'RFB 003.008\n' ]).flush();
        // read security types
        stream.unpack('C', function(res) {
            var numSecTypes = res[0];
            console.log(['sec types result', res]);
            if (numSecTypes == 0) {
                cli.readError();
            } else {
                
                stream.get(numSecTypes, function(secTypes) {
                    // TODO: check what is in options
                    //
                    // send sec type we are going to use
                    //cli.securityType = rfb.security.None;
                    cli.securityType = rfb.security.VNC;
                    stream.pack('C', [cli.securityType]).flush();
                    cli.processSecurity();
                });
            }
        }); 
   });
}

RfbClient.prototype.readSecurityResult = function()
{
    var stream = this.pack_stream;
    var cli = this;
    stream.unpack('L', function(securityResult) {
        //console.log(['security result: ', securityResult]);
        if (securityResult[0] == 0)
        {
            cli.clientInit();
        } else {
            stream.readString(function(message) {
                console.error(message);
                process.exit(0);
            });
        } 
    });  
}

RfbClient.prototype.processSecurity = function()
{
    var stream = this.pack_stream;
    var cli = this;
    switch(cli.securityType) {
    case rfb.security.None:
        // do nothing
        cli.readSecurityResult();
        break;
    case rfb.security.VNC:
        stream.get(16, function(challenge) {
            var response = require('./d3des').response(challenge, cli.params.password);
            stream.pack('a', [response]).flush();
            cli.readSecurityResult();
        });
        break;
    default:
        console.error('unknown security type: ' + cli.securityType);
        process.exit(1);
    }
}

RfbClient.prototype.clientInit = function()
{
    var stream = this.pack_stream;
    var cli = this;

    var initMessage = cli.disconnectOthers ? rfb.connectionFlag.Exclusive : rfb.connectionFlag.Shared;
    stream.pack('C', [ initMessage ]).flush();

    stream.unpackTo(
        cli,
        [
        "S width",
        "S height",
        "C bpp", // 16-bytes pixel format
        "C depth",
        "C isBigEndian",
        "C isTrueColor",
        "S redMax",
        "S greenMax",
        "S blueMax",
        "C redShift",
        "C greenShift",
        "C blueShift",
        "xxx",
        "L titleLength"        
        ],

        function() {

            // TODO: remove next 3 lines 
            stream.serverBigEndian = false; //cli.isBigEndian; 
            stream.clientBigEndian = false; //cli.isBigEndian; 
            //stream.bigEndian = false; //cli.isBigEndian; 

            stream.get(cli.titleLength, function(titleBuf) {

                cli.title = titleBuf.toString();
                delete cli.titleLength;
                cli.width = cli.width;
                cli.height = cli.height;
                cli.title = cli.title;
                cli.setPixelFormat();
            });
        }
      
    );
}

RfbClient.prototype.setPixelFormat = function()
{
    var stream = this.pack_stream;
    var cli = this;
    stream.pack('CxxxCCCCSSSCCCxxx',
        [0, cli.bpp, cli.depth, cli.isBigEndian, cli.isTrueColor, cli.redMax, cli.greenMax, cli.blueMax, 
            cli.redShift, cli.greenShift, cli.blueShift]
    );
    stream.flush();
    cli.setEncodings();
}

function repeat(str, num)
{
    var res = '';
    for (var i=0; i < num; ++i)
        res += str;
    return res;
}

RfbClient.prototype.setEncodings = function()
{
    var stream = this.pack_stream;
    var cli = this;

    // build encodings list
    // TODO: API
    var encodings = [rfb.encodings.raw, rfb.encodings.copyRect, rfb.encodings.pseudoDesktopSize]; //, rfb.encodings.hextile];

    stream.pack('CxS', [rfb.clientMsgTypes.setEncodings, encodings.length]);
    stream.pack(repeat('L', encodings.length), encodings);
    stream.flush();

    cli.requestUpdate(false, 0, 0, cli.width, cli.height);    
    cli.expectNewMessage();
    this.emit('connect');
}

RfbClient.prototype.expectNewMessage = function()
{
    var stream = this.pack_stream;
    var cli = this;
    stream.get(1, function(buff) {
        switch(buff[0]) {
        case rfb.serverMsgTypes.fbUpdate: cli.readFbUpdate(); break;
        case rfb.serverMsgTypes.setColorMap: cli.readColorMap(); break;
        case rfb.serverMsgTypes.bell: cli.readBell(); break;
        case rfb.serverMsgTypes.cutText: cli.readClipboardUpdate(); break;
        default:
            console.log('unsopported server message: ' + buff[0]);
        }
    });
}


var decodeHandlers = {
};

RfbClient.prototype.readFbUpdate = function()
{
    //console.log('fb update');
    var stream = this.pack_stream;
    var cli = this;

    stream.unpack('xS', function(res) {
        var numRects = res[0];
        // decode each rectangle
        var numRectsLeft = numRects;
        //console.log(numRects);
        function unpackRect() {
            if (numRectsLeft == 0)
            {
                cli.expectNewMessage();
                cli.requestUpdate(true, 0, 0, cli.width, cli.height);  
                return;
            }
            numRectsLeft--;

            var rect = {};
            stream.unpackTo(rect,
                ['S x', 'S y', 'S width', 'S height', 'l encoding'],
                function() {
   
                    // TODO: rewrite using decodeHandlers                 
                    switch(rect.encoding) {
                    case rfb.encodings.raw:
                        cli.readRawRect(rect, unpackRect);
                        break;
                    case rfb.encodings.copyRect:
                        cli.readCopyRect(rect, unpackRect);
                        break;
                    case rfb.encodings.pseudoDesktopSize:
                        console.log(['Resize', rect]);
                        cli.width = rect.width;
                        cli.height = rect.height;
                        cli.emit('resize', rect);
                        unpackRect();
                        break;
                    default:
                        console.log('unknown encoding!!!');
                    }
                }
            );
        }
        unpackRect();
    });
}

RfbClient.prototype.readCopyRect = function(rect, cb)
{
    var stream = this.pack_stream;
    var cli = this;

    stream.unpack('SS', function(src) {
        rect.src = { x: src[0], y: src[1] };
        console.log(['copy rect', src, rect]);
        cli.emit('rect', rect);
        cb(rect);
    });
}

RfbClient.prototype.readRawRect = function(rect, cb)
{
    var stream = this.pack_stream;
    var cli = this;

    var bytesPerPixel = cli.bpp >> 3;
    stream.get(bytesPerPixel*rect.width*rect.height, function(rawbuff)
    {
        //console.log('arrived ' + rawbuff.length + ' bytes of fb update');
        rect.buffer = rawbuff;
        cli.emit('rect', rect);
        cb(rect);
    });
}

RfbClient.prototype.readColorMap = function()
{
    console.log('color map');
}

RfbClient.prototype.readBell = function()
{
    console.log('bell');
    this.expectNewMessage();
}

RfbClient.prototype.readClipboardUpdate = function()
{
    console.log('clipboard update');
    var stream = this.pack_stream;
    var cli = this;

    stream.unpack('xxxL', function(res) {
         console.log(res[0] + ' bytes string in the buffer');
         stream.get(res[0], function(buf) {
             console.log(buf.toString());
             cli.expectNewMessage();
         })
    });
}

RfbClient.prototype.pointerEvent = function(x, y, buttons)
{
    var stream = this.pack_stream;
   
    stream.pack('CCSS', [rfb.clientMsgTypes.pointerEvent, buttons, x, y]);
    stream.flush();
}

RfbClient.prototype.keyEvent = function(keysym, isDown)
{
    var stream = this.pack_stream;
   
    stream.pack('CCxxL', [rfb.clientMsgTypes.keyEvent, isDown, keysym]);
    stream.flush();
}

RfbClient.prototype.requestUpdate = function(incremental, x, y, width, height)
{
    var stream = this.pack_stream;
    stream.pack('CCSSSS', [rfb.clientMsgTypes.fbUpdate, incremental, x, y, width, height]);
    stream.flush();
}

function createConnection(params)
{
    var stream = net.createConnection(params.port, params.host);
    return new RfbClient(stream, params);
}

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
console.log(opts);
var r = createConnection(opts);
r.on('connect', function() {
     startUI();    
});


function startUI()
{

var x11 = require('../../lib/x11');
var xclient = x11.createClient();
var Exposure = x11.eventMask.Exposure;
var PointerMotion = x11.eventMask.PointerMotion;
var ButtonPress = x11.eventMask.ButtonPress;
var ButtonRelease = x11.eventMask.ButtonRelease;
var KeyPress = x11.eventMask.KeyPress;
var KeyRelease = x11.eventMask.KeyRelease;


xclient.on('connect', function(display) {

    var X = display.client;   
    X.require('big-requests', function(BigReq) {
        BigReq.Enable(function(maxLen) {});
        X.require('render', function(Render) {
   
    var keycode2keysym = [];
    var min = display.min_keycode;
    var max = display.max_keycode;
    X.GetKeyboardMapping(min, max-min, function(list) {
        for (var i=0; i < list.length; ++i)
        {
            var keycode = i + min;
            var keysyms = list[i];
            keycode2keysym[keycode] = keysyms;
        }


    var root = display.screen[0].root;
    var white = display.screen[0].white_pixel;
    var black = display.screen[0].black_pixel;

    var wid = X.AllocID();
    X.CreateWindow(
       wid, root, 
       10, 10, r.width, r.height, 
       1, 1, 0,
       { 
           backgroundPixel: white, eventMask: Exposure|PointerMotion|ButtonPress|ButtonRelease|KeyPress|KeyRelease 
       }
    );
    X.MapWindow(wid);
  
    var gc = X.AllocID();
    X.CreateGC(gc, wid, { foreground: black, background: white } );
    X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, r.title);


    //var pixmap1 = X.AllocID();
    //X.CreatePixmap(pixmap1, wid, 32, 128, 128);
    //var pic = X.AllocID(); 
    //Render.CreatePicture(pic, pixmap1, Render.rgba32);
    

    var pic1 = X.AllocID();
    Render.CreatePicture(pic1, wid, Render.rgb24);
    var buttonsState = 0;

    X.on('error', function(err) {
        console.log(err);
    });

    X.on('event', function(ev) {
        //console.log(ev);
        if (ev.type == 12) // expose
        {
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
            //console.log(keycode2keysym[ev.keycode]);
            var shift = ev.buttons & 1;
            //console.log(shift); 
            var keysym = keycode2keysym[ev.keycode][shift];
            var isDown = (ev.type == 2) ? 1 : 0;
            r.keyEvent(keysym, isDown);
        }
    });

    r.on('resize', function(rect)
    {
        console.log('============');
        X.ResiseWindow(wid, rect.width, rect.height);
    });
 
    r.on('rect', function(rect) {
        //console.log('========= in handler');
        //console.log(rect);
        if (rect.encoding == rfb.encodings.raw) {
            // format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data
            X.PutImage(2, wid, gc, rect.width, rect.height, rect.x, rect.y, 0, 24, rect.buffer);
        } else if (rect.encoding == rfb.encodings.copyRect) {
            X.CopyArea(wid, wid, gc, rect.src.x, rect.src.y, rect.x, rect.y, rect.width, rect.height);
        }
    });

});
});
});
});

}
