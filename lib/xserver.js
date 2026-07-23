"use strict";
const util = require('util');
const net = require('net');
const PackStream = require('./framebuffer');
const EventEmitter = require('events').EventEmitter;

function XServer(servsock, params)
{
     const server = this;
     EventEmitter.call(this);
     servsock.on('connection', stream => {
         const cli = new XServerClientConnection(stream, params);
         server.emit('connection', cli);
     });
}
util.inherits(XServer, EventEmitter);

function XServerClientConnection(stream, params)
{
     EventEmitter.call(this);
     this.params = params;
     const serv = this;
     serv.stream = stream;
     serv.pack_stream = new PackStream();
     serv.pack_stream.attach(stream);
     stream.on('data', data => {
         serv.pack_stream.write(data);
     });
     serv.sequence = 0;
     serv.readClientHandshake();
}
util.inherits(XServerClientConnection, EventEmitter);

XServerClientConnection.prototype.readClientHandshake = function()
{
    const serv = this;
    serv.pack_stream.get(12, hdr => {
            const hello = {
                byteOrder: hdr.readUInt8(0),
                protocolMajor: hdr.readUInt16LE(2),
                protocolMinor: hdr.readUInt16LE(4),
                authTypeLength: hdr.readUInt16LE(6),
                authDataLength: hdr.readUInt16LE(8)
            };
            console.log(hello);
            serv.pack_stream.get(hello.authTypeLength, authType => {
                serv.pack_stream.get(hello.authDataLength, authData => {
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
    const serv = this;
    // ignore check for now;
    // protocol page 140: add code for reject & ask additional info
    console.log('check auth');
    console.log([authType, authData.toString()]);

    // auth ok: reply with list of screens, visuals, root window info etc
    const stream = serv.pack_stream;

/*
   xquartz exemple reply

{ major: 11,
  minor: 0,
  xlen: 537, (bytes in whole header)
  release: 11300000,
  resource_base: 6291456,
  resource_mask: 2097151,
  motion_buffer_size: 256,
  vlen: 20,
  max_request_length: 65535,
  screen_num: 1,
  format_num: 7,
  image_byte_order: 0,
  bitmap_bit_order: 0,
  bitmap_scanline_unit: 32,
  bitmap_scanline_pad: 32,
  min_keycode: 8,
  max_keycode: 255 }

per screen:
screen: { root: 226,
  default_colormap: 33,
  white_pixel: 16777215,
  black_pixel: 0,
  input_masks: 1703936,
  pixel_width: 3286,
  pixel_height: 1058,
  mm_width: 866,
  mm_height: 277,
  min_installed_maps: 1,
  max_installed_maps: 1,
  root_visual: 34,
  root_depth: 24,
  backing_stores: 0,
  num_depths: 7 }
17              'L root',¬
 18              'L default_colormap',¬
 19              'L white_pixel',¬
 20              'L black_pixel',¬
 21              'L input_masks',¬
 22              'S pixel_width',¬
 23              'S pixel_height',¬
 24              'S mm_width',¬
 25              'S mm_height',¬
 26              'S min_installed_maps',¬
 27              'S max_installed_maps',¬
 28              'L root_visual',¬
 29              'C root_depth',¬
 30              'C backing_stores',¬
 31              'C root_depth',¬
 32              'C num_depths'¬


per depth:
  depth: [ 24, 80 ] (depth, num visuals)

per visual:
  visual { vid: 146,
  class: 4,
  bits_per_rgb: 8,
  map_ent: 256,
  red_mask: 16711680,
  green_mask: 65280,
  blue_mask: 255 }

*/

    //stream.pack('')
    //  [2, reason,
    //serv.pack_stream.unpack('C', function(isShared) {
    //    console.log([isShared]);
    //    serv.writeServerInit();
    //});
    //
    const hello = require('fs').readFileSync('hello1.bin');
    const hdr = Buffer.alloc(8);
    hdr.writeUInt8(1, 0);
    hdr.writeUInt16LE(11, 2);
    hdr.writeUInt16LE(0, 4);
    hdr.writeUInt16LE(hello.length / 4, 6);
    stream.put(hdr);
    stream.put(hello);
    stream.flush();
    serv.expectMessage();
}

XServerClientConnection.prototype.expectMessage = function()
{
    const serv = this;
    console.log('expecting messages');
    serv.pack_stream.get(4, headerBuf => {
        const opcode = headerBuf.readUInt8(0);
        const extra = headerBuf.readUInt8(1);
        const length = headerBuf.readUInt16LE(2);
        serv.sequence++;
        console.log('Request:', opcode);
        console.log('Extra:', extra);
        console.log('length:', length);
        serv.pack_stream.get((length-1)*4, reqBody => {

          console.log('BODY:', reqBody, reqBody.toString());

          if (opcode == 98) {
            const b = Buffer.alloc(32);
            b.writeUInt8(1, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(serv.sequence, 2);
            b.writeUInt32LE(0, 4);
            b.writeUInt8(1, 8);
            b.writeUInt8(134, 9);
            serv.pack_stream.put(b);
            serv.pack_stream.flush();
          } else if (opcode == 134) {
            console.log('ENABLE BIG REQ');
            const b = Buffer.alloc(36);
            b.writeUInt8(1, 0);
            b.writeUInt8(0, 1);
            b.writeUInt16LE(serv.sequence, 2);
            b.writeUInt32LE(0, 4);
            b.writeUInt32LE(10000000, 8);
            serv.pack_stream.put(b);
            serv.pack_stream.flush();
          }
          serv.expectMessage();

        });
    });
}

module.exports.createServer = (options, onconnect) => {
    if (typeof(options) === 'function') {
        onconnect = options;
        options = {};
    }
    const s = net.createServer();
    const serv = new XServer(s, options);
    serv.on('connect', onconnect);
    return s;
}

//module.exports.createServer(6002) ;
//function(client) {
//});
