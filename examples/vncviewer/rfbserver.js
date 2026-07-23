"use strict";
const util = require('util');
const net = require('net');
const PackStream = require('./unpackstream');
const EventEmitter = require('events').EventEmitter;
const rfb = require('./constants');

function RfbServer(stream, params)
{
     EventEmitter.call(this);
     this.params = params;
     const serv = this;
     serv.stream = stream;
     serv.pack_stream = new PackStream();
     serv.pack_stream.on('data', data => {
         serv.stream.write(data);
     });
     stream.on('data', data => {
         serv.pack_stream.write(data);
     });
     serv.writeServerVersion();
     serv.params = {};
     serv.params.password = 'tetris';
}
util.inherits(RfbServer, EventEmitter);

RfbServer.prototype.writeServerVersion = function()
{
    const serv = this;
    this.stream.write(rfb.versionstring.V3_008);
    this.pack_stream.get(12, buf => {
        serv.emit('clientversion', buf.toString('ascii'));
        console.log(['client version', buf]);
        serv.writeSecurityTypes();
    });
}

RfbServer.prototype.writeSecurityTypes = function()
{
    console.log("RfbServer.prototype.writeSecurityTypes");
    const serv = this;
    const sectypes = [rfb.security.VNC];
    serv.pack_stream.pack('C', [sectypes.length]);
    serv.pack_stream.flush();
    for (let i=0; i < sectypes.length; ++i)
        serv.pack_stream.pack('C', [sectypes[i]]);
    serv.pack_stream.flush();
    serv.pack_stream.unpack('C', cliSecType => {
        serv.securityType = cliSecType[0];
        serv.processSecurity();
    });
}

RfbServer.prototype.processSecurity = function()
{
    console.log("RfbServer.prototype.processSecurity");
    const serv = this;
    switch(serv.securityType)
    {
    case rfb.security.None:
        console.log('not yet');
        break;
    case rfb.security.VNC:
        // generate random 16 byte challenge
        serv.challenge = Buffer.alloc(16);
        serv.challenge.write('1234567890abcdef');
        console.log(['sending challenge', serv.challenge]);
        serv.pack_stream.pack('a', [serv.challenge]).flush();
        serv.pack_stream.get(16, clientResponseBuf => {
            const response = require('./d3des').response(serv.challenge, serv.params.password).toString('binary');
            const clientResponse = clientResponseBuf.toString('binary');
            console.log([response, clientResponse]);
            if (response === clientResponse) {
                serv.pack_stream.pack('L', [0]).flush();
                serv.readClientInit();
                return;
            } else {
                console.error('invalid password!');
                process.exit(0);
            }
        })
        break;
    }
}

RfbServer.prototype.readClientInit = function()
{
    // TODO: read options, add 'disconnect others' code
    const serv = this;
    serv.pack_stream.unpack('C', isShared => {
        console.log([isShared]);
        serv.writeServerInit();
    });
}

RfbServer.prototype.writeServerInit = function()
{
    const serv = this;
    const title = 'Param-pam-pam';
    serv.pack_stream.pack('SSCCCCSSSCCCxxxLa', [
        800, //serv.width,
        600, //serv.height,
        32, //serv.bpp,
        24, //serv.depth,
        1, // bigEndien
        1, // trueColor
        255, // red max
        255, // green
        255, // blue
        16,  // red shift
        8,   // green 
        0,    // blue
        title.length,
        title
    ]);
    serv.pack_stream.flush();
    serv.expectMessage();
}

function repeat(str, num)
{
    let res = '';
    for (let i=0; i < num; ++i)
        res += str;
    return res;
}

RfbServer.prototype.expectMessage = function()
{
    const serv = this;
    serv.pack_stream.get(1, msgType => {
        switch(msgType[0]) {
        case rfb.clientMsgTypes.setPixelFormat:
        case rfb.clientMsgTypes.fbUpdate:
            const updateRequest = {};
            serv.pack_stream.unpackTo(updateRequest, [
                'C incremental',
                'S width',
                'S height', 
                'S x', 
                'S y'], 
            () => {
                serv.emit('fbUpdate', updateRequest);
                serv.expectMessage();
            });
            break;
        case rfb.clientMsgTypes.setEncodings:
            serv.pack_stream.unpack('xS', numEnc => {
                serv.pack_stream.unpack(repeat('L', numEnc), res => {
                    serv.emit('setEncodings', res);
                    console.log(['setEncodings', res]);
                    serv.expectMessage();
                })
            });
            break;
        case rfb.clientMsgTypes.pointerEvent:
             serv.pack_stream.unpack('CSS', res => {
	        const pointerEvent = {
                    buttons: res[0],
                    x: res[1],
                    y: res[2]
                };
                serv.emit('pointer', pointerEvent);
                console.log(['pointer', pointerEvent]);
	        serv.expectMessage();
            });
            break;
        case rfb.clientMsgTypes.keyEvent:
             serv.pack_stream.unpack('CxxL', res => {
	        const keyEvent = {
                    isDown: res[0],
                    keysym: res[1]
                };
                serv.emit('key', keyEvent);
                console.log(['key', keyEvent]);
	        serv.expectMessage();
            });
            break;
        case rfb.clientMsgTypes.cutText:
            break;
            console.log(`Got message from client: ${msgType[0]}`);
        }
        
    });   
}


const s = net.createServer(conn => {
    const rfbserv = new RfbServer(conn);
});
s.listen(5910);
