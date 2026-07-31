// full list of event/error/request codes for all extensions:
// http://www.opensource.apple.com/source/X11server/X11server-106.7/kdrive/xorg-server-1.6.5-apple3/dix/protocol.txt

const xutil = require('./xutil');
const coreReplies = require('./generated/core-replies');
const coreEvents = require('./generated/core-events');

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
    ChangeKeyboardControl: {
      keyClickPercent         : {
        mask: 0x0001,
        kind: 'c'
      },
      bellPercent             : {
        mask: 0x0002,
        kind: 'c'
      },
      bellPitch               : {
        mask: 0x0004,
        kind: 's'
      },
      bellDuration            : {
        mask: 0x0008,
        kind: 's'
      },
      led                     : {
        mask: 0x0010,
        kind: 'C'
      },
      ledMode                 : {
        mask: 0x0020,
        kind: 'C'
      },
      key                     : {
        mask: 0x0040,
        kind: 'C'
      },
      autoRepeatMode          : {
        mask: 0x0080,
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
    case 'c':
        buf.writeInt8(value, offset);
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

/* CHARINFO: 12 bytes (see QueryFont / ListFontsWithInfo replies) */
function parseCharInfo(buf, off)
{
    return {
        leftSideBearing  : buf.readInt16LE(off),
        rightSideBearing : buf.readInt16LE(off + 2),
        characterWidth   : buf.readInt16LE(off + 4),
        ascent           : buf.readInt16LE(off + 6),
        descent          : buf.readInt16LE(off + 8),
        attributes       : buf.readUInt16LE(off + 10)
    };
}

/* shared header of QueryFont and ListFontsWithInfo replies (body offsets) */
function parseFontInfo(buf)
{
    const info = {
        minBounds      : parseCharInfo(buf, 0),
        maxBounds      : parseCharInfo(buf, 16),
        minCharOrByte2 : buf.readUInt16LE(32),
        maxCharOrByte2 : buf.readUInt16LE(34),
        defaultChar    : buf.readUInt16LE(36),
        drawDirection  : buf.readUInt8(40),
        minByte1       : buf.readUInt8(41),
        maxByte1       : buf.readUInt8(42),
        allCharsExist  : !!buf.readUInt8(43),
        fontAscent     : buf.readInt16LE(44),
        fontDescent    : buf.readInt16LE(46)
    };
    const nProps = buf.readUInt16LE(38);
    info.properties = [];
    for (let i = 0; i < nProps; ++i)
        info.properties.push({
            name  : buf.readUInt32LE(52 + i * 8),
            value : buf.readUInt32LE(56 + i * 8)
        });
    return info;
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

   DestroySubwindows: [
       wid => packCxSL(5, 2, wid)
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

   MapSubwindows: [
       wid => packCxSL(9, 2, wid)
   ],

   UnmapWindow: [
       wid => packCxSL(10, 2, wid)
   ],

   UnmapSubwindows: [
       wid => packCxSL(11, 2, wid)
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

   CirculateWindow: [
       // direction: 0 RaiseLowest, 1 LowerHighest
       (wid, direction) => packCCSL(13, direction, 2, wid)
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

       (destination, propagate, eventMask, event) => {
           // Either the raw 32 wire bytes (a received event's rawData) or an
           // event object in the shape the parsers produce.
           const eventRawData = Buffer.isBuffer(event) ? event : coreEvents.packEvent(event);
           if (eventRawData.length !== 32) {
               throw new TypeError(
                   `SendEvent: event must be exactly 32 bytes, got ${eventRawData.length}` +
                   ' (GenericEvent bodies cannot be sent)');
           }
           const b = Buffer.alloc(44);
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

   GetMotionEvents: [
       // start/stop: timestamps, 0 for CurrentTime
       (wid, start, stop) => {
           const b = Buffer.alloc(16);
           b[0] = 39;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt32LE(start >>> 0, 8);
           b.writeUInt32LE(stop >>> 0, 12);
           return b;
       },

       buf => {
           const n = buf.readUInt32LE(0);
           const events = [];
           for (let i = 0; i < n; ++i)
               events.push({
                   time : buf.readUInt32LE(24 + 8 * i),
                   x    : buf.readInt16LE(28 + 8 * i),
                   y    : buf.readInt16LE(30 + 8 * i)
               });
           return events;
       }
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

   // opcode 44 — reply is 32 CARD8 key bits (see xproto QueryKeymap)
   QueryKeymap: [
       () => packCxS(44, 1),
       buf => buf.slice(0, 32)
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

   OpenFont: [
       (fid, name) => {
           const padded = xutil.padded_string(name);
           const b = Buffer.alloc(12 + padded.length);
           b[0] = 45;
           b.writeUInt16LE(3 + padded.length / 4, 2);
           b.writeUInt32LE(fid >>> 0, 4);
           b.writeUInt16LE(name.length, 8);
           padded.copy(b, 12);
           return b;
       }
   ],

   CloseFont: [
       fid => packCxSL(46, 2, fid)
   ],

   QueryFont: [
       fontable => packCxSL(47, 2, fontable),

       buf => {
           const font = parseFontInfo(buf);
           const nCharInfos = buf.readUInt32LE(48);
           const charsOffset = 52 + font.properties.length * 8;
           font.charInfos = [];
           for (let i = 0; i < nCharInfos; ++i)
               font.charInfos.push(parseCharInfo(buf, charsOffset + i * 12));
           return font;
       }
   ],

   QueryTextExtents: [
       // string is encoded as STRING16 (2 bytes per char)
       (fontable, str) => {
           const byteLen = 2 * str.length;
           const padded = xutil.padded_length(byteLen);
           const b = Buffer.alloc(8 + padded);
           b[0] = 48;
           b[1] = (padded - byteLen) === 2 ? 1 : 0; // odd length flag
           b.writeUInt16LE(2 + padded / 4, 2);
           b.writeUInt32LE(fontable >>> 0, 4);
           for (let i = 0; i < str.length; ++i) {
               const c = str.charCodeAt(i);
               b[8 + i * 2] = (c >> 8) & 0xff;     // byte1
               b[8 + i * 2 + 1] = c & 0xff;        // byte2
           }
           return b;
       },

       (buf, drawDirection) => ({
           drawDirection,
           fontAscent     : buf.readInt16LE(0),
           fontDescent    : buf.readInt16LE(2),
           overallAscent  : buf.readInt16LE(4),
           overallDescent : buf.readInt16LE(6),
           overallWidth   : buf.readInt32LE(8),
           overallLeft    : buf.readInt32LE(12),
           overallRight   : buf.readInt32LE(16)
       })
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

   ListFontsWithInfo: [
      (pattern, max) => {
          const padded = xutil.padded_string(pattern);
          const reqLen = 2 + padded.length / 4;
          const b = Buffer.alloc(8 + padded.length);
          b[0] = 50;
          b.writeUInt16LE(reqLen, 2);
          b.writeUInt16LE(max, 4);
          b.writeUInt16LE(pattern.length, 6);
          padded.copy(b, 8);
          return b;
      },

      // one reply per font; terminating reply has zero name length
      (buf, nameLen) => {
          if (nameLen === 0)
              return; // undefined ends the multi-reply series
          const font = parseFontInfo(buf);
          font.repliesHint = buf.readUInt32LE(48);
          font.name = xutil.readLatin1(buf, 52 + font.properties.length * 8, nameLen);
          return font;
      },

      true // multi-reply
   ],

   SetFontPath: [
      paths => {
          let strsLen = 0;
          for (const p of paths)
              strsLen += 1 + p.length;
          const padded = xutil.padded_length(strsLen);
          const b = Buffer.alloc(8 + padded);
          b[0] = 51;
          b.writeUInt16LE(2 + padded / 4, 2);
          b.writeUInt16LE(paths.length, 4);
          let off = 8;
          for (const p of paths) {
              b[off++] = p.length;
              b.write(p, off, p.length, 'latin1');
              off += p.length;
          }
          return b;
      }
   ],

   GetFontPath: [
      () => packCxS(52, 1),

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

   // opcode 94
   CreateGlyphCursor: [
       (cid, sourceFont, maskFont, sourceChar, maskChar, foreRGB, backRGB) => {
          const b = Buffer.alloc(32);
          b[0] = 94;
          b.writeUInt16LE(8, 2);
          b.writeUInt32LE(cid >>> 0, 4);
          b.writeUInt32LE(sourceFont >>> 0, 8);
          b.writeUInt32LE(maskFont >>> 0, 12);
          b.writeUInt16LE(sourceChar, 16);
          b.writeUInt16LE(maskChar, 18);
          b.writeUInt16LE(foreRGB.R, 20);
          b.writeUInt16LE(foreRGB.G, 22);
          b.writeUInt16LE(foreRGB.B, 24);
          b.writeUInt16LE(backRGB.R, 26);
          b.writeUInt16LE(backRGB.G, 28);
          b.writeUInt16LE(backRGB.B, 30);
          return b;
       }
   ],

   FreeCursor: [
       cursor => packCxSL(95, 2, cursor)
   ],

   RecolorCursor: [
       (cursor, foreRGB, backRGB) => {
          const b = Buffer.alloc(20);
          b[0] = 96;
          b.writeUInt16LE(5, 2);
          b.writeUInt32LE(cursor >>> 0, 4);
          b.writeUInt16LE(foreRGB.R, 8);
          b.writeUInt16LE(foreRGB.G, 10);
          b.writeUInt16LE(foreRGB.B, 12);
          b.writeUInt16LE(backRGB.R, 14);
          b.writeUInt16LE(backRGB.G, 16);
          b.writeUInt16LE(backRGB.B, 18);
          return b;
       }
   ],

   QueryBestSize: [
       // _class: 0 Cursor, 1 Tile, 2 Stipple
       (_class, drawable, width, height) => {
          const b = Buffer.alloc(12);
          b[0] = 97;
          b[1] = _class;
          b.writeUInt16LE(3, 2);
          b.writeUInt32LE(drawable >>> 0, 4);
          b.writeUInt16LE(width, 8);
          b.writeUInt16LE(height, 10);
          return b;
       },

       buf => ({
           width  : buf.readUInt16LE(0),
           height : buf.readUInt16LE(2)
       })
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

   CopyGC: [
       // components: CARD32 bitmask or list of CreateGC value names
       (srcGc, dstGc, components) => {
           let mask = components;
           if (Array.isArray(components)) {
               mask = 0;
               for (const name of components) {
                   const v = valueMask.CreateGC[name];
                   if (!v)
                       throw new Error(`CopyGC: incorrect component ${name}`);
                   mask |= v.mask;
               }
           }
           const b = Buffer.alloc(16);
           b[0] = 57;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(srcGc >>> 0, 4);
           b.writeUInt32LE(dstGc >>> 0, 8);
           b.writeUInt32LE(mask >>> 0, 12);
           return b;
       }
   ],

   SetDashes: [
       (gc, dashOffset, dashes) => {
           const padded = xutil.padded_length(dashes.length);
           const b = Buffer.alloc(12 + padded);
           b[0] = 58;
           b.writeUInt16LE(3 + padded / 4, 2);
           b.writeUInt32LE(gc >>> 0, 4);
           b.writeUInt16LE(dashOffset, 8);
           b.writeUInt16LE(dashes.length, 10);
           for (let i = 0; i < dashes.length; ++i)
               b[12 + i] = dashes[i];
           return b;
       }
   ],

   SetClipRectangles: [
       // ordering: 0 UnSorted, 1 YSorted, 2 YXSorted, 3 YXBanded
       // rects: flat array [x, y, width, height, ...]
       (gc, ordering, clipXOrigin, clipYOrigin, rects) => {
           const b = Buffer.alloc(12 + 2 * rects.length);
           b[0] = 59;
           b[1] = ordering;
           b.writeUInt16LE(3 + rects.length / 2, 2);
           b.writeUInt32LE(gc >>> 0, 4);
           b.writeInt16LE(clipXOrigin, 8);
           b.writeInt16LE(clipYOrigin, 10);
           for (let i = 0; i < rects.length; ++i)
               b.writeUInt16LE(rects[i] & 0xffff, 12 + i * 2);
           return b;
       }
   ],

   FreeGC: [
       gc => packCxSL(60, 2, gc)
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

   CopyPlane: [
       (srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height, bitPlane) => {
           const b = Buffer.alloc(32);
           b[0] = 63;
           b.writeUInt16LE(8, 2);
           b.writeUInt32LE(srcDrawable >>> 0, 4);
           b.writeUInt32LE(dstDrawable >>> 0, 8);
           b.writeUInt32LE(gc >>> 0, 12);
           b.writeInt16LE(srcX, 16);
           b.writeInt16LE(srcY, 18);
           b.writeInt16LE(dstX, 20);
           b.writeInt16LE(dstY, 22);
           b.writeUInt16LE(width, 24);
           b.writeUInt16LE(height, 26);
           b.writeUInt32LE(bitPlane >>> 0, 28);
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

   PolySegment: [
      // segments: flat array [x1, y1, x2, y2, ...]
      (drawable, gc, segments) => packUInt16List(66, 3, drawable, gc, segments)
   ],

   PolyRectangle: [
      // rects: flat array [x, y, width, height, ...]
      (drawable, gc, rects) => packUInt16List(67, 3, drawable, gc, rects)
   ],

   PolyArc: [
      // arcs: flat array [x, y, width, height, angle1, angle2, ...], angles in 1/64 degree
      (drawable, gc, arcs) => packUInt16List(68, 3, drawable, gc, arcs)
   ],

   FillPoly: [
      // shape: 0 Complex, 1 Nonconvex, 2 Convex
      // coordMode: 0 Origin, 1 Previous
      // points: flat array [x, y, ...]
      (drawable, gc, shape, coordMode, points) => {
          const b = Buffer.alloc(16 + 2 * points.length);
          b[0] = 69;
          b.writeUInt16LE(4 + points.length / 2, 2);
          b.writeUInt32LE(drawable >>> 0, 4);
          b.writeUInt32LE(gc >>> 0, 8);
          b[12] = shape;
          b[13] = coordMode;
          for (let i = 0; i < points.length; ++i)
              b.writeUInt16LE(points[i] & 0xffff, 16 + i * 2);
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
                      throw new Error('not supported yet');
                  const chunk = Buffer.alloc(2 + it.length);
                  chunk[0] = it.length;
                  chunk[1] = 0; // delta???
                  chunk.write(it, 2, it.length, 'latin1');
                  chunks.push(chunk);
                  reqLen += 2 + it.length;
              } else {
                  throw new Error('not supported yet');
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

   PolyText16: [
       // items: strings encoded as STRING16 (2-byte CHAR2B per char)
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
                      throw new Error('not supported yet');
                  const chunk = Buffer.alloc(2 + 2 * it.length);
                  chunk[0] = it.length;
                  chunk[1] = 0; // delta
                  for (let j = 0; j < it.length; ++j) {
                      const c = it.charCodeAt(j);
                      chunk[2 + j * 2] = (c >> 8) & 0xff;  // byte1
                      chunk[3 + j * 2] = c & 0xff;         // byte2
                  }
                  chunks.push(chunk);
                  reqLen += chunk.length;
              } else {
                  throw new Error('not supported yet');
              }
          }
          const len4 = xutil.padded_length(reqLen) / 4;
          const b = Buffer.alloc(len4 * 4);
          b[0] = 75;
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
          return b;
       }
   ],

   ImageText8: [
       (drawable, gc, x, y, text) => {
          const padded = xutil.padded_length(text.length);
          const b = Buffer.alloc(16 + padded);
          b[0] = 76;
          b[1] = text.length;
          b.writeUInt16LE(4 + padded / 4, 2);
          b.writeUInt32LE(drawable >>> 0, 4);
          b.writeUInt32LE(gc >>> 0, 8);
          b.writeInt16LE(x, 12);
          b.writeInt16LE(y, 14);
          b.write(text, 16, text.length, 'latin1');
          return b;
       }
   ],

   ImageText16: [
       // text encoded as STRING16 (2-byte CHAR2B per char)
       (drawable, gc, x, y, text) => {
          const padded = xutil.padded_length(2 * text.length);
          const b = Buffer.alloc(16 + padded);
          b[0] = 77;
          b[1] = text.length;
          b.writeUInt16LE(4 + padded / 4, 2);
          b.writeUInt32LE(drawable >>> 0, 4);
          b.writeUInt32LE(gc >>> 0, 8);
          b.writeInt16LE(x, 12);
          b.writeInt16LE(y, 14);
          for (let i = 0; i < text.length; ++i) {
              const c = text.charCodeAt(i);
              b[16 + i * 2] = (c >> 8) & 0xff;  // byte1
              b[17 + i * 2] = c & 0xff;         // byte2
          }
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

   FreeColormap: [
       cmap => packCxSL(79, 2, cmap)
   ],

   CopyColormapAndFree: [
       (newCmid, srcCmap) => {
           const b = Buffer.alloc(12);
           b[0] = 80;
           b.writeUInt16LE(3, 2);
           b.writeUInt32LE(newCmid >>> 0, 4);
           b.writeUInt32LE(srcCmap >>> 0, 8);
           return b;
       }
   ],

   InstallColormap: [
       cmap => packCxSL(81, 2, cmap)
   ],

   UninstallColormap: [
       cmap => packCxSL(82, 2, cmap)
   ],

   ListInstalledColormaps: [
       wid => packCxSL(83, 2, wid),

       buf => {
           const n = buf.readUInt16LE(0);
           const cmaps = [];
           for (let i = 0; i < n; ++i)
               cmaps.push(buf.readUInt32LE(24 + 4 * i));
           return cmaps;
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
           // SSSxL: red, green, blue, pad, pixel
           const color = {};
           color.red   = buf.readUInt16LE(0);
           color.green = buf.readUInt16LE(2);
           color.blue  = buf.readUInt16LE(4);
           color.pixel = buf.readUInt32LE(8);
           return color;
       }
   ],

   AllocNamedColor: [
       (cmap, name) => {
           const padded = xutil.padded_string(name);
           const b = Buffer.alloc(12 + padded.length);
           b[0] = 85;
           b.writeUInt16LE(3 + padded.length / 4, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           b.writeUInt16LE(name.length, 8);
           padded.copy(b, 12);
           return b;
       },

       buf => ({
           pixel       : buf.readUInt32LE(0),
           exactRed    : buf.readUInt16LE(4),
           exactGreen  : buf.readUInt16LE(6),
           exactBlue   : buf.readUInt16LE(8),
           visualRed   : buf.readUInt16LE(10),
           visualGreen : buf.readUInt16LE(12),
           visualBlue  : buf.readUInt16LE(14)
       })
   ],

   AllocColorCells: [
       (contiguous, cmap, colors, planes) => {
           const b = Buffer.alloc(12);
           b[0] = 86;
           b[1] = contiguous ? 1 : 0;
           b.writeUInt16LE(3, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           b.writeUInt16LE(colors, 8);
           b.writeUInt16LE(planes, 10);
           return b;
       },

       buf => {
           const nPixels = buf.readUInt16LE(0);
           const nMasks = buf.readUInt16LE(2);
           const res = { pixels: [], masks: [] };
           for (let i = 0; i < nPixels; ++i)
               res.pixels.push(buf.readUInt32LE(24 + 4 * i));
           for (let i = 0; i < nMasks; ++i)
               res.masks.push(buf.readUInt32LE(24 + 4 * (nPixels + i)));
           return res;
       }
   ],

   AllocColorPlanes: [
       (contiguous, cmap, colors, reds, greens, blues) => {
           const b = Buffer.alloc(16);
           b[0] = 87;
           b[1] = contiguous ? 1 : 0;
           b.writeUInt16LE(4, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           b.writeUInt16LE(colors, 8);
           b.writeUInt16LE(reds, 10);
           b.writeUInt16LE(greens, 12);
           b.writeUInt16LE(blues, 14);
           return b;
       },

       buf => {
           const nPixels = buf.readUInt16LE(0);
           const res = {
               redMask   : buf.readUInt32LE(4),
               greenMask : buf.readUInt32LE(8),
               blueMask  : buf.readUInt32LE(12),
               pixels    : []
           };
           for (let i = 0; i < nPixels; ++i)
               res.pixels.push(buf.readUInt32LE(24 + 4 * i));
           return res;
       }
   ],

   FreeColors: [
       (cmap, planeMask, pixels) => {
           const b = Buffer.alloc(12 + 4 * pixels.length);
           b[0] = 88;
           b.writeUInt16LE(3 + pixels.length, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           b.writeUInt32LE(planeMask >>> 0, 8);
           for (let i = 0; i < pixels.length; ++i)
               b.writeUInt32LE(pixels[i] >>> 0, 12 + 4 * i);
           return b;
       }
   ],

   StoreColors: [
       // items: [{ pixel, red, green, blue, doMask }], doMask: 1 red | 2 green | 4 blue (default all)
       (cmap, items) => {
           const b = Buffer.alloc(8 + 12 * items.length);
           b[0] = 89;
           b.writeUInt16LE(2 + 3 * items.length, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           for (let i = 0; i < items.length; ++i) {
               const item = items[i];
               const off = 8 + 12 * i;
               b.writeUInt32LE(item.pixel >>> 0, off);
               b.writeUInt16LE(item.red || 0, off + 4);
               b.writeUInt16LE(item.green || 0, off + 6);
               b.writeUInt16LE(item.blue || 0, off + 8);
               b[off + 10] = item.doMask === undefined ? 7 : item.doMask;
           }
           return b;
       }
   ],

   StoreNamedColor: [
       // doMask: 1 red | 2 green | 4 blue
       (cmap, pixel, name, doMask) => {
           const padded = xutil.padded_string(name);
           const b = Buffer.alloc(16 + padded.length);
           b[0] = 90;
           b[1] = doMask === undefined ? 7 : doMask;
           b.writeUInt16LE(4 + padded.length / 4, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           b.writeUInt32LE(pixel >>> 0, 8);
           b.writeUInt16LE(name.length, 12);
           padded.copy(b, 16);
           return b;
       }
   ],

   QueryColors: [
       (cmap, pixels) => {
           const b = Buffer.alloc(8 + 4 * pixels.length);
           b[0] = 91;
           b.writeUInt16LE(2 + pixels.length, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           for (let i = 0; i < pixels.length; ++i)
               b.writeUInt32LE(pixels[i] >>> 0, 8 + 4 * i);
           return b;
       },

       buf => {
           const n = buf.readUInt16LE(0);
           const colors = [];
           for (let i = 0; i < n; ++i)
               colors.push({
                   red   : buf.readUInt16LE(24 + 8 * i),
                   green : buf.readUInt16LE(26 + 8 * i),
                   blue  : buf.readUInt16LE(28 + 8 * i)
               });
           return colors;
       }
   ],

   LookupColor: [
       (cmap, name) => {
           const padded = xutil.padded_string(name);
           const b = Buffer.alloc(12 + padded.length);
           b[0] = 92;
           b.writeUInt16LE(3 + padded.length / 4, 2);
           b.writeUInt32LE(cmap >>> 0, 4);
           b.writeUInt16LE(name.length, 8);
           padded.copy(b, 12);
           return b;
       },

       buf => ({
           exactRed    : buf.readUInt16LE(0),
           exactGreen  : buf.readUInt16LE(2),
           exactBlue   : buf.readUInt16LE(4),
           visualRed   : buf.readUInt16LE(6),
           visualGreen : buf.readUInt16LE(8),
           visualBlue  : buf.readUInt16LE(10)
       })
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
           for (let offset = 24; offset + rowBytes <= buff.length; offset += rowBytes) {
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

   ChangeKeyboardMapping: [
       // keysyms: flat list of keycodeCount * keysymsPerKeycode KEYSYMs
       (firstKeycode, keysymsPerKeycode, keysyms) => {
           const keycodeCount = keysyms.length / keysymsPerKeycode;
           const b = Buffer.alloc(8 + 4 * keysyms.length);
           b[0] = 100;
           b[1] = keycodeCount;
           b.writeUInt16LE(2 + keysyms.length, 2);
           b[4] = firstKeycode;
           b[5] = keysymsPerKeycode;
           for (let i = 0; i < keysyms.length; ++i)
               b.writeUInt32LE(keysyms[i] >>> 0, 8 + 4 * i);
           return b;
       }
   ],

   ChangeKeyboardControl: [
       /*
        * values : {
        *     keyClickPercent, bellPercent, bellPitch, bellDuration,
        *     led, ledMode, key, autoRepeatMode
        * }
        */
       values => {
           const vals = packValueMask('ChangeKeyboardControl', values);
           const nValues = vals.valuesBuf.length / 4;
           const b = Buffer.alloc(8 + vals.valuesBuf.length);
           b[0] = 102;
           b.writeUInt16LE(2 + nValues, 2);
           b.writeUInt32LE(vals.bitmask >>> 0, 4);
           vals.valuesBuf.copy(b, 8);
           return b;
       }
   ],

   GetKeyboardControl: [
       () => packCxS(103, 1),

       (buf, globalAutoRepeat) => {
           const control = {
               globalAutoRepeat,
               ledMask         : buf.readUInt32LE(0),
               keyClickPercent : buf.readUInt8(4),
               bellPercent     : buf.readUInt8(5),
               bellPitch       : buf.readUInt16LE(6),
               bellDuration    : buf.readUInt16LE(8),
               autoRepeats     : buf.slice(12, 44)
           };
           return control;
       }
   ],

   ChangePointerControl: [
       (accelNumerator, accelDenominator, threshold, doAcceleration, doThreshold) => {
           const b = Buffer.alloc(12);
           b[0] = 105;
           b.writeUInt16LE(3, 2);
           b.writeInt16LE(accelNumerator, 4);
           b.writeInt16LE(accelDenominator, 6);
           b.writeInt16LE(threshold, 8);
           b[10] = doAcceleration ? 1 : 0;
           b[11] = doThreshold ? 1 : 0;
           return b;
       }
   ],

   GetPointerControl: [
       () => packCxS(106, 1),

       buf => ({
           accelNumerator   : buf.readUInt16LE(0),
           accelDenominator : buf.readUInt16LE(2),
           threshold        : buf.readUInt16LE(4)
       })
   ],

   GetScreenSaver: [
       () => packCxS(108, 1),

       buf => ({
           timeout        : buf.readInt16LE(0),
           interval       : buf.readInt16LE(2),
           preferBlanking : buf.readUInt8(4),
           allowExposures : buf.readUInt8(5)
       })
   ],

   ChangeHosts: [
       // mode: 0 Insert, 1 Delete
       // family: 0 Internet, 1 DECnet, 2 Chaos, 5 ServerInterpreted, 6 InternetV6
       // address: Buffer or byte array
       (mode, family, address) => {
           const addr = Buffer.isBuffer(address) ? address : Buffer.from(address);
           const padded = xutil.padded_length(addr.length);
           const b = Buffer.alloc(8 + padded);
           b[0] = 109;
           b[1] = mode;
           b.writeUInt16LE(2 + padded / 4, 2);
           b[4] = family;
           b.writeUInt16LE(addr.length, 6);
           addr.copy(b, 8);
           return b;
       }
   ],

   ListHosts: [
       () => packCxS(110, 1),

       (buf, mode) => {
           const n = buf.readUInt16LE(0);
           const res = { mode, hosts: [] }; // mode: 0 access control disabled, 1 enabled
           let off = 24;
           for (let i = 0; i < n; ++i) {
               const family = buf.readUInt8(off);
               const addrLen = buf.readUInt16LE(off + 2);
               res.hosts.push({
                   family,
                   address: buf.slice(off + 4, off + 4 + addrLen)
               });
               off += 4 + xutil.padded_length(addrLen);
           }
           return res;
       }
   ],

   SetAccessControl: [
       // mode: 0 Disable, 1 Enable
       mode => {
           const b = Buffer.alloc(4);
           b[0] = 111;
           b[1] = mode;
           b.writeUInt16LE(1, 2);
           return b;
       }
   ],

   SetCloseDownMode: [
       // mode: 0 Destroy, 1 RetainPermanent, 2 RetainTemporary
       mode => {
           const b = Buffer.alloc(4);
           b[0] = 112;
           b[1] = mode;
           b.writeUInt16LE(1, 2);
           return b;
       }
   ],

   KillClient: [
       resource => packCxSL(113, 2, resource)
   ],

   RotateProperties: [
       (wid, delta, atoms) => {
           const b = Buffer.alloc(12 + 4 * atoms.length);
           b[0] = 114;
           b.writeUInt16LE(3 + atoms.length, 2);
           b.writeUInt32LE(wid >>> 0, 4);
           b.writeUInt16LE(atoms.length, 8);
           b.writeInt16LE(delta, 10);
           for (let i = 0; i < atoms.length; ++i)
               b.writeUInt32LE(atoms[i] >>> 0, 12 + 4 * i);
           return b;
       }
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
       // percent: -100..100 relative to base bell volume
       percent => {
           const b = Buffer.alloc(4);
           b[0] = 104;
           b.writeInt8(percent || 0, 1);
           b.writeUInt16LE(1, 2);
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
   ],

   SetPointerMapping: [
       map => {
           const padded = xutil.padded_length(map.length);
           const b = Buffer.alloc(4 + padded);
           b[0] = 116;
           b[1] = map.length;
           b.writeUInt16LE(1 + padded / 4, 2);
           for (let i = 0; i < map.length; ++i)
               b[4 + i] = map[i];
           return b;
       },

       // status: 0 Success, 1 Busy
       (buf, status) => status
   ],

   GetPointerMapping: [
       () => packCxS(117, 1),

       (buf, n) => {
           const map = [];
           for (let i = 0; i < n; ++i)
               map.push(buf.readUInt8(24 + i));
           return map;
       }
   ],

   SetModifierMapping: [
       // keycodesPerModifier keycodes for each of 8 modifiers (Shift, Lock,
       // Control, Mod1-Mod5); rows shorter than keycodesPerModifier are zero-padded
       rows => {
           let n = 0;
           for (const row of rows)
               if (row.length > n)
                   n = row.length;
           const b = Buffer.alloc(4 + 8 * n);
           b[0] = 118;
           b[1] = n;
           b.writeUInt16LE(1 + 2 * n, 2);
           for (let mod = 0; mod < 8; ++mod)
               for (let i = 0; i < rows[mod].length; ++i)
                   b[4 + mod * n + i] = rows[mod][i];
           return b;
       },

       // status: 0 Success, 1 Busy, 2 Failed
       (buf, status) => status
   ],

   GetModifierMapping: [
       () => packCxS(119, 1),

       (buf, keycodesPerModifier) => {
           const rows = [];
           for (let mod = 0; mod < 8; ++mod) {
               const row = [];
               for (let i = 0; i < keycodesPerModifier; ++i)
                   row.push(buf.readUInt8(24 + mod * keycodesPerModifier + i));
               rows.push(row);
           }
           return rows;
       }
   ],

   NoOperation: [
       () => packCxS(127, 1)
   ]
};

templates.KillKlient = templates.KillClient;

module.exports = templates;
