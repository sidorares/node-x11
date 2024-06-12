import { getAuthString, Cookie as AuthCookie } from "./auth";
import * as xutil from "./xutil";
import { UnpackStream } from "./unpackstream";

interface Visual {
  vid: number;
  class: number;
  bits_per_rgb: number;
  map_ent: string;
  red_mask: number;
  green_mask: number;
  blue_mask: number;
}

interface Depth {
  [key: string]: Visual;
}

interface Screen {
  root: number;
  default_colormap: number;
  white_pixel: number;
  black_pixel: number;
  input_masks: number;
  pixel_width: number;
  pixel_height: number;
  mm_width: number;
  mm_height: number;
  min_installed_maps: number;
  max_installed_maps: number;
  root_visual: number;
  root_depth: number;
  backing_stores: number;
  num_depths: number;
  depths: Depth[];
}

interface Display {
  x: number;
  major: number;
  minor: number;
  xlen: number;
  release: number;
  resource_base: number;
  resource_mask: number;
  motion_buffer_size: number;
  vlen: number;
  max_request_length: number;
  screen_num: number;
  format_num: number;
  image_byte_order: number;
  bitmap_bit_order: number;
  bitmap_scanline_unit: number;
  bitmap_scanline_pad: number;
  min_keycode: number;
  max_keycode: number;
  vendor: string;
  format: { [key: number]: { bits_per_pixel: number; scanline_pad: number } };
  screen: Screen[];
  rsrc_shift: number;
  rsrc_id: number;
}

function readVisuals(
  bl: UnpackStream,
  visuals: { [key: number]: Visual },
  n_visuals: number,
  cb: () => void,
): void {
  if (n_visuals == 0) {
    cb();
    return;
  }

  const visual: Visual = {} as Visual;
  bl.unpackTo(
    visual,
    [
      "L vid",
      "C class",
      "C bits_per_rgb",
      "S map_ent",
      "L red_mask",
      "L green_mask",
      "L blue_mask",
      "xxxx",
    ],
    function () {
      visuals[visual.vid] = visual;
      if (Object.keys(visuals).length == n_visuals) cb();
      else readVisuals(bl, visuals, n_visuals, cb);
    },
  );
}

function readDepths(
  bl: UnpackStream,
  display: Display,
  depths: Depth[],
  n_depths: number,
  cb: () => void,
  numParsedDepths: number = 0,
): void {
  if (n_depths == 0) {
    cb();
    return;
  }

  bl.unpack("CxSxxxx", function (res: [number, number]) {
    const dep = res[0];
    const n_visuals = res[1];
    const visuals: { [key: number]: Visual } = {};
    readVisuals(bl, visuals, n_visuals, function () {
      if (dep in depths) {
        for (const visual in visuals) {
          depths[dep][visual] = visuals[visual];
        }
      } else {
        depths[dep] = visuals;
      }
      const parsed = numParsedDepths + 1;
      if (parsed == n_depths) cb();
      else readDepths(bl, display, depths, n_depths, cb, parsed);
    });
  });
}

function readScreens(
  bl: UnpackStream,
  display: Display,
  cbDisplayReady: (err: Error | null, display: Display) => void,
): void {
  const scr: Screen = {} as Screen;
  bl.unpackTo(
    scr,
    [
      "L root",
      "L default_colormap",
      "L white_pixel",
      "L black_pixel",
      "L input_masks",
      "S pixel_width",
      "S pixel_height",
      "S mm_width",
      "S mm_height",
      "S min_installed_maps",
      "S max_installed_maps",
      "L root_visual",
      "C root_depth",
      "C backing_stores",
      "C root_depth",
      "C num_depths",
    ],
    function () {
      const depths: Depth[] = [];
      readDepths(bl, display, depths, scr.num_depths, function () {
        scr.depths = depths;
        delete scr.num_depths;
        display.screen.push(scr);

        if (display.screen.length == display.screen_num) {
          delete display.screen_num;
          cbDisplayReady(null, display);
          return;
        } else {
          readScreens(bl, display, cbDisplayReady);
        }
      });
    },
  );
}

function readServerHello(
  bl: UnpackStream,
  cb: (err: Error | null, display?: any) => void,
): void {
  bl.unpack("C", function (res: [number]) {
    if (res[0] == 0) {
      bl.unpack("Cxxxxxx", function (rlen: [number]) {
        bl.get(rlen[0], function (reason: Buffer) {
          const err = new Error() as Error & { message: string };
          err.message = "X server connection failed: " + reason.toString();
          cb(err);
        });
      });
      return;
    }

    const display: Display = {} as Display;
    bl.unpackTo(
      display,
      [
        "x",
        "S major",
        "S minor",
        "S xlen",
        "L release",
        "L resource_base",
        "L resource_mask",
        "L motion_buffer_size",
        "S vlen",
        "S max_request_length",
        "C screen_num",
        "C format_num",
        "C image_byte_order",
        "C bitmap_bit_order",
        "C bitmap_scanline_unit",
        "C bitmap_scanline_pad",
        "C min_keycode",
        "C max_keycode",
        "xxxx",
      ],
      function () {
        const pvlen = xutil.padded_length(display.vlen);

        let mask = display.resource_mask;
        display.rsrc_shift = 0;
        while (!((mask >> display.rsrc_shift) & 1)) display.rsrc_shift++;
        display.rsrc_id = 0;

        bl.get(pvlen, function (vendor: Buffer) {
          display.vendor = vendor.toString().substring(0, display.vlen);

          display.format = {};
          for (let i = 0; i < display.format_num; ++i) {
            bl.unpack("CCCxxxxx", function (fmt: [number, number, number]) {
              const depth = fmt[0];
              display.format[depth] = {
                bits_per_pixel: fmt[1],
                scanline_pad: fmt[2],
              };
              if (Object.keys(display.format).length == display.format_num) {
                delete display.format_num;
                display.screen = [];
                readScreens(bl, display, cb);
              }
            });
          }
        });
      },
    );
  });
}

function getByteOrder(): number {
  const isLittleEndian =
    new Uint32Array(new Uint8Array([1, 2, 3, 4]).buffer)[0] === 0x04030201;
  if (isLittleEndian) {
    return "l".charCodeAt(0);
  } else {
    return "B".charCodeAt(0);
  }
}

function writeClientHello(
  stream: any,
  displayNum: number,
  authHost: string,
  authFamily: string,
): void {
  getAuthString(
    displayNum.toString(),
    authHost,
    authFamily,
    function (err: Error | null, cookie: AuthCookie) {
      if (err) {
        throw err;
      }
      const byte_order = getByteOrder();
      const protocol_major = 11;
      const protocol_minor = 0;
      stream.pack("CxSSSSxxpp", [
        byte_order,
        protocol_major,
        protocol_minor,
        cookie.authName.length,
        cookie.authData.length,
        cookie.authName,
        cookie.authData,
      ]);
      stream.flush();
    },
  );
}

export { readServerHello, writeClientHello };
