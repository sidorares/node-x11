// full list of event/error/request codes for all extensions:
// http://www.opensource.apple.com/source/X11server/X11server-106.7/kdrive/xorg-server-1.6.5-apple3/dix/protocol.txt

const xutil = require('./xutil');
const coreReplies = require('./generated/core-replies');

const valueMask = {
    CreateWindow: {
        backgroundPixmap      : {
          mask: 0x00000001,
          kind: 'L'
        },
        backgroundPixel       : {
          mask: 0x00000002,
          kind: 'L'
        },
        borderPixmap          : {
          mask: 0x00000004,
          kind: 'L'
        },
        borderPixel           : {
          mask: 0x00000008,
          kind: 'L'
        },
        bitGravity            : {
          mask: 0x00000010,
          kind: 'C'
        },
        winGravity            : {
          mask: 0x00000020,
          kind: 'C'
        },
        backingStore          : {
          mask: 0x00000040,
          kind: 'C'
        },
        backingPlanes         : {
          mask: 0x00000080,
          kind: 'L'
        },
        backingPixel          : {
          mask: 0x00000100,
          kind: 'L'
        },
        overrideRedirect      : {
          mask: 0x00000200,
          kind: 'C'
        },
        saveUnder             : {
          mask: 0x00000400,
          kind: 'C'
        },
        eventMask             : {
          mask: 0x00000800,
          kind: 'L'
        },
        doNotPropagateMask    : {
          mask: 0x00001000,
          kind: 'L'
        },
        colormap              : {
          mask: 0x00002000,
          kind: 'L'
        },
        cursor                : {
          mask: 0x00004000,
          kind: 'L'
        }
    },
    CreateGC: {
       'function'             : { // TODO: alias? _function?
          mask: 0x00000001,
          kind: 'C'
        },
       planeMask              : {
          mask: 0x00000002,
          kind: 'L'
        },
       foreground             : {
          mask: 0x00000004,
          kind: 'L'
        },
       background             : {
          mask: 0x00000008,
          kind: 'L'
        },
       lineWidth              : {
          mask: 0x00000010,
          kind: 'S'
        },
       lineStyle              : {
          mask: 0x00000020,
          kind: 'C'
        },
       capStyle               : {
          mask: 0x00000040,
          kind: 'C'
        },
       joinStyle              : {
          mask: 0x00000080,
          kind: 'C'
        },
       fillStyle              : {
          mask: 0x00000100,
          kind: 'C'
        },
       fillRule               : {
          mask: 0x00000200,
          kind: 'C'
        },
       tile                   : {
          mask: 0x00000400,
          kind: 'L'
        },
       stipple                : {
          mask: 0x00000800,
          kind: 'L'
        },
       tileStippleXOrigin     : {
          mask: 0x00001000,
          kind: 's'
        },
       tileStippleYOrigin     : {
          mask: 0x00002000,
          kind: 's'
        },
       font                   : {
          mask: 0x00004000,
          kind: 'L'
        },
       subwindowMode          : {
          mask: 0x00008000,
          kind: 'C'
        },
       graphicsExposures      : {
          mask: 0x00010000,
          kind: 'C'
        },
       clipXOrigin            : {
          mask: 0x00020000,
          kind: 'S'
        },
       clipYOrigin            : {
          mask: 0x00040000,
          kind: 'S'
        },
       clipMask               : {
          mask: 0x00080000,
          kind: 'L'
        },
       dashOffset             : {
          mask: 0x00100000,
          kind: 'S'
        },
       dashes                 : {
          mask: 0x00200000,
          kind: 'C'
        },
       arcMode                : {
          mask: 0x00400000,
          kind: 'C'
        }
    },
    ConfigureWindow: {
      x                       : {
        mask: 0x000001,
        kind: 's'
      },
    	y                       : {
        mask: 0x000002,
        kind: 's'
      },
    	width                   : {
        mask: 0x000004,
        kind: 'S'
      },
    	height                  : {
        mask: 0x000008,
        kind: 'S'
      },
    	borderWidth             : {
        mask: 0x000010,
        kind: 'S'
      },
    	sibling                 : {
        mask: 0x000020,
        kind: 'L'
      },
    	stackMode               : {
        mask: 0x000040,
        kind: 'C'
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

function writeValueSlot(buf, offset, kind, value)
{
    switch (kind) {
    case 'L':
        buf.writeUInt32LE(value >>> 0, offset);
        break;
    case 'C':
        buf[offset] = value & 0xff;
        break;
    case 'S':
        buf.writeUInt16LE(value & 0xffff, offset);
        break;
    case 's':
        buf.writeInt16LE(value, offset);
        break;
    default:
        throw new Error(`unknown value kind ${kind}`);
    }
}

function packValueMask(reqname, values)
{
    let bitmask = 0;
    const masksList = [];
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

    const valuesBuf = Buffer.alloc(4 * masksList.length);
    for (let i = 0, length = masksList.length; i < length; i++)
    {
        const value = masksList[i];
        const valueName = reqValueMaskName[value];
        writeValueSlot(valuesBuf, i * 4, reqValueMask[valueName].kind, values[valueName]);
    }
    return { bitmask, valuesBuf };
}

function packCxSL(opcode, length, id)
{
    const b = Buffer.alloc(8);
    b[0] = opcode;
    b.writeUInt16LE(length, 2);
    b.writeUInt32LE(id >>> 0, 4);
    return b;
}

function packCxS(opcode, length)
{
    const b = Buffer.alloc(4);
    b[0] = opcode;
    b.writeUInt16LE(length, 2);
    return b;
}

function packCCSL(opcode, byte1, length, id)
{
    const b = Buffer.alloc(8);
    b[0] = opcode;
    b[1] = byte1;
    b.writeUInt16LE(length, 2);
    b.writeUInt32LE(id >>> 0, 4);
    return b;
}

function packUInt16List(opcode, lengthPrefix, drawable, gc, coords)
{
    const b = Buffer.alloc(12 + 2 * coords.length);
    b[0] = opcode;
    b.writeUInt16LE(lengthPrefix + coords.length / 2, 2);
    b.writeUInt32LE(drawable >>> 0, 4);
    b.writeUInt32LE(gc >>> 0, 8);
    for (let i = 0; i < coords.length; ++i)
        b.writeUInt16LE(coords[i] & 0xffff, 12 + i * 2);
    return b;
}

/*

the way requests are described here

- outgoing request

   1) as function returning a Buffer (Buffer.alloc + writeUInt/writeInt/copy)

   client.CreateWindow( params, params ) ->
       packet = reqs.CreateWindow[0]( param, param );
       pack_stream.put(packet);

   2) as function taking remaining call args (formerly [format, [opcode, len, ...]])

   client.MapWindow(id) ->
       packet = reqs.MapWindow[0](id);
       pack_stream.put(packet);

- reply: optional second element, unpack function unchanged

*/

const templates = {
   CreateWindow: [
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
               values = {};

           const vals = packValueMask('CreateWindow', values);
           const nValues = vals.valuesBuf.length / 4;
           const packetLength = 8 + nValues;
           const b = Buffer.alloc(32 + vals.valuesBuf.length);
           b[0] = 1;
           b[1] = depth;
           b.writeUInt16LE(packetLength, 2);
           b.writeUInt32LE(id >>> 0, 4);
           b.writeUInt32LE(parentId >>> 0, 8);
           b.writeInt16LE(x, 12);
           b.writeInt16LE(y, 14);
           b.writeUInt16LE(width, 16);
           b.writeUInt16LE(height, 18);
           b.writeUInt16LE(borderWidth, 20);
           b.writeUInt16LE(_class, 22);
           b.writeUInt32LE(visual >>> 0, 24);
           b.writeUInt32LE(vals.bitmask >>> 0, 28);
           vals.valuesBuf.copy(b, 32);
           return b;
       }

   ],

   ChangeWindowAttributes:[
       (wid, values) => {
           const vals = packValueMask('CreateWindow', values);
           const nValues = vals.valuesBuf.length / 4;
           const packetLength = 3 + nValues;
           const b = Buffer.alloc(12 + vals.valuesBuf.length);
           b[0] = 2;
           b.writeUInt16LE(packetLength, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt16LE(vals.bitmask, 8);
           vals.valuesBuf.copy(b, 12);
           return b;
        }
   ],

   GetWindowAttributes: [
       wid => packCxSL(3, 2, wid),
       coreReplies.GetWindowAttributes
   ],

   DestroyWindow: [
       wid => packCxSL(4, 2, wid)
   ],

   ChangeSaveSet: [
      (isInsert, wid) => packCCSL(6, isInsert ? 0 : 1, 2, wid)
   ],

   // wid, newParentId, x, y
   ReparentWindow: [
       (wid, newParentId, x, y) => {
           const b = Buffer.alloc(16);
           b[0] = 7;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt32LE(newParentId >>> 0, 8);
           b.writeInt16LE(x, 12);
           b.writeInt16LE(y, 14);
           return b;
       }
   ],

   MapWindow: [
       wid => packCxSL(8, 2, wid)
   ],

   UnmapWindow: [
       wid => packCxSL(10, 2, wid)
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
            const nValues = vals.valuesBuf.length / 4;
            const b = Buffer.alloc(12 + vals.valuesBuf.length);
            b[0] = 12;
            b.writeUInt16LE(nValues + 3, 2);
            b.writeUInt32LE(win >>> 0, 4);
            b.writeUInt16LE(vals.bitmask, 8);
            vals.valuesBuf.copy(b, 12);
            return b;
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
        wid => packCxSL(15, 2, wid),

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
           const b = Buffer.alloc(8 + padded.length);
           b[0] = 16;
           b[1] = returnOnlyIfExist ? 1 : 0;
           b.writeUInt16LE(2 + padded.length / 4, 2);
           b.writeUInt16LE(value.length, 4);
           padded.copy(b, 8);
           return b;
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
       atom => packCxSL(17, 2, atom),
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
          let payload;
          if (Buffer.isBuffer(data))
              payload = data;
          else if (Array.isArray(data))
              payload = Buffer.from(data);
          else
              payload = Buffer.from(String(data), 'latin1');

          const padded4 = (payload.length + 3) >> 2;
          const padLen = (padded4 << 2) - payload.length;
          const requestLength = 6 + padded4;
          const dataLenInFormatUnits = payload.length / (units >> 3);
          const b = Buffer.alloc(24 + payload.length + padLen);
          b[0] = 18;
          b[1] = mode;
          b.writeUInt16LE(requestLength, 2);
          b.writeUInt32LE(wid >>> 0, 4);
          b.writeUInt32LE(name >>> 0, 8);
          b.writeUInt32LE(type >>> 0, 12);
          b[16] = units;
          b.writeUInt32LE(dataLenInFormatUnits >>> 0, 20);
          payload.copy(b, 24);
          return b;
       }
   ],

   // TODO: test
   DeleteProperty: [
       (wid, prop) => {
           const b = Buffer.alloc(12);
           b[0] = 19;
           b.writeUInt16LE(3, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt32LE(prop >>> 0, 8);
           return b;
       }
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
       ) => {
           const b = Buffer.alloc(24);
           b[0] = 20;
           b[1] = del;
           b.writeUInt16LE(6, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt32LE(name >>> 0, 8);
           b.writeUInt32LE(type >>> 0, 12);
           b.writeUInt32LE(longOffset >>> 0, 16);
           b.writeUInt32LE(longLength >>> 0, 20);
           return b;
       },

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

       wid => packCxSL(21, 2, wid),

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
          const b = Buffer.alloc(16);
          b[0] = 22;
          b.writeUInt16LE(4, 2);
          b.writeUInt32LE(owner >>> 0, 4);
          b.writeUInt32LE(selection >>> 0, 8);
          b.writeUInt32LE(time >>> 0, 12);
          return b;
      }
   ],

   GetSelectionOwner: [
      selection => packCxSL(23, 2, selection),

      buf => buf.readUInt32LE(0)
   ],

   ConvertSelection: [
      (requestor, selection, target, property, time) => {
          if (!time)
              time = 0;
          const b = Buffer.alloc(24);
          b[0] = 24;
          b.writeUInt16LE(6, 2);
          b.writeUInt32LE(requestor >>> 0, 4);
          b.writeUInt32LE(selection >>> 0, 8);
          b.writeUInt32LE(target >>> 0, 12);
          b.writeUInt32LE(property >>> 0, 16);
          b.writeUInt32LE(time >>> 0, 20);
          return b;
      }
   ],

   SendEvent: [

       (destination, propagate, eventMask, eventRawData) => {
           const b = Buffer.alloc(12 + eventRawData.length);
           b[0] = 25;
           b[1] = propagate;
           b.writeUInt16LE(11, 2);
           b.writeUInt32LE(destination >>> 0, 4);
           b.writeUInt32LE(eventMask >>> 0, 8);
           eventRawData.copy(b, 12);
           return b;
       }
   ],

   GrabPointer: [
       (wid, ownerEvents, mask, pointerMode, keybMode, confineTo, cursor, time) => {
           const b = Buffer.alloc(24);
           b[0] = 26;
           b[1] = ownerEvents;
           b.writeUInt16LE(6, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt16LE(mask, 8);
           b[10] = pointerMode;
           b[11] = keybMode;
           b.writeUInt32LE(confineTo >>> 0, 12);
           b.writeUInt32LE(cursor >>> 0, 16);
           b.writeUInt32LE(time >>> 0, 20);
           return b;
       },
       (buf, status) => status
   ],

   UngrabPointer: [
       time => packCxSL(27, 2, time)
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
       ) => {
           const b = Buffer.alloc(24);
           b[0] = 28;
           b[1] = ownerEvents;
           b.writeUInt16LE(6, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt16LE(mask, 8);
           b[10] = pointerMode;
           b[11] = keybMode;
           b.writeUInt32LE(confineTo >>> 0, 12);
           b.writeUInt32LE(cursor >>> 0, 16);
           b[20] = button;
           b.writeUInt16LE(modifiers, 22);
           return b;
       }
   ],

   UngrabButton: [
       (wid, button, modifiers) => {
           const b = Buffer.alloc(12);
           b[0] = 29;
           b[1] = button;
           b.writeUInt16LE(3, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt16LE(modifiers, 8);
           return b;
       }
   ],

   ChangeActivePointerGrab: [
       (cursor, time, mask) => {
           const b = Buffer.alloc(16);
           b[0] = 30;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(cursor >>> 0, 4);
           b.writeUInt32LE(time >>> 0, 8);
           b.writeUInt16LE(mask, 12);
           return b;
       }
   ],

   GrabKeyboard: [
       (wid, ownerEvents, time, pointerMode, keybMode) => {
           const b = Buffer.alloc(16);
           b[0] = 31;
           b[1] = ownerEvents;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt32LE(time >>> 0, 8);
           b[10] = pointerMode;
           b[11] = keybMode;
           return b;
       },
       (buf, status) => status
   ],

   UngrabKeyboard: [
       time => packCxSL(32, 2, time)
   ],

   GrabKey: [
       (wid, ownerEvents, modifiers, key, pointerMode, keybMode) => {
           const b = Buffer.alloc(16);
           b[0] = 33;
           b[1] = ownerEvents;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt16LE(modifiers, 8);
           b[10] = key;
           b[11] = pointerMode;
           b[12] = keybMode;
           return b;
       }
   ],

   UngrabKey: [
       (wid, key, modifiers) => {
           const b = Buffer.alloc(12);
           b[0] = 34;
           b[1] = key;
           b.writeUInt16LE(3, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt16LE(modifiers, 8);
           return b;
       }
   ],

   AllowEvents: [
       (mode, ts) => packCCSL(35, mode, 2, ts)
   ],

   GrabServer: [
       () => packCxS(36, 1)
   ],

   UngrabServer: [
       () => packCxS(37, 1)
   ],

   QueryPointer: [
       wid => packCxSL(38, 2, wid),
       coreReplies.QueryPointer
   ],

   TranslateCoordinates: [
       (srcWid, dstWid, srcX, srcY) => {
           const b = Buffer.alloc(16);
           b[0] = 40;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(srcWid >>> 0, 4);
           b.writeUInt32LE(dstWid >>> 0, 8);
           b.writeInt16LE(srcX, 12);
           b.writeInt16LE(srcY, 14);
           return b;
       },
       coreReplies.TranslateCoordinates
   ],

   SetInputFocus: [

      (
          wid,
          // revertTo: 0 - None, 1 - PointerRoot, 2 - Parent
          revertTo
      ) => {
          const b = Buffer.alloc(12);
          b[0] = 42;
          b[1] = revertTo;
          b.writeUInt16LE(3, 2);
          b.writeUInt32LE(wid >>> 0, 4);
          return b;
      }
   ],

   GetInputFocus: [
       () => packCxS(43, 1),
       coreReplies.GetInputFocus
   ],

   WarpPointer: [

      (srcWin, dstWin, srcX, srcY, srcWidth, srcHeight, dstX, dstY) => {
          const b = Buffer.alloc(24);
          b[0] = 41;
          b.writeUInt16LE(6, 2);
          b.writeUInt32LE(srcWin >>> 0, 4);
          b.writeUInt32LE(dstWin >>> 0, 8);
          b.writeInt16LE(srcX, 12);
          b.writeInt16LE(srcY, 14);
          b.writeUInt16LE(srcWidth, 16);
          b.writeUInt16LE(srcHeight, 18);
          b.writeInt16LE(dstX, 20);
          b.writeInt16LE(dstY, 22);
          return b;
      }
   ],

   ListFonts: [
      (pattern, max) => {
          const padded = xutil.padded_string(pattern);
          const reqLen = 2 + padded.length / 4;
          const b = Buffer.alloc(8 + padded.length);
          b[0] = 49;
          b.writeUInt16LE(reqLen, 2);
          b.writeUInt16LE(max, 4);
          b.writeUInt16LE(pattern.length, 6);
          padded.copy(b, 8);
          return b;
      },

      buf => xutil.readStringList(buf, 24)
   ],

   CreatePixmap: [
       (pid, drawable, depth, width, height) => {
           const b = Buffer.alloc(16);
           b[0] = 53;
           b[1] = depth;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(pid >>> 0, 4);
           b.writeUInt32LE(drawable >>> 0, 8);
           b.writeUInt16LE(width, 12);
           b.writeUInt16LE(height, 14);
           return b;
       }
   ],

   FreePixmap: [
      pixmap => packCxSL(54, 2, pixmap)
   ],

   CreateCursor: [
       (cid, source, mask, foreRGB, backRGB, x, y) => {
          const foreR = foreRGB.R;
          const foreG = foreRGB.G;
          const foreB = foreRGB.B;

          const backR = backRGB.R;
          const backG = backRGB.G;
          const backB = backRGB.B;
          const b = Buffer.alloc(32);
          b[0] = 93;
          b.writeUInt16LE(8, 2);
          b.writeUInt32LE(cid >>> 0, 4);
          b.writeUInt32LE(source >>> 0, 8);
          b.writeUInt32LE(mask >>> 0, 12);
          b.writeUInt16LE(foreR, 16);
          b.writeUInt16LE(foreG, 18);
          b.writeUInt16LE(foreB, 20);
          b.writeUInt16LE(backR, 22);
          b.writeUInt16LE(backG, 24);
          b.writeUInt16LE(backB, 26);
          b.writeUInt16LE(x, 28);
          b.writeUInt16LE(y, 30);
          return b;
       }
   ],

   // opcode 55
   CreateGC: [
       (cid, drawable, values) => {
           const vals = packValueMask('CreateGC', values);
           const nValues = vals.valuesBuf.length / 4;
           const b = Buffer.alloc(16 + vals.valuesBuf.length);
           b[0] = 55;
           b.writeUInt16LE(4 + nValues, 2);
           b.writeUInt32LE(cid >>> 0, 4);
           b.writeUInt32LE(drawable >>> 0, 8);
           b.writeUInt32LE(vals.bitmask >>> 0, 12);
           vals.valuesBuf.copy(b, 16);
           return b;
        }
   ],

   ChangeGC: [
       (cid, values) => {
           const vals = packValueMask('CreateGC', values);
           const nValues = vals.valuesBuf.length / 4;
           const b = Buffer.alloc(12 + vals.valuesBuf.length);
           b[0] = 56;
           b.writeUInt16LE(3 + nValues, 2);
           b.writeUInt32LE(cid >>> 0, 4);
           b.writeUInt32LE(vals.bitmask >>> 0, 8);
           vals.valuesBuf.copy(b, 12);
           return b;
        }
   ],

   ClearArea: [
       (wid, x, y, width, height, exposures) => {
           const b = Buffer.alloc(16);
           b[0] = 61;
           b[1] = exposures;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeInt16LE(x, 8);
           b.writeInt16LE(y, 10);
           b.writeUInt16LE(width, 12);
           b.writeUInt16LE(height, 14);
           return b;
       }
   ],

   //
   CopyArea: [
       (srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height) => {
           const b = Buffer.alloc(28);
           b[0] = 62;
           b.writeUInt16LE(7, 2);
           b.writeUInt32LE(srcDrawable >>> 0, 4);
           b.writeUInt32LE(dstDrawable >>> 0, 8);
           b.writeUInt32LE(gc >>> 0, 12);
           b.writeInt16LE(srcX, 16);
           b.writeInt16LE(srcY, 18);
           b.writeInt16LE(dstX, 20);
           b.writeInt16LE(dstY, 22);
           b.writeUInt16LE(width, 24);
           b.writeUInt16LE(height, 26);
           return b;
       }
   ],


   PolyPoint: [
       (coordMode, drawable, gc, points) => {
          const b = Buffer.alloc(12 + 2 * points.length);
          b[0] = 64;
          b[1] = coordMode;
          b.writeUInt16LE(3 + points.length / 2, 2);
          b.writeUInt32LE(drawable >>> 0, 4);
          b.writeUInt32LE(gc >>> 0, 8);
          for (let i = 0; i < points.length; ++i)
              b.writeUInt16LE(points[i] & 0xffff, 12 + i * 2);
          return b;
       }
   ],

   PolyLine: [
       // TODO: remove copy-paste - exectly same as PolyPoint, only differ with opcode
       (coordMode, drawable, gc, points) => {
          const b = Buffer.alloc(12 + 2 * points.length);
          b[0] = 65;
          b[1] = coordMode;
          b.writeUInt16LE(3 + points.length / 2, 2);
          b.writeUInt32LE(drawable >>> 0, 4);
          b.writeUInt32LE(gc >>> 0, 8);
          for (let i = 0; i < points.length; ++i)
              b.writeUInt16LE(points[i] & 0xffff, 12 + i * 2);
          return b;
       }

   ],

   PolyFillRectangle: [
      (drawable, gc, coords) => packUInt16List(70, 3, drawable, gc, coords)
   ],

   PolyFillArc: [
      (drawable, gc, coords) => packUInt16List(71, 3, drawable, gc, coords)
   ],

   PutImage: [
      // format:  0 - Bitmap, 1 - XYPixmap, 2 - ZPixmap
      (format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data) => {
          const padded = xutil.padded_length(data.length);
          const reqLen = 6 + padded / 4; // (length + 3) >> 2 ???
          const padLength = padded - data.length;
          const pad = Buffer.alloc(padLength);

          // TODO: move code to calculate reqLength and use BigReq if needed outside of corereq.js
          // NOTE: big req is used here (length field 0 then CARD32 big length), won't work if not enabled
          const b = Buffer.alloc(28 + data.length + pad.length);
          b[0] = 72;
          b[1] = format;
          b.writeUInt16LE(0, 2);
          b.writeUInt32LE((1 + reqLen) >>> 0, 4);
          b.writeUInt32LE(drawable >>> 0, 8);
          b.writeUInt32LE(gc >>> 0, 12);
          b.writeUInt16LE(width, 16);
          b.writeUInt16LE(height, 18);
          b.writeInt16LE(dstX, 20);
          b.writeInt16LE(dstY, 22);
          b[24] = leftPad;
          b[25] = depth;
          data.copy(b, 28);
          pad.copy(b, 28 + data.length);
          return b;
      }
   ],

   GetImage: [
       (format, drawable, x, y, width, height, planeMask) => {
           const b = Buffer.alloc(20);
           b[0] = 73;
           b[1] = format;
           b.writeUInt16LE(5, 2);
           b.writeUInt32LE(drawable >>> 0, 4);
           b.writeInt16LE(x, 8);
           b.writeInt16LE(y, 10);
           b.writeUInt16LE(width, 12);
           b.writeUInt16LE(height, 14);
           b.writeUInt32LE(planeMask >>> 0, 16);
           return b;
       },
       (buf, depth) => ({
           depth,
           visualId: buf.readUInt32LE(0),
           data: buf.slice(24)
       })
   ],

   PolyText8: [
       (drawable, gc, x, y, items) => {
          const numItems = items.length;
          let reqLen = 16;
          const chunks = [];
          for (let i = 0; i < numItems; ++i)
          {
              const it = items[i];
              if (typeof it == 'string')
              {
                  if (it.length > 254) // TODO: split string in set of items
                      throw 'not supported yet';
                  const chunk = Buffer.alloc(2 + it.length);
                  chunk[0] = it.length;
                  chunk[1] = 0; // delta???
                  chunk.write(it, 2, it.length, 'latin1');
                  chunks.push(chunk);
                  reqLen += 2 + it.length;
              } else {
                  throw 'not supported yet';
              }
          }
          const len4 = xutil.padded_length(reqLen) / 4;
          const padLen = len4 * 4 - reqLen;
          const pad = Buffer.alloc(padLen);
          const b = Buffer.alloc(len4 * 4);
          b[0] = 74;
          b.writeUInt16LE(len4, 2);
          b.writeUInt32LE(drawable >>> 0, 4);
          b.writeUInt32LE(gc >>> 0, 8);
          b.writeInt16LE(x, 12);
          b.writeInt16LE(y, 14);
          let off = 16;
          for (const chunk of chunks) {
              chunk.copy(b, off);
              off += chunk.length;
          }
          pad.copy(b, off);
          return b;
       }
   ],

   CreateColormap:
   [
       (cmid, wid, vid, alloc) => {
           const b = Buffer.alloc(16);
           b[0] = 78;
           b[1] = alloc;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(cmid >>> 0, 4);
           b.writeUInt32LE(wid >>> 0, 8);
           b.writeUInt32LE(vid >>> 0, 12);
           return b;
       }
   ],

   AllocColor: [
       (colormap, red, green, blue) => {
           const b = Buffer.alloc(16);
           b[0] = 84;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(colormap >>> 0, 4);
           b.writeUInt16LE(red, 8);
           b.writeUInt16LE(green, 10);
           b.writeUInt16LE(blue, 12);
           return b;
       },

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
           const b = Buffer.alloc(8 + padded.length);
           b[0] = 98;
           b.writeUInt16LE(2 + padded.length / 4, 2);
           b.writeUInt16LE(name.length, 4);
           padded.copy(b, 8);
           return b;
       },

       buf => coreReplies.QueryExtension(buf)
   ],

   ListExtensions: [
       () => packCxS(99, 1),

       buf => xutil.readStringList(buf, 24)
   ],

   GetKeyboardMapping: [
       (startCode, num) => {
           const b = Buffer.alloc(8);
           b[0] = 101;
           b.writeUInt16LE(2, 2);
           b[4] = startCode;
           b[5] = num;
           return b;
       },
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
		drawable => packCxSL(14, 2, drawable),
		coreReplies.GetGeometry
   ],

   KillClient: [
       resource => packCxSL(113, 2, resource)
   ],

   SetScreenSaver: [
       (timeout, interval, preferBlanking, allowExposures) => {
           const b = Buffer.alloc(12);
           b[0] = 107;
           b.writeUInt16LE(3, 2);
           b.writeInt16LE(timeout, 4);
           b.writeInt16LE(interval, 6);
           b[8] = preferBlanking;
           b[9] = allowExposures;
           return b;
       }
   ],

   Bell: [
       percent => {
           const b = Buffer.alloc(5);
           b[0] = 108;
           b[2] = 1;
           return b;
       }
   ],

   ForceScreenSaver: [
       activate => {
           const b = Buffer.alloc(4);
           b[0] = 115;
           b[1] = activate ? 1 : 0;
           b.writeUInt16LE(1, 2);
           return b;
       }
   ]
};

templates.KillKlient = templates.KillClient;

module.exports = templates;
