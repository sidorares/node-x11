"use strict";
var util = require('util');
var net = require('net');
var PackStream = require('./unpackstream');
var EventEmitter = require('events').EventEmitter;

function XServer(servsock, params)
{
     var server = this;
     EventEmitter.call(this);
     servsock.on('connection', function(stream) {
         var cli = new XServerClientConnection(stream, params);
         server.emit('connection', cli);       
     });    
}
util.inherits(XServer, EventEmitter);

function XServerClientConnection(stream, params)
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

     serv.readClientHandshake();
}
util.inherits(XServerClientConnection, EventEmitter);

XServerClientConnection.prototype.readClientHandshake = function()
{
    var serv = this;
    var hello = {};
    serv.pack_stream.unpackTo(hello, 
        [
            'C byteOrder', 
            'x', 
            'S protocolMajor',
            'S protocolMinor',
            'S authTypeLength',
            'S authDataLength',
        ],
        function() {
            console.log(hello);
            serv.pack_stream.get(hello.authTypeLength, function(authType) {
                serv.pack_stream.get(hello.authDataLength, function(authData) {
                    serv.byteOrder = hello.byteOrder;
                    serv.protocolMajor = hello.protocolMajor;     
                    serv.protocolMinor = hello.protocolMinor;
                    serv.checkAuth(authType.toString('ascii'), authData);    
                });
            });
        }
    );
}

XServerClientConnection.prototype.checkAuth = function(authType, authData)
{
    var serv = this;
    // ignore check for now;
    // protocol page 140: add code for reject & ask additional info
    console.log([authType, authData]);
    
    // auth ok: reply with list of screens, visuals, root window info etc
    var stream = serv.pack_stream;

    stream.write('Cxxxxxp
      [2, reason, 
    //serv.pack_stream.unpack('C', function(isShared) {
    //    console.log([isShared]);
    //    serv.writeServerInit();
    //});
}

XServerClientConnection.prototype.expectMessage = function()
{
    var serv = this;
    //serv.pack_stream.get(1, function(msgType) {
    //});   
}

module.exports.createServer = function(listenport, params) {
    var s = net.createServer();
    s.listen(listenport);
    return new XServer(s, params);
}

module.exports.createServer(6002) ;
//function(client) {
//});
