const xutil = require('./xutil');

function readVisuals(bl, visuals, n_visuals, cb)
{
    if (n_visuals == 0)
    {
        cb();
        return;
    }

    bl.get(24, buf => {
         const visual = {
             vid: buf.readUInt32LE(0),
             class: buf.readUInt8(4),
             bits_per_rgb: buf.readUInt8(5),
             map_ent: buf.readUInt16LE(6),
             red_mask: buf.readUInt32LE(8),
             green_mask: buf.readUInt32LE(12),
             blue_mask: buf.readUInt32LE(16)
             // 4 pad bytes
         };
         visuals[visual.vid] = visual;
         if (Object.keys(visuals).length == n_visuals)
             cb()
         else
             readVisuals(bl, visuals, n_visuals, cb);
    });
}

function readScreens(bl, display, cbDisplayReady)
{
     let numParsedDepths = 0;
     const readDepths = (bl, display, depths, n_depths, cb) => {
         if (n_depths == 0)
         {
             cb();
             return;
         }

         bl.get(8, buf => {
             const dep = buf.readUInt8(0);
             // skip 1 pad
             const n_visuals = buf.readUInt16LE(2);
             // skip 4 pad
             const visuals = {};
             readVisuals(bl, visuals, n_visuals, () => {
                 if (dep in depths) {
                     for (const visual in visuals) {
                         depths[dep][visual] = visuals[visual];
                     }
                 } else {
                     depths[dep] = visuals;
                 }
                 numParsedDepths++;
                 if (numParsedDepths == n_depths)
                     cb();
                 else
                     readDepths(bl, display, depths, n_depths, cb);
             });
         });
     };

     {
         bl.get(40, buf => {
             const scr = {
                 root: buf.readUInt32LE(0),
                 default_colormap: buf.readUInt32LE(4),
                 white_pixel: buf.readUInt32LE(8),
                 black_pixel: buf.readUInt32LE(12),
                 input_masks: buf.readUInt32LE(16),
                 pixel_width: buf.readUInt16LE(20),
                 pixel_height: buf.readUInt16LE(22),
                 mm_width: buf.readUInt16LE(24),
                 mm_height: buf.readUInt16LE(26),
                 min_installed_maps: buf.readUInt16LE(28),
                 max_installed_maps: buf.readUInt16LE(30),
                 root_visual: buf.readUInt32LE(32),
                 // note: XML has root_depth once; legacy code overwrote with backing_stores then root_depth again
                 backing_stores: buf.readUInt8(36),
                 root_depth: buf.readUInt8(37),
                 num_depths: buf.readUInt8(38)
                 // last byte unused / historically second root_depth overwrite path
             };
             // Preserve prior field assignment quirks from unpackTo which set root_depth twice:
             // C root_depth (36), C backing_stores (37), C root_depth (38), C num_depths (39)
             scr.root_depth = buf.readUInt8(36);
             scr.backing_stores = buf.readUInt8(37);
             // third C was also named root_depth in the format list — overwrote; then num_depths
             const root_depth2 = buf.readUInt8(38);
             scr.num_depths = buf.readUInt8(39);
             // Match old unpackTo: last write to root_depth was the third C (offset 38)
             scr.root_depth = root_depth2;

             const depths = {};
             readDepths(bl, display, depths, scr.num_depths, () => {

                 scr.depths = depths;
                 delete scr.num_depths;
                 display.screen.push(scr);

                 if (display.screen.length == display.screen_num)
                 {
                     delete display.screen_num;
                     cbDisplayReady(null, display);
                     return;
                 } else {
                     readScreens(bl, display, cbDisplayReady);
                 }
             });
         });
     }
}

function readServerHello(bl, cb)
{

bl.get(1, statusBuf => {
     const status = statusBuf.readUInt8(0);

     if (status == 0)
     {
         // connection time error
         bl.get(7, reasonHdr => {
             const reasonLen = reasonHdr.readUInt8(0);
             bl.get(reasonLen, reason => {
                 const err = new Error;
                 err.message = `X server connection failed: ${reason.toString()}`;
                 cb(err);
             });
         });
         return;
     }

     const display = {};
     bl.get(31, hdr => {
             // after status byte already consumed: x, major, minor, xlen, ...
             // format was: x S major S minor S xlen L release L resource_base L resource_mask
             // L motion_buffer_size S vlen S max_request_length C screen_num C format_num
             // C image_byte_order C bitmap_bit_order C bitmap_scanline_unit C bitmap_scanline_pad
             // C min_keycode C max_keycode xxxx
             // Total after status: 1+2+2+2+4*4+2+2+8+4 = 1+6+16+4+8+4 = 39? Let me recount.
             // Old format after first C status: 'x S major S minor S xlen L release L resource_base L resource_mask L motion_buffer_size S vlen S max_request_length C screen_num C format_num C image_byte_order C bitmap_bit_order C bitmap_scanline_unit C bitmap_scanline_pad C min_keycode C max_keycode xxxx'
             // sizes: 1 + 2+2+2 + 4+4+4+4 + 2+2 + 1*8 + 4 = 1+6+16+4+8+4 = 39 bytes
             display.major = hdr.readUInt16LE(1);
             display.minor = hdr.readUInt16LE(3);
             display.xlen = hdr.readUInt16LE(5);
             display.release = hdr.readUInt32LE(7);
             display.resource_base = hdr.readUInt32LE(11);
             display.resource_mask = hdr.readUInt32LE(15);
             display.motion_buffer_size = hdr.readUInt32LE(19);
             display.vlen = hdr.readUInt16LE(23);
             display.max_request_length = hdr.readUInt16LE(25);
             display.screen_num = hdr.readUInt8(27);
             display.format_num = hdr.readUInt8(28);
             display.image_byte_order = hdr.readUInt8(29);
             display.bitmap_bit_order = hdr.readUInt8(30);
             // need remaining 7 bytes: scanline_unit, scanline_pad, min_keycode, max_keycode, xxxx
             bl.get(8, rest => {
             display.bitmap_scanline_unit = rest.readUInt8(0);
             display.bitmap_scanline_pad = rest.readUInt8(1);
             display.min_keycode = rest.readUInt8(2);
             display.max_keycode = rest.readUInt8(3);
             // 4 pad

             const pvlen = xutil.padded_length(display.vlen);

             const mask = display.resource_mask;
             display.rsrc_shift = 0;
             while (!( (mask >> display.rsrc_shift) & 1) )
                 display.rsrc_shift++;
             display.rsrc_id = 0;

             bl.get(pvlen, vendor => {
                 display.vendor = vendor.toString('latin1', 0, display.vlen);

                 display.format = {};
                 if (display.format_num === 0) {
                     delete display.format_num;
                     display.screen = [];
                     readScreens(bl, display, cb);
                     return;
                 }
                 for (let i=0; i < display.format_num; ++i)
                 {
                     bl.get(8, fmtBuf => {
                         const depth = fmtBuf.readUInt8(0);
                         display.format[depth] = {};
                         display.format[depth].bits_per_pixel = fmtBuf.readUInt8(1);
                         display.format[depth].scanline_pad = fmtBuf.readUInt8(2);
                         if (Object.keys(display.format).length == display.format_num)
                         {
                             delete display.format_num;
                             display.screen = [];
                             readScreens(bl, display, cb);
                         }
                     });
                 }
             });
             });
     });
});

}

function getByteOrder() {
    const isLittleEndian = ((new Uint32Array((new Uint8Array([1,2,3,4])).buffer))[0] === 0x04030201);
    if (isLittleEndian) {
        return 'l'.charCodeAt(0);
    } else {
        return 'B'.charCodeAt(0);
    }
}

function writeClientHello(stream, displayNum, authHost, authFamily, authOverride)
{
    const withCookie = (err, cookie) => {
        if (err) {
            throw err;
        }
        const byte_order = getByteOrder();
        const protocol_major = 11; // TODO: config? env?
        const protocol_minor = 0;
        const authName = xutil.padded_string(cookie.authName);
        const authData = xutil.padded_string(cookie.authData);
        const hdr = Buffer.alloc(12);
        hdr.writeUInt8(byte_order, 0);
        hdr.writeUInt16LE(protocol_major, 2);
        hdr.writeUInt16LE(protocol_minor, 4);
        hdr.writeUInt16LE(cookie.authName.length, 6);
        hdr.writeUInt16LE(cookie.authData.length, 8);
        stream.put(hdr);
        stream.put(authName);
        stream.put(authData);
        stream.flush();
    };

    if (authOverride) {
        // caller-provided cookie ({ name, data }) — used by custom transports
        // and browser bundles where there is no ~/.Xauthority to read
        withCookie(null, {
            authName: authOverride.name || '',
            authData: authOverride.data || ''
        });
    } else {
        // lazy: auth.js touches fs/os, which browser bundles don't have
        const getAuthString = require('./auth');
        getAuthString(displayNum, authHost, authFamily, withCookie);
    }
}

module.exports.readServerHello = readServerHello;
module.exports.writeClientHello = writeClientHello;
