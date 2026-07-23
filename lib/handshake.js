const getAuthString = require('./auth');
const xutil = require('./xutil');

function readVisuals(bl, visuals, n_visuals, cb)
{
    if (n_visuals == 0)
    {
        cb();
        return;
    }

    const visual = {};
    bl.unpackTo( visual,
    [
        'L vid',
        'C class',
        'C bits_per_rgb',
        'S map_ent',
        'L red_mask',
        'L green_mask',
        'L blue_mask',
        'xxxx'
    ],
    () => {
         const vid = visual.vid;
         // delete visual.vid;
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

         bl.unpack( 'CxSxxxx', res => {
             const dep = res[0];
             const n_visuals = res[1];
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

     // for (i=0; i < display.screen_num; ++i)
     {
         const scr = {};
         bl.unpackTo( scr,
         [
             'L root',
             'L default_colormap',
             'L white_pixel',
             'L black_pixel',
             'L input_masks',
             'S pixel_width',
             'S pixel_height',
             'S mm_width',
             'S mm_height',
             'S min_installed_maps',
             'S max_installed_maps',
             'L root_visual',
             'C root_depth',
             'C backing_stores',
             'C root_depth',
             'C num_depths'
         ],
         () => {
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

bl.unpack('C', res => {

     if (res[0] == 0)
     {
         // conection time error
         // unpack error
         bl.unpack('Cxxxxxx', rlen => {
             bl.get(rlen[0], reason => {
                 const err = new Error;
                 err.message = `X server connection failed: ${reason.toString()}`;
                 cb(err);
             });
         });
         // TODO: do we need to close stream from our side?
         // TODO: api to close source stream via attached unpackstream
         return;
     }

     const display = {};
     bl.unpackTo(
         display,
         [
          'x',
          'S major',
          'S minor',
          'S xlen',
          'L release',
          'L resource_base',
          'L resource_mask',
          'L motion_buffer_size',
          'S vlen',
          'S max_request_length',
          'C screen_num',
          'C format_num',
          'C image_byte_order',
          'C bitmap_bit_order',
          'C bitmap_scanline_unit',
          'C bitmap_scanline_pad',
          'C min_keycode',
          'C max_keycode',
          'xxxx'
         ],

         () => {
             const pvlen = xutil.padded_length(display.vlen);

             // setup data to generate resource id
             // TODO: cleaunup code here
             const mask = display.resource_mask;
             display.rsrc_shift = 0;
             while (!( (mask >> display.rsrc_shift) & 1) )
                 display.rsrc_shift++;
             display.rsrc_id = 0;

             bl.get(pvlen, vendor => {
                 display.vendor = vendor.toString().substr(0, display.vlen); // utf8 by default?

                 display.format = {};
                 for (let i=0; i < display.format_num; ++i)
                 {
                     bl.unpack('CCCxxxxx', fmt => {
                         const depth = fmt[0];
                         display.format[depth] = {};
                         display.format[depth].bits_per_pixel = fmt[1];
                         display.format[depth].scanline_pad = fmt[2];
                         if (Object.keys(display.format).length == display.format_num)
                         {
                             delete display.format_num;
                             display.screen = [];
                             readScreens(bl, display, cb);
                         }
                     });
                 }
             });
         }
     );
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

function writeClientHello(stream, displayNum, authHost, authFamily)
{
    getAuthString( displayNum, authHost, authFamily, (err, cookie) => {
        if (err) {
            throw err;
        }
        const byte_order = getByteOrder();
        const protocol_major = 11; // TODO: config? env?
        const protocol_minor = 0;
        stream.pack(
            'CxSSSSxxpp',
            [
            byte_order,
            protocol_major,
            protocol_minor,
            cookie.authName.length,
            cookie.authData.length,
            cookie.authName,
            cookie.authData
            ]
        );
        stream.flush();
    });
}

module.exports.readServerHello = readServerHello;
module.exports.writeClientHello = writeClientHello;
