// full list of event/error/request codes for all extensions:
// http://www.opensource.apple.com/source/X11server/X11server-106.7/kdrive/xorg-server-1.6.5-apple3/dix/protocol.txt

const xutil = require('./xutil');
const hexy = require('./hexy').hexy;
const coreReplies = require('./generated/core-replies');

const valueMask = {
    CreateWindow: {
        backgroundPixmap      : {
          mask: 0x00000001,
          format: 'L'
        },
        backgroundPixel       : {
          mask: 0x00000002,
          format: 'L'
        },
        borderPixmap          : {
          mask: 0x00000004,
          format: 'L'
        },
        borderPixel           : {
          mask: 0x00000008,
          format: 'L'
        },
        bitGravity            : {
          mask: 0x00000010,
          format: 'Cxxx'
        },
        winGravity            : {
          mask: 0x00000020,
          format: 'Cxxx'
        },
        backingStore          : {
          mask: 0x00000040,
          format: 'Cxxx'
        },
        backingPlanes         : {
          mask: 0x00000080,
          format: 'L'
        },
        backingPixel          : {
          mask: 0x00000100,
          format: 'L'
        },
        overrideRedirect      : {
          mask: 0x00000200,
          format: 'Cxxx'
        },
        saveUnder             : {
          mask: 0x00000400,
          format: 'Cxxx'
        },
        eventMask             : {
          mask: 0x00000800,
          format: 'L'
        },
        doNotPropagateMask    : {
          mask: 0x00001000,
          format: 'L'
        },
        colormap              : {
          mask: 0x00002000,
          format: 'L'
        },
        cursor                : {
          mask: 0x00004000,
          format: 'L'
        }
    },
    CreateGC: {
       'function'             : { // TODO: alias? _function?
          mask: 0x00000001,
          format: 'Cxxx'
        },
       planeMask              : {
          mask: 0x00000002,
          format: 'L'
        },
       foreground             : {
          mask: 0x00000004,
          format: 'L'
        },
       background             : {
          mask: 0x00000008,
          format: 'L'
        },
       lineWidth              : {
          mask: 0x00000010,
          format: 'Sxx'
        },
       lineStyle              : {
          mask: 0x00000020,
          format: 'Cxxx'
        },
       capStyle               : {
          mask: 0x00000040,
          format: 'Cxxx'
        },
       joinStyle              : {
          mask: 0x00000080,
          format: 'Cxxx'
        },
       fillStyle              : {
          mask: 0x00000100,
          format: 'Cxxx'
        },
       fillRule               : {
          mask: 0x00000200,
          format: 'Cxxx'
        },
       tile                   : {
          mask: 0x00000400,
          format: 'L'
        },
       stipple                : {
          mask: 0x00000800,
          format: 'L'
        },
       tileStippleXOrigin     : {
          mask: 0x00001000,
          format: 'sxx'
        },
       tileStippleYOrigin     : {
          mask: 0x00002000,
          format: 'sxx'
        },
       font                   : {
          mask: 0x00004000,
          format: 'L'
        },
       subwindowMode          : {
          mask: 0x00008000,
          format: 'Cxxx'
        },
       graphicsExposures      : {
          mask: 0x00010000,
          format: 'Cxxx'
        },
       clipXOrigin            : {
          mask: 0x00020000,
          format: 'Sxx'
        },
       clipYOrigin            : {
          mask: 0x00040000,
          format: 'Sxx'
        },
       clipMask               : {
          mask: 0x00080000,
          format: 'L'
        },
       dashOffset             : {
          mask: 0x00100000,
          format: 'Sxx'
        },
       dashes                 : {
          mask: 0x00200000,
          format: 'Cxxx'
        },
       arcMode                : {
          mask: 0x00400000,
          format: 'Cxxx'
        }
    },
    ConfigureWindow: {
      x                       : {
        mask: 0x000001,
        format: 'sxx'
      },
    	y                       : {
        mask: 0x000002,
        format: 'sxx'
      },
    	width                   : {
        mask: 0x000004,
        format: 'Sxx'
      },
    	height                  : {
        mask: 0x000008,
        format: 'Sxx'
      },
    	borderWidth             : {
        mask: 0x000010,
        format: 'Sxx'
      },
    	sibling                 : {
        mask: 0x000020,
        format: 'L'
      },
    	stackMode               : {
        mask: 0x000040,
        format: 'Cxxx'
      }
    }
};


const valueMaskName = {};
for (const req in valueMask) {
    const masks = valueMask[req];
    const names = valueMaskName[req] = {};
    for (const m in masks)
        names[masks[m].mask] = m;
}

function packValueMask(reqname, values)
{
    let bitmask = 0;
    const masksList = [];
    let format = '';
    const reqValueMask = valueMask[reqname];
    const reqValueMaskName = valueMaskName[reqname];

    if (!reqValueMask)
        throw new Error(`${reqname}: no value mask description`);

    for (const value in values)
    {
        const v = reqValueMask[value];
        if (v) {
            const valueBit = v.mask;
            if (!valueBit)
                throw new Error(`${reqname}: incorrect value param ${value}`);
            masksList.push(valueBit);
            bitmask |= valueBit;
        }
    }

    /* numeric sort */
    masksList.sort((a, b) => a - b);

    const args = [];
    for (let i=0, length=masksList.length;i<length;i++)
    {
        const value = masksList[i];
        const valueName = reqValueMaskName[value];
        format += reqValueMask[valueName].format
        args.push( values[valueName] );
    }
    return [format, bitmask, args]
}

/*

the way requests are described here

- outgoing request

   1) as function
   client.CreateWindow( params, params ) ->
       req = reqs.CreateWindow[0]( param, param );
       pack_stream.pack(req[0], req[1]);

   2) as array: [format, [opcode, request_length, additional known params]]

   client.MapWindow[0](id) ->
       req = reqs.MwpWindow;
       req[1].push(id);
       pack_stream.pack( req[0], req[1] );

- reply

*/

const templates = {
   CreateWindow: [
       // create request packet - function OR format string
       (
           id,
           parentId,
           x,
           y,
           width,
           height,
           borderWidth,
           depth,
           _class,
           visual,
           values
       ) => {

           if (borderWidth === undefined)
               borderWidth = 0;
           if (depth === undefined)
               depth = 0;
           if (_class === undefined)
               _class = 0;
           if (visual === undefined)
               visual = 0;
           if (values === undefined)
               values = {}

           let format = 'CCSLLssSSSSLL';

           // TODO: slice from function arguments?

           // TODO: the code is a little bit mess
           // additional values need to be packed in the following way:
           // bitmask (bytes #24 to #31 in the packet) - 32 bit indicating what adittional arguments we supply
           // values list (bytes #32 .. #32+4*num_values) in order of corresponding bits TODO: it's actually not 4*num. Some values are 4b ytes, some - 1 byte

           const vals = packValueMask('CreateWindow', values);
           const packetLength = 8 + (values ? vals[2].length : 0);
           let args = [1, depth, packetLength, id, parentId, x, y, width, height, borderWidth, _class, visual];
           format += vals[0];
           args.push(vals[1]);
           args = args.concat(vals[2]);
           return [format, args];
       }

   ],

   ChangeWindowAttributes:[
       (wid, values) => {
           let format = 'CxSLSxx';
           const vals = packValueMask('CreateWindow', values);
           const packetLength = 3 + (values ? vals[2].length : 0);
           let args = [2, packetLength, wid, vals[1]];
           const valArr = vals[2];
           format += vals[0];
           args = args.concat(valArr);
           return [format, args];
        }
   ],

   GetWindowAttributes: [
       ['CxSL', [3, 2]],
       coreReplies.GetWindowAttributes
   ],

   DestroyWindow: [
       [ 'CxSL', [4, 2] ]
   ],

   ChangeSaveSet: [
      (isInsert, wid) => [ 'CCSL', [6, (isInsert ? 0 : 1), 2, wid]]
   ],

   // wid, newParentId, x, y
   ReparentWindow: [
       [ 'CxSLLss', [7, 4]]
   ],

   MapWindow: [
       // 8 - opcode, 2 - length, wid added as parameter
       [ 'CxSL', [8, 2] ]
   ],

   UnmapWindow: [
       [ 'CxSL', [10, 2] ]
   ],

   ConfigureWindow: [
        /*
         * options : {
         *     x : x_value,
         *     y : y_value,
         *     width : width_value,
         *     height : height_value,
         *     borderWidth : borderWidth_value,
         *     sibling : sibling_value
         * }
         */
        (win, options) => {
            const vals = packValueMask('ConfigureWindow', options);
            const format = `CxSLSxx${vals[0]}`;
            let args = [12, vals[2].length + 3, win, vals[1]];
            args = args.concat(vals[2]);
            return [format, args];
        }
   ],

   ResizeWindow: [
        (win, width, height) => module.exports.ConfigureWindow[0](win, { width, height })
   ],

   MoveWindow: [
        (win, x, y) => module.exports.ConfigureWindow[0](win, { x, y })
   ],

   MoveResizeWindow: [
        (win, x, y, width, height) => module.exports.ConfigureWindow[0](win, { x, y, width, height })
   ],

   RaiseWindow: [
        win => module.exports.ConfigureWindow[0](win, { stackMode : 0 })
   ],

   LowerWindow: [
        win => module.exports.ConfigureWindow[0](win, { stackMode : 1 })
   ],

   QueryTree: [
        ['CxSL', [15, 2]],

        buf => {
            const tree = {};
            tree.root = buf.readUInt32LE(0);
            tree.parent = buf.readUInt32LE(4);
            const nChildren = buf.readUInt16LE(8);
            tree.children = [];
            for (let i = 0; i < nChildren; ++i)
                tree.children.push(buf.readUInt32LE(24 + i * 4));
            return tree;
        }
   ],

   // opcode 16
   InternAtom: [
       (returnOnlyIfExist, value) => {
           const padded = xutil.padded_string(value);
           return ['CCSSxxa', [16, returnOnlyIfExist ? 1 : 0, 2+padded.length/4, value.length, padded] ];
       },

       function(buf, seq_num) {
           const res = buf.readUInt32LE(0);
           const pending_atom = this.pending_atoms[seq_num];
           if (!this.atoms[pending_atom]) {
               this.atoms[pending_atom] = res;
               this.atom_names[res] = pending_atom;
           }

           delete this.pending_atoms[seq_num];
           return res;
       }
   ],

   GetAtomName: [
       [ 'CxSL', [17, 2] ],
       function(buf, seq_num) {
          const nameLen = buf.readUInt16LE(0);
          // Atom name starts at 24th byte in the body buffer
          const name = xutil.readLatin1(buf, 24, nameLen);
          const pending_atom = this.pending_atoms[seq_num];
          if (!this.atoms[pending_atom]) {
              this.atom_names[pending_atom] = name;
              this.atoms[name] = pending_atom;
          }

          delete this.pending_atoms[seq_num];
          return name;
       }
   ],

   ChangeProperty: [
       // mode: 0 replace, 1 prepend, 2 append
       // format: 8/16/32
       (mode, wid, name, type, units, data) => {
          const padded4 = (data.length + 3) >> 2;
          const pad = Buffer.alloc( (padded4<<2) - data.length);
          const format = 'CCSLLLCxxxLaa';
          const requestLength = 6 + padded4;
          const dataLenInFormatUnits = data.length / (units >> 3);
          return [format, [18, mode, requestLength, wid, name, type, units, dataLenInFormatUnits, data, pad] ];
       }
   ],

   // TODO: test
   DeleteProperty: [
       (wid, prop) => [ 'CxSLL', [19, 3, wid, prop] ]
   ],

   GetProperty: [

       (
           del,
           wid,
           name,
           type,
           longOffset,
           //  - offest and maxLength in 4-byte units
           longLength
       ) => [ 'CCSLLLLL', [20, del, 6, wid, name, type, longOffset, longLength ] ],

       (buf, format) => {
           const prop = {};
           prop.type = buf.readUInt32LE(0);
           prop.bytesAfter = buf.readUInt32LE(4);
           const len = buf.readUInt32LE(8) * (format >> 3);
           prop.data = buf.slice(24, 24 + len);
           return prop;
       }
   ],

   ListProperties: [

       wid => ['CxSL', [21, 2, wid]],

       buf => {
          const n = buf.readUInt16LE(0);
          const atoms = [];
          for (let i = 0; i < n; ++i)
             atoms.push(buf.readUInt32LE(24 + 4 * i));
          return atoms;
       }
   ],

   SetSelectionOwner: [
      (owner, selection, time) => {
          if (!time)
              time = 0; // current time
          return ['CxSLLL', [22, 4, owner, selection, time]];
      }
   ],

   GetSelectionOwner: [
      selection => ['CxSL', [23, 2, selection]],

      buf => buf.readUInt32LE(0)
   ],

   ConvertSelection: [
      (requestor, selection, target, property, time) => {
          if (!time)
              time = 0;
          return ['CxSLLLLL', [24, 6, requestor, selection, target, property, time]];
      }
   ],

   SendEvent: [

       (destination, propagate, eventMask, eventRawData) => [ 'CCSLLa', [25, propagate, 11, destination, eventMask, eventRawData] ]
   ],

   GrabPointer: [
       (wid, ownerEvents, mask, pointerMode, keybMode, confineTo, cursor, time) => [ 'CCSLSCCLLL', [ 26, ownerEvents, 6, wid, mask, pointerMode, keybMode,
                                confineTo, cursor, time] ],
       (buf, status) => status
   ],

   UngrabPointer: [
       time => [ 'CxSL', [ 27, 2, time] ]
   ],

   GrabButton: [
       (
           wid,
           ownerEvents,
           mask,
           pointerMode,
           keybMode,
           confineTo,
           cursor,
           button,
           modifiers
       ) => [ 'CCSLSCCLLCxS', [ 28, ownerEvents, 6, wid, mask, pointerMode, keybMode, confineTo,
                                  cursor, button, modifiers ] ]
   ],

   UngrabButton: [
       (wid, button, modifiers) => [ 'CCSLSxx', [ 29, button, 3, wid, modifiers ] ]
   ],

   ChangeActivePointerGrab: [
       (cursor, time, mask) => [ 'CxSLLSxx', [ 30, 4, cursor, time, mask ] ]
   ],

   GrabKeyboard: [
       (wid, ownerEvents, time, pointerMode, keybMode) => [ 'CCSLLCCxx', [ 31, ownerEvents, 4, wid, time, pointerMode, keybMode ] ],
       (buf, status) => status
   ],

   UngrabKeyboard: [
       time => [ 'CxSL', [ 32, 2, time ] ]
   ],

   GrabKey: [
       (wid, ownerEvents, modifiers, key, pointerMode, keybMode) => [ 'CCSLSCCCxxx', [ 33, ownerEvents, 4, wid, modifiers, key, pointerMode, keybMode ] ]
   ],

   UngrabKey: [
       (wid, key, modifiers) => [ 'CCSLSxx', [ 34, key, 3, wid, modifiers ] ]
   ],
   
   AllowEvents: [
       (mode, ts) => [ 'CCSL', [ 35, mode, 2, ts ] ]
   ],

   GrabServer: [
       [ 'CxS', [36, 1]]
   ],

   UngrabServer: [
       [ 'CxS', [37, 1]]
   ],

   QueryPointer: [
       [ 'CxSL', [38, 2] ],
       coreReplies.QueryPointer
   ],

   TranslateCoordinates: [
       (srcWid, dstWid, srcX, srcY) => [ 'CxSLLSS', [ 40, 4, srcWid, dstWid, srcX, srcY ] ],
       coreReplies.TranslateCoordinates
   ],

   SetInputFocus: [

      (
          wid,
          // revertTo: 0 - None, 1 - PointerRoot, 2 - Parent
          revertTo
      ) => [ 'CCSLL', [42, revertTo, 3, wid, 0] ]
   ],

   GetInputFocus: [
       () => [ 'CxS', [ 43, 1 ] ],
       coreReplies.GetInputFocus
   ],

   WarpPointer: [

      (srcWin, dstWin, srcX, srcY, srcWidth, srcHeight, dstX, dstY) => [ 'CxSLLssSSss', [41, 6, srcWin, dstWin, srcX, srcY, srcWidth, srcHeight, dstX, dstY] ]
   ],

   ListFonts: [
      (pattern, max) => {
          const req_len = 2+xutil.padded_length(pattern.length)/4;
          return [ 'CxSSSp', [49, req_len, max, pattern.length, pattern] ];
      },

      buf => xutil.readStringList(buf, 24)
   ],

   CreatePixmap: [
       (pid, drawable, depth, width, height) => [ 'CCSLLSS', [53, depth, 4, pid, drawable, width, height] ]
   ],

   FreePixmap: [
      pixmap => [ 'CxSL', [54, 2, pixmap] ]
   ],

   CreateCursor: [
       (cid, source, mask, foreRGB, backRGB, x, y) => {
          foreR = foreRGB.R
          foreG = foreRGB.G
          foreB = foreRGB.B

          backR = backRGB.R
          backG = backRGB.G
          backB = backRGB.B
          return [ 'CxSLLLSSSSSSSS', [93, 8, cid, source, mask, foreR, foreG, foreB, backR, backG, backB, x, y] ];
       }
   ],

   // opcode 55
   CreateGC: [
       (cid, drawable, values) => {
           let format = 'CxSLLL';
           const vals = packValueMask('CreateGC', values);
           const packetLength = 4 + (values ? vals[2].length : 0);
           let args = [55, packetLength, cid, drawable];
           format += vals[0]
           args.push(vals[1]);     // values bitmask
           args = args.concat(vals[2])
           return [format, args];
        }
   ],

   ChangeGC: [
       (cid, values) => {
           let format = 'CxSLL';
           const vals = packValueMask('CreateGC', values);
           const packetLength = 3 + (values ? vals[2].length : 0);
           let args = [56, packetLength, cid];
           format += vals[0]
           args.push(vals[1]);     // values bitmask
           args = args.concat(vals[2])
           return [format, args];
        }
   ],

   ClearArea: [
       (wid, x, y, width, height, exposures) => [ 'CCSLssSS', [61, exposures, 4, wid, x, y, width, height] ]
   ],

   //
   CopyArea: [
       (srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height) => [ 'CxSLLLssssSS', [62, 7, srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height] ]
   ],


   PolyPoint: [
       (coordMode, drawable, gc, points) => {
          let format = 'CCSLL';
          const args = [64, coordMode, 3+points.length/2, drawable, gc];
          for (let i=0; i < points.length; ++i)
          {
              format += 'S';
              args.push(points[i]);
          }
          return [format, args];
       }
   ],

   PolyLine: [
       // TODO: remove copy-paste - exectly same as PolyPoint, only differ with opcode
       (coordMode, drawable, gc, points) => {
          let format = 'CCSLL';
          const args = [65, coordMode, 3+points.length/2, drawable, gc];
          for (let i=0; i < points.length; ++i)
          {
              format += 'S';
              args.push(points[i]);
          }
          return [format, args];
       }

   ],

   PolyFillRectangle: [
      (drawable, gc, coords) => { // x1, y1, w1, h1, x2, y2, w2, h2...
          let format = 'CxSLL';
          const numrects4bytes = coords.length/2;
          const args = [70, 3+numrects4bytes, drawable, gc];
          for (let i=0; i < coords.length; ++i)
          {
              format += 'S';
              args.push(coords[i]);
          }
          return [format, args];
      }
   ],

   PolyFillArc: [
      (drawable, gc, coords) => { // x1, y1, w1, h1, a11, a12, ...
          let format = 'CxSLL';
          const numrects4bytes = coords.length/2;
          const args = [71, 3+numrects4bytes, drawable, gc];
          for (let i=0; i < coords.length; ++i)
          {
              format += 'S';
              args.push(coords[i]);
          }
          return [format, args];
      }
   ],

   PutImage: [
      // format:  0 - Bitmap, 1 - XYPixmap, 2 - ZPixmap
      (format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data) => {
          const padded = xutil.padded_length(data.length);
          const reqLen = 6 + padded/4; // (length + 3) >> 2 ???
          const padLength = padded - data.length;
          const pad = Buffer.alloc(padLength); // TODO: new pack format 'X' - skip amount of bytes supplied in numerical argument

          // TODO: move code to calculate reqLength and use BigReq if needed outside of corereq.js
          // NOTE: big req is used here (first 'L' in format, 0 and +1 in params), won't work if not enabled
          return [ 'CCSLLLSSssCCxxaa', [72, format, 0, 1+reqLen, drawable, gc, width, height, dstX, dstY, leftPad, depth, data, pad]];
      }
   ],

   GetImage: [
       (format, drawable, x, y, width, height, planeMask) => [ 'CCSLssSSL', [73, format, 5, drawable, x, y, width, height, planeMask]],
       (buf, depth) => ({
           depth,
           visualId: buf.readUInt32LE(0),
           data: buf.slice(24)
       })
   ],

   PolyText8: [
       (drawable, gc, x, y, items) => {
          let format = 'CxSLLss';
          const numItems = items.length;
          let reqLen = 16;
          const args = [74, 0, drawable, gc, x, y];
          for (let i=0; i < numItems; ++i)
          {
              const it = items[i];
              if (typeof it == 'string')
              {
                  if (it.length > 254) // TODO: split string in set of items
                      throw 'not supported yet';
                  format += 'CCa';
                  args.push(it.length);
                  args.push(0); // delta???
                  args.push(it);
                  reqLen += 2 + it.length;
              } else {
                  throw 'not supported yet';
              }
          }
          const len4 = xutil.padded_length(reqLen)/4;
          const padLen = len4*4 - reqLen;
          args[1] = len4; // set request length to calculated value
          let pad = '';
          for (let i=0; i < padLen; ++i)
             pad += String.fromCharCode(0);
          format += 'a';
          args.push(pad);
          return [format, args];
       }
   ],

   CreateColormap:
   [
       (cmid, wid, vid, alloc) => ['CCSLLL', [78, alloc, 4, cmid, wid, vid]]
   ],

   AllocColor: [
       [ 'CxSLSSSxx', [84, 4] ], // params: colormap, red, green, blue

       buf => {
           // SSSxL: red, green, blue, pad, pixel — note green/blue order matches prior API
           const color = {};
           color.red   = buf.readUInt16LE(0);
           color.blue  = buf.readUInt16LE(2);  // historically named blue but wire is green
           color.green = buf.readUInt16LE(4);  // historically named green but wire is blue
           color.pixel = buf.readUInt32LE(8) >> 8; // 3 first bytes contain RGB value in response
           return color;
       }
   ],

   QueryExtension: [
       name => {
           const padded = xutil.padded_string(name);
           return ['CxSSxxa', [98, 2+padded.length/4, name.length, padded] ];
       },

       buf => coreReplies.QueryExtension(buf)
   ],

   ListExtensions: [
       [ 'CxS', [99, 1] ],

       buf => xutil.readStringList(buf, 24)
   ],

   GetKeyboardMapping: [
       (startCode, num) => [ 'CxSCCxx', [101, 2, startCode, num] ],
       (buff, listLength) => {
           const res = [];
           const rowBytes = 4 * listLength;
           for (let offset = 24; offset < buff.length - rowBytes; offset += rowBytes) {
                const row = [];
                for (let i = 0; i < listLength; ++i)
                    row.push(buff.readUInt32LE(offset + i * 4));
                res.push(row);
           }
           return res;
       }
   ],

	GetGeometry: [
		drawable => ['CxSL', [14, 2, drawable]],
		coreReplies.GetGeometry
   ],

   KillClient: [
       resource => [ 'CxSL', [113, 2, resource] ]
   ],

   SetScreenSaver: [
       (timeout, interval, preferBlanking, allowExposures) => [ 'CxSssCCxx', [107, 3, timeout, interval, preferBlanking, allowExposures]]
   ],
   
   Bell: [
       percent => ["CxCs",[108,1]]
   ],

   ForceScreenSaver: [
       activate => [ 'CCS', [115, activate?1:0, 1] ]
   ]
};

templates.KillKlient = templates.KillClient;

module.exports = templates;
