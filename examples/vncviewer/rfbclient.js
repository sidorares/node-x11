"use strict";

//var clog = clog;
//var clog = function() {};
const clog = console.log;

const util = require('util'); // util.inherits
const net = require('net');

const EventEmitter = require('events').EventEmitter;
const PackStream = require('./unpackstream');
const hexy = require('./hexy').hexy;

// constants
const rfb = require('./constants');
for (const key in rfb)
{
     module.exports[key] = rfb[key];
}


function RfbClient(stream, params)
{
    EventEmitter.call(this);
    this.params = params;
    const cli = this;
    cli.stream = stream;
    cli.pack_stream = new PackStream();
    cli.pack_stream.on('data', data => {
        //clog(hexy(data, {prefix: 'from client '}));
        cli.stream.write(data);
    });
    stream.on('data', data => {
        //var dump = data.length >  20 ? data.slice(0,20) : data;
        //clog(hexy(dump, {prefix: 'from server '}));
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
    const stream = this;
    stream.unpack('L', res => {
        //clog(res[0]);
        stream.get(res[0], strBuff => {
            strcb(strBuff.toString());
        });
    });
}

RfbClient.prototype.terminate = function()
{
    debugger;
    this.stream.end();
}

RfbClient.prototype.readError = function()
{
    const cli = this;
    this.pack_stream.readString(str => {
         console.error(str);
         cli.emit('error', str);
    });
}

RfbClient.prototype.readServerVersion = function()
{
    const stream = this.pack_stream;
    const cli = this;
    stream.get(12, rfbver => {
        cli.serverVersion = rfbver.toString('ascii');
        console.log(['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', rfbver]);
        stream.pack('a', [ rfb.versionstring.V3_008 ]).flush();
        if (cli.serverVersion == rfb.versionstring.V3_003) 
        {
            stream.unpack('L', secType => {
                const type = secType[0];
                console.error(`3.003 security type: ${type}`);
                if (type == 0)
                {
                    cli.readError();
                } else {
                    cli.securityType = type;
                    // 3.003 version does not send result for None security
                    if (type == rfb.security.None) 
                        cli.clientInit();
                    else    
                        cli.processSecurity();
                }
                                
            });
            return;
        }
 
        // read security types
        stream.unpack('C', res => {
            const numSecTypes = res[0];
            if (numSecTypes == 0) {
                console.error(['zero num sec types', res]);
                cli.readError();
            } else {
                
                stream.get(numSecTypes, secTypes => {
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
    const stream = this.pack_stream;
    const cli = this;
    stream.unpack('L', securityResult => {
        if (securityResult[0] == 0)
        {
            cli.clientInit();
        } else {
            stream.readString(message => {
                console.error(message);
                process.exit(0);
            });
        } 
    });  
}

RfbClient.prototype.processSecurity = function()
{
    const stream = this.pack_stream;
    const cli = this;
    switch(cli.securityType) {
    case rfb.security.None:
        // do nothing
        cli.readSecurityResult();
        break;
    case rfb.security.VNC:
        stream.get(16, challenge => {
            const response = require('./d3des').response(challenge, cli.params.password);
            stream.pack('a', [response]).flush();
            cli.readSecurityResult();
        });
        break;
    default:
        console.error(`unknown security type: ${cli.securityType}`);
        process.exit(1);
    }
}

RfbClient.prototype.clientInit = function()
{
    const stream = this.pack_stream;
    const cli = this;

    const initMessage = cli.disconnectOthers ? rfb.connectionFlag.Exclusive : rfb.connectionFlag.Shared;
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

        () => {


            // TODO: remove next 3 lines 
            stream.serverBigEndian = false; //cli.isBigEndian; 
            stream.clientBigEndian = false; //cli.isBigEndian; 
            //stream.bigEndian = false; //cli.isBigEndian; 

            stream.get(cli.titleLength, titleBuf => {
                cli.title = titleBuf.toString();
                delete cli.titleLength;
                cli.setPixelFormat();
            });
        }
      
    );
}

RfbClient.prototype.setPixelFormat = function()
{
    const stream = this.pack_stream;
    const cli = this;
    stream.pack('CxxxCCCCSSSCCCxxx',
        [0, cli.bpp, cli.depth, cli.isBigEndian, cli.isTrueColor, cli.redMax, cli.greenMax, cli.blueMax, 
            cli.redShift, cli.greenShift, cli.blueShift]
    );
    stream.flush();
    cli.setEncodings();
}

function repeat(str, num)
{
    let res = '';
    for (let i=0; i < num; ++i)
        res += str;
    return res;
}

RfbClient.prototype.setEncodings = function()
{
    const stream = this.pack_stream;
    const cli = this;

    // build encodings list
    // TODO: API
    const encodings = [rfb.encodings.raw, rfb.encodings.copyRect, rfb.encodings.pseudoDesktopSize, rfb.encodings.hextile];

    stream.pack('CxS', [rfb.clientMsgTypes.setEncodings, encodings.length]);
    stream.pack(repeat('l', encodings.length), encodings);
    stream.flush();

    cli.requestUpdate(false, 0, 0, cli.width, cli.height);    
    cli.expectNewMessage();
    console.log('handshake performed');
    this.emit('connect');
    console.log('emitted CONNECT');
}

RfbClient.prototype.expectNewMessage = function()
{
    const stream = this.pack_stream;
    const cli = this;
    stream.get(1, buff => {
        console.log(`server message:${buff[0]}`);
        switch(buff[0]) {
        case rfb.serverMsgTypes.fbUpdate: cli.readFbUpdate(); break;
        case rfb.serverMsgTypes.setColorMap: cli.readColorMap(); break;
        case rfb.serverMsgTypes.bell: cli.readBell(); break;
        case rfb.serverMsgTypes.cutText: cli.readClipboardUpdate(); break;
        default:
            clog(`unsopported server message: ${buff[0]}`);
        }
    });
}


const decodeHandlers = {
};

RfbClient.prototype.readFbUpdate = function()
{
    clog('fb update');
    
    const stream = this.pack_stream;
    const cli = this;

    stream.unpack('xS', res => {
        const numRects = res[0];
        // decode each rectangle
        let numRectsLeft = numRects;
        clog(`number of rectngles in fb updte message: ${numRects}`);
        function unpackRect() {
            if (numRectsLeft == 0)
            {
                cli.expectNewMessage();
                cli.requestUpdate(true, 0, 0, cli.width, cli.height);  
                return;
            }
            numRectsLeft--;

            const rect = {};
            stream.unpackTo(rect,
                ['S x', 'S y', 'S width', 'S height', 'l encoding'],
                () => {
   
                    // TODO: rewrite using decodeHandlers                 
                    switch(rect.encoding) {
                    case rfb.encodings.raw:
                        cli.readRawRect(rect, unpackRect);
                        break;
                    case rfb.encodings.copyRect:
                        cli.readCopyRect(rect, unpackRect);
                        break;
                    case rfb.encodings.pseudoDesktopSize:
                        clog(['Resize', rect]);
                        cli.width = rect.width;
                        cli.height = rect.height;
                        cli.emit('resize', rect);
                        unpackRect();
                        break;
                    case rfb.encodings.hextile:
                        cli.readHextile(rect, unpackRect);
                        break;
                    default:
                        clog(`unknown encoding!!! ${rect.encoding}`);
                    }
                }
            );
        }
        unpackRect();
    });
}

RfbClient.prototype.readHextile = function(rect, cb)
{
    rect.emitter = new EventEmitter();
    rect.on = (eventname, cb) => {
        rect.emitter.on(eventname, cb);
    }
    rect.emit = (eventname, param) => {
        rect.emitter.emit(eventname, param);
    }

    rect.widthTiles = (rect.width >>> 4);
    rect.heightTiles = (rect.height >>> 4);
    clog(['tiles: ', rect.widthTiles, rect.heightTiles]);
    rect.rightRectWidth = rect.width & 0x0f;
    rect.bottomRectHeight = rect.height & 0x0f;
    rect.tilex = 0;
    rect.tiley = 0;
    rect.tiles = [];
    console.log('===== emitting rect');
    this.emit('rect', rect);
    this.readHextileTile(rect, cb); 
}

RfbClient.prototype.readHextileTile = function(rect, cb)
{
    let tile = {};
    const stream = this.pack_stream;
    const cli = this;

    tile.x = rect.tilex;
    tile.y = rect.tiley;
    tile.width = 16;
    if (tile.x == rect.widthTiles && rect.rightRectWidth > 0)
         tile.width = rect.rightRectWidt;
    tile.height = 16;
    if (tile.y == rect.heightTiles && rect.bottomRectHeight > 0)
         tile.height = rect.bottomRectHeight;

    // calculate next tilex & tiley and move up 'stack' if we at the last tile
    function nextTile()
    {
        clog('nextTile');
        rect.emit('tile', tile);
        tile = {};
        if (rect.tilex < rect.widthTiles)
        {
            rect.tilex++;
            //clog([rect.tilex, rect.tiley]);
            return cli.readHextileTile(rect, cb);
        } else {
            clog(`===================== new row! ${rect.tiley}`);
            rect.tilex = 0;
            if (rect.tiley < rect.heightTiles)
            {
                rect.tiley++;
                //clog([rect.tilex, rect.tiley]);
                return cli.readHextileTile(rect, cb);
            } else {
                clog('====================')
                clog(rect);
                return cb();
            }
        }   
    }

    const bytesPerPixel = cli.bpp >> 3;
    console.log(`bytesPerPixel: ${bytesPerPixel}`);
    const tilebuflen = bytesPerPixel*tile.width*tile.height;
    stream.unpack('C', subEnc => {
        clog(`tile flags: ${subEnc[0]}`);
        tile.subEncoding = subEnc[0];
        const hextile = rfb.subEncodings.hextile;
        if (tile.subEncoding & hextile.raw) {
            stream.get(tilebuflen, rawbuff => {
                clog('raw tile');
                tile.buffer = rawbuff;
                nextTile();
            });
            return;
        }
        tile.buffer = Buffer.alloc(tilebuflen);
     
        function solidBackground() {
            clog('solidBackground');
            // the whole tile is just single colored width x height
            for (let i=0; i < tilebuflen; i+= bytesPerPixel)
                tile.backgroundColor.copy(tile.buffer, i); 
        }
        
        function readBackground() {
            clog('readBackground');
            if (tile.subEncoding & hextile.backgroundSpecified) {
                clog('hextile.backgroundSpecified');
                stream.get(bytesPerPixel, pixelValue => {
                    clog(['tile.backgroundColor', pixelValue, tile.subEncoding]);
                    tile.backgroundColor = pixelValue;
                    rect.backgroundColor = pixelValue;
                    readForeground(); 
                });
            } else {
                tile.backgroundColor = rect.backgroundColor;
                readForeground(); 
            }
        }

        function readForeground() {
            clog('readForeground');
            // we should have background color set here
            solidBackground();
            if (rect.subEncoding & hextile.foregroundSpeciﬁed) {
                clog('foreground specified');
                stream.get(bytesPerPixel, pixelValue => {
                    tile.foreroundColor = pixelValue;
                    rect.foreroundColor = pixelValue;
                    console.log(rect);
                    readSubrects();
                });
            } else {
                clog('foreground NOT specified');
                clog(rect);
                tile.foregroundColor = rect.foregroundColor;
                readSubrects();
            }
        }

        function readSubrects() {
            clog('readSubrects');
            if (tile.subEncoding & hextile.anySubrects) {
                clog('have subrects');
                // read number of subrectangles
                stream.get('C', subrectsNum => {
                    tile.subrectsNum = subrectsNum[0];
                    clog(`number of subrects = ${tile.subrectsNum}`);
                    readSubrect();
                });        
            } else {
                nextTile();
            }
        }

        function drawRect(x, y, w, h)
        {
            console.log(tile);
            console.log(['drawRect', x, y, w, h, tile.foregroundColor]);
            // TODO: optimise
            for(let px = x; px < x+w; ++px)
            {
                for(let py = x; py < y+h; ++py)
                {
                    const offset = bytesPerPixel*(tile.width*py + px);
                    tile.foregroundColor.copy(tile.buffer, offset);
                }
            }
        }

        function readSubrect() {
            clog('readSubrect');
            if (tile.subEncoding & hextile.subrectsColored) {
                // we have color + rect data
                stream.get(bytesPerPixel, pixelValue => {
                    clog(['coloredSubrect: ', pixelValue]);
                    tile.foreroundColor = pixelValue;
                    rect.foreroundColor = pixelValue;
                    readSubrectRect(); 
                });
            } else // we have just rect data
                readSubrectRect();
        }

        function readSubrectRect() {
            clog('readSubrectRect');
            // read subrect x y w h encoded in two bytes
            stream.get(2, subrectRaw => {
                const x = (subrectRaw[0] & 0xf0) >> 4;
                const y = (subrectRaw[0] & 0x0f);
                const width  = (subrectRaw[1] & 0xf0) >> 4 + 1;
                const height = (subrectRaw[1] & 0x0f) + 1;
                clog(['readSubrectRect', x, y, width, height, tile.subrectsNum]);
                drawRect(x, y, width, height);
                tile.subrectsNum--;
                
                if (tile.subrectsNum === 0)
                {
                    nextTile();
                } else
                    readSubrect();
            });
        }

        readBackground();
    }); 
}

RfbClient.prototype.readCopyRect = function(rect, cb)
{
    const stream = this.pack_stream;
    const cli = this;

    stream.unpack('SS', src => {
        rect.src = { x: src[0], y: src[1] };
        clog(['copy rect', src, rect]);
        cli.emit('rect', rect);
        cb(rect);
    });
}

RfbClient.prototype.readRawRect = function(rect, cb)
{
    const stream = this.pack_stream;
    const cli = this;

    const bytesPerPixel = cli.bpp >> 3;
    stream.get(bytesPerPixel*rect.width*rect.height, rawbuff => {
        //clog('arrived ' + rawbuff.length + ' bytes of fb update');
        rect.buffer = rawbuff;
        cli.emit('rect', rect);
        cb(rect);
    });
}

RfbClient.prototype.readColorMap = () => {
    clog('color map');
}

RfbClient.prototype.readBell = function()
{
    clog('bell');
    this.expectNewMessage();
}

RfbClient.prototype.readClipboardUpdate = function()
{
    clog('clipboard update');
    const stream = this.pack_stream;
    const cli = this;

    stream.unpack('xxxL', res => {
         clog(`${res[0]} bytes string in the buffer`);
         stream.get(res[0], buf => {
             clog(buf.toString());
             cli.expectNewMessage();
         })
    });
}

RfbClient.prototype.pointerEvent = function(x, y, buttons)
{
    const stream = this.pack_stream;
   
    stream.pack('CCSS', [rfb.clientMsgTypes.pointerEvent, buttons, x, y]);
    stream.flush();
}

RfbClient.prototype.keyEvent = function(keysym, isDown)
{
    const stream = this.pack_stream;
   
    stream.pack('CCxxL', [rfb.clientMsgTypes.keyEvent, isDown, keysym]);
    stream.flush();
}

RfbClient.prototype.requestUpdate = function(incremental, x, y, width, height)
{
    const stream = this.pack_stream;
    stream.pack('CCSSSS', [rfb.clientMsgTypes.fbUpdate, incremental, x, y, width, height]);
    stream.flush();
}

// TODO: add client cutText event!



const fs = require('fs');
function createRfbStream(name)
{
    const stream = new EventEmitter();
    const fileStream = fs.createReadStream(name);
    const pack = new PackStream();
    fileStream.on('data', data => {
	//fileStream.pause();
        //setTimeout(function() {
            pack.write(data);
            //clog('received from filestream:' + data.length);
            //fileStream.resume();
        //}, 10);
    });
 
    const start = +new Date();
    function readData()
    {
        pack.unpack('L', size => {
            pack.get(size[0], databuf => {
                pack.unpack('L', timestamp => {
                    const padding = 3 - ((size - 1) & 0x03);
                    pack.get(padding, () => {
                        if (!stream.ending) {
                            stream.emit('data', databuf);
                            const now = +new Date - start; 
                            const timediff = timestamp[0] - now;
                            stream.timeout = setTimeout(readData, timediff);
                        }
                    });
                });
            }); 
        });
    }

    pack.get(12, fileVersion => {
         readData();
    });

    stream.end = () => {
        stream.ending = true;
        if (stream.timeout)
            clearTimeout(stream.timeout);
    };

    stream.write = buf => {
        // ignore
    }
    return stream;
}

function createConnection(params)
{
    let stream;
    if (params.rfbfile)
    {
        console.log(`reading from ${params.rfbfile}`);
        stream = createRfbStream(params.rfbfile);
    }
    else {
        console.log(`connecting to ${params.host}:${params.port}`);
        stream = net.createConnection(params.port, params.host);
    }

    if (params.rfbFileOut)
    {
        const start = +new Date();
        const wstream = fs.createWriteStream(params.rfbFileOut);
        wstream.write('FBS 001.001\n');
        stream.on('data', data => {
            const sizeBuf = Buffer.alloc(4);
            const timeBuf = Buffer.alloc(4);
            const size = data.length;
            sizeBuf.writeInt32BE(size, 0);
            wstream.write(sizeBuf);
            wstream.write(data);
            timeBuf.writeInt32BE(+new Date() - start, 0);
            wstream.write(timeBuf);
            const padding = 3 - ((size - 1) & 0x03);
            const pbuf = Buffer.alloc(padding);
            wstream.write(pbuf);             
        }).on('end', () => {
            wstream.end();
        });
    }

    return new RfbClient(stream, params);
}
exports.createConnection = createConnection;
