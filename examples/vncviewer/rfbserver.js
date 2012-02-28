"use strict";
var util = require('util');
var net = require('net');
var PackStream = require('./unpackstream');
var EventEmitter = require('events').EventEmitter;
var rfb = require('./constants');

function RfbServer(stream, params)
{
     EventEmitter.call(this);
     this.params = params;
     var serv = this;
     serv.stream = stream;
     serv.pack_stream = new PackStream();
     serv.pack_stream.on('data', function( data ) {
         serv.stream.write(data);
     });
     stream.on('data', function( data ) {
         serv.pack_stream.write(data);
     });
     serv.writeServerVersion();
     serv.params = {};
     serv.params.password = 'tetris';
}
util.inherits(RfbServer, EventEmitter);

RfbServer.prototype.writeServerVersion = function()
{
    var serv = this;
    this.stream.write(rfb.versionstring.V3_008);
    this.pack_stream.get(12, function(buf) {
        serv.emit('clientversion', buf.toString('ascii'));
        console.log(['client version', buf]);
        serv.writeSecurityTypes();
    });
}

RfbServer.prototype.writeSecurityTypes = function()
{
    console.log("RfbServer.prototype.writeSecurityTypes");
    var serv = this;
    var sectypes = [rfb.security.VNC];
    serv.pack_stream.pack('C', [sectypes.length]);
    serv.pack_stream.flush();
    for (var i=0; i < sectypes.length; ++i)
        serv.pack_stream.pack('C', [sectypes[i]]);
    serv.pack_stream.flush();
    serv.pack_stream.unpack('C', function(cliSecType) {
        serv.securityType = cliSecType[0];
        serv.processSecurity();
    });
}

RfbServer.prototype.processSecurity = function()
{
    console.log("RfbServer.prototype.processSecurity");
    var serv = this;
    switch(serv.securityType)
    {
    case rfb.security.None:
        console.log('not yet');
        break;
    case rfb.security.VNC:
        // generate random 16 byte challenge
        serv.challenge = new Buffer(16);
        serv.challenge.write('1234567890abcdef');
        console.log(['sending challenge', serv.challenge]);
        serv.pack_stream.pack('a', [serv.challenge]).flush();
        serv.pack_stream.get(16, function(clientResponseBuf)
        {
            var response = require('./d3des').response(serv.challenge, serv.params.password).toString('binary');
            var clientResponse = clientResponseBuf.toString('binary');
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
    var serv = this;
    serv.pack_stream.unpack('C', function(isShared) {
        console.log([isShared]);
        serv.writeServerInit();
    });
}

RfbServer.prototype.writeServerInit = function()
{
    var serv = this;
    var title = 'Param-pam-pam';
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
    var res = '';
    for (var i=0; i < num; ++i)
        res += str;
    return res;
}

RfbServer.prototype.expectMessage = function()
{
    var serv = this;
    serv.pack_stream.get(1, function(msgType) {
        switch(msgType[0]) {
        case rfb.clientMsgTypes.setPixelFormat:
        case rfb.clientMsgTypes.fbUpdate:
            var updateRequest = {};
            serv.pack_stream.unpackTo(updateRequest, [
                'C incremental',
                'S width',
                'S height', 
                'S x', 
                'S y'], 
            function() {
                serv.emit('fbUpdate', updateRequest);
                serv.expectMessage();
            });
            break;
        case rfb.clientMsgTypes.setEncodings:
            serv.pack_stream.unpack('xS', function(numEnc)
            {
                serv.pack_stream.unpack(repeat('L', numEnc), function(res) {
                    serv.emit('setEncodings', res);
                    console.log(['setEncodings', res]);
                    serv.expectMessage();
                })
            });
            break;
        case rfb.clientMsgTypes.pointerEvent:
             serv.pack_stream.unpack('CSS', function(res) {
	        var pointerEvent = {
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
             serv.pack_stream.unpack('CxxL', function(res) {
	        var keyEvent = {
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
            console.log('Got message from client: ' + msgType[0]);
        }
        
    });   
}


var s = net.createServer(function(conn) {
    var rfbserv = new RfbServer(conn);
});
s.listen(5910);
