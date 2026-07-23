"use strict";
const util = require('util');
const net = require('net');
const PackStream = require('./unpackstream');
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
     serv.pack_stream.on('data', data => {
         serv.stream.write(data);
     });
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
    const hello = {};
    serv.pack_stream.unpackTo(hello,
        [
            'C byteOrder',
            'x',
            'S protocolMajor',
            'S protocolMinor',
            'S authTypeLength',
            'S authDataLength',
            'x',
            'x'
        ],
        () => {
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
    stream.pack('CxSSSa', [1, 11, 0, hello.length/4, hello]);
    stream.flush();
    serv.expectMessage();
}

XServerClientConnection.prototype.expectMessage = function()
{
    const serv = this;
    console.log('expecting messages');
    serv.pack_stream.unpack('CCS', header => {
        serv.sequence++;
        console.log('Request:', header[0]);
        console.log('Extra:', header[1]);
        console.log('length:', header[2]);
        serv.pack_stream.get((header[2]-1)*4, reqBody => {

          console.log('BODY:', reqBody, reqBody.toString());

          if (header[0] == 98) {
            serv.pack_stream.pack('CCSLCCCCLLLLL', [1, 0, serv.sequence, 0, 1, 134, 0, 0, 0, 0, 0, 0, 0, 0]);
            serv.pack_stream.flush();
          } else if (header[0] == 134) {
            console.log('ENABLE BIG REQ');
            serv.pack_stream.pack('CCSLLLLLLLL', [1, 0, serv.sequence, 0, 10000000, 0, 0, 0, 0, 0, 0 ]);
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
