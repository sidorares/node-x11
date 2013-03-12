var xutil = require('./xutil');
var hexy = require('./hexy').hexy;

var valueMask = {
    CreateWindow: {
        backgroundPixmap: 0x00000001,
        backgroundPixel : 0x00000002,
        borderPixmap    : 0x00000004,
        borderPixel     : 0x00000008,
        bitGravity      : 0x00000010,
        winGravity      : 0x00000020,
        backingStore    : 0x00000040,
        backingPlanes   : 0x00000080,
        backingPixel    : 0x00000100,
        overrideRedirect: 0x00000200,
        saveUnder       : 0x00000400,
        eventMask       : 0x00000800,
      doNotPropagateMask: 0x00001000,
        colormap        : 0x00002000,
        cursor          : 0x00004000
    },
    CreateGC: {
          'function'    : 0x00000001, // TODO: alias? _function?
           planeMask    : 0x00000002,
           foreground   : 0x00000004,
           background   : 0x00000008,
           lineWidth    : 0x00000010,
           lineStyle    : 0x00000020,
           capStyle     : 0x00000040,
           joinStyle    : 0x00000080,
           fillStyle    : 0x00000100,
           fillRule     : 0x00000200,
           tile         : 0x00000400,
           stipple      : 0x00000800,
           tileStippleXOrigin: 0x00001000,
           tileStippleYOrigin: 0x00002000,
           font         : 0x00004000,
           subwindowMode: 0x00008000,
           graphicsExposures: 0x00010000,
           clipXOrigin  : 0x00020000,
           clipYOrigin  : 0x00040000,
           clipMask     : 0x00080000,
           dashOffset   : 0x00100000,
           dashes       : 0x00200000,
           arcMode      : 0x00400000
    },
    ConfigureWindow: {
	x: 		0x000001,
	y:		0x000002,
	width:		0x000004,
	height:		0x000008,
	borderWidth:	0x000010,
	sibling:        0x000020,
	stackMode:	0x000040
    }
};

var valueMaskName = {};
for (var req in valueMask) {
    var masks = valueMask[req];
    var names = valueMaskName[req] = {};
    for (var m in masks)
        names[masks[m]] = m;
}

function packValueMask(reqname, values)
{
    var bitmask = 0;
    var masksList = [];
    var reqValueMask = valueMask[reqname];
    var reqValueMaskName = valueMaskName[reqname];

    if (!reqValueMask)
        throw new Error(reqname + ': no value mask description');

    for (var v in values)
    {
        var valueBit = reqValueMask[v];
        if (!valueBit)
            throw new Error(reqname + ': incorrect value param ' + v);
        masksList.push(valueBit);
        bitmask |= valueBit;
    }
    masksList.sort();
    var args = [];
    for (m in masksList)
    {
       var valueName = reqValueMaskName[masksList[m]];
       args.push( values[valueName] );
    }
    return [bitmask, args]
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

module.exports = {
   CreateWindow: [
       // create request packet - function OR format string
       function(id, parentId, x, y, width, height, borderWidth, depth, _class, visual, values) {

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

           var packetLength = 8 + (values ? Object.keys(values).length : 0);
           var format = 'CCSLLssSSSSLL';

           // create bitmask
           var bitmask = 0;
           // TODO: slice from function arguments?
           var args = [1, depth, packetLength, id, parentId, x, y, width, height, borderWidth, _class, visual];

           // TODO: the code is a little bit mess
           // additional values need to be packed in the following way:
           // bitmask (bytes #24 to #31 in the packet) - 32 bit indicating what adittional arguments we supply
           // values list (bytes #32 .. #32+4*num_values) in order of corresponding bits TODO: it's actually not 4*num. Some values are 4b ytes, some - 1 byte


           // TODO: replace with packValueMask
           var masksList = [];
           for (var v in values)
           {
               var valueBit = valueMask['CreateWindow'][v];
               if (!valueBit)
               {
                   throw new Error('CreateWindow: incorrect value param ' + v);
               }
               masksList.push(valueBit);
               bitmask |= valueBit;
               format += 'L'; // TODO: not all values are 4 bytes CARD32!!!
           }
           // values packed in order of corresponding bit
           masksList.sort();
           // set bits to indicate additional values we are sending in this request
           args.push(bitmask);

           // add values in the order of the bits
           // TODO: maybe it's better just to scan all 32 bits anstead of sorting parameters we are actually have?
           for (var m in masksList)
           {
              var valueName = valueMaskName['CreateWindow'][masksList[m]];
              args.push( values[valueName] );
           }
           return [format, args];
       }

   ],

   ChangeWindowAttributes:[
       function(wid, values) {
           var format = 'CxSLL';
           var packetLength = 3 + (values ? Object.keys(values).length : 0);
           var vals = packValueMask('CreateWindow', values);
           var args = [2, packetLength, wid, vals[0]];
           var valArr = vals[1];
           for (var v in valArr)
           {
               format += 'L';
               args.push(valArr[v]);
           }
           return [format, args];
        }
   ],

   GetWindowAttributes: [
       ['CxSL', [3, 2]],
       function(buf, backingStore)
       {
           // TODO: change from array to named object fields
           var res = buf.unpack('LSCCLLCCCCLLLS');
           var ret = {
               backingStore: backingStore
           };
           ( "visual klass bitGravity winGravity backingPlanes backingPixel" +
             " saveUnder mapIsInstalled mapState overrideRedirect colormap" +
             " allEventMasks myEventMasks doNotPropogateMask" )
           .split(' ').forEach(function(field, index) {
               ret[field] = res[index];
           });
           return ret;
       }
   ],

   DestroyWindow: [
       [ 'CxSL', [4, 2] ]
   ],

   ChangeSaveSet: [
      function(isInsert, wid)
      {
          return [ 'CCSL', [6, (isInsert ? 0 : 1), 2, wid]]
      }
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
        function(win, options) {
            var format = 'CxSLSxx';
            var n = 3;
            var mask = 0;
            var params = [];
            if (options.x !== undefined) {
                mask |= valueMask.ConfigureWindow.x;
                format += 'sxx';
                params.push(options.x);
                ++ n;
            }

            if (options.y !== undefined) {
                mask |= valueMask.ConfigureWindow.y;
                format += 'sxx';
                params.push(options.y);
                ++ n;
            }

            if (options.width !== undefined) {
                mask |= valueMask.ConfigureWindow.width;
                format += 'Sxx';
                params.push(options.width);
                ++ n;
            }

            if (options.height !== undefined) {
                mask |= valueMask.ConfigureWindow.height;
                format += 'Sxx';
                params.push(options.height);
                ++ n;
            }

            if (options.borderWidth !== undefined) {
                mask |= valueMask.ConfigureWindow.borderWidth;
                format += 'Sxx';
                params.push(options.borderWidth);
                ++ n;
            }

            if (options.sibling !== undefined) {
                mask |= valueMask.ConfigureWindow.sibling;
                format += 'L';
                params.push(options.sibling);
                ++ n;
            }

            if (options.stackMode !== undefined) {
                mask |= valueMask.ConfigureWindow.stackMode;
                format += 'Cxxx';
                params.push(options.stackMode);
                ++ n;
            }

            return [format, [12, n, win, mask].concat(params)];
        }
   ],
   
   ResizeWindow: [
        function(win, width, height) {
            return module.exports.ConfigureWindow[0](win, { width : width, height: height });
        }
   ],

   MoveWindow: [
        function(win, x, y) {
            return module.exports.ConfigureWindow[0](win, { x : x, y: y });
        }
   ],

   MoveResizeWindow: [
        function(win, x, y, width, height) {
            return module.exports.ConfigureWindow[0](win, { x : x, y: y, width : width, height: height });
        }
   ],

   RaiseWindow: [
        function(win) {
            return module.exports.ConfigureWindow[0](win, { stackMode : 0 });
        }
   ],


   QueryTree: [
        ['CxSL', [15, 2]],

        function(buf) {
            var tree = {};
            var res = buf.unpack('LLS');
            tree.root = res[0];
            tree.parent = res[1];
            tree.children = [];
            for (var i=0; i < res[2]; ++i)
                tree.children.push(buf.unpack('L', 24 + i*4)[0]);
            return tree;
        }
   ],

   // opcode 16
   InternAtom: [
       function (returnOnlyIfExist, value)
       {
           var padded = xutil.padded_string(value);
           return ['CCSSxxa', [16, returnOnlyIfExist ? 1 : 0, 2+padded.length/4, value.length, padded] ];
       },

       function(buf, seq_num) {
           var res = buf.unpack('L')[0];
           var pending_atom = this.pending_atoms[seq_num];
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
       function(buf) {
          var nameLen = buf.unpack('S')[0];
          // Atom value starting from 24th byte in the buffer
          return buf.unpackString(nameLen, 24);
       }
   ],

   ChangeProperty: [
       // mode: 0 replace, 1 prepend, 2 append
       // format: 8/16/32
       function(mode, wid, name, type, units, data)
       {
          var padded4 = (data.length + 3) >> 2;
          var pad = new Buffer( (padded4<<2) - data.length);
          var format = 'CCSLLLCxxxLaa';
          var requestLength = 6 + padded4;
          var dataLenInFormatUnits = data.length / (units >> 3);
          return [format, [18, mode, requestLength, wid, name, type, units, dataLenInFormatUnits, data, pad] ];
       }
   ],

   // TODO: test
   DeleteProperty: [
       function(wid, prop) {
           return [ 'CxSLL', [19, 3, wid, prop] ];
       }
   ],

   GetProperty: [

       function(del, wid, name, type, longOffset, longLength) //  - offest and maxLength in 4-byte units
       {
           return [ 'CCSLLLLL', [20, del, 6, wid, name, type, longOffset, longLength ] ];
       },

       function(buf, format) {
	   var res = buf.unpack('LLL');
           var prop = {};
           prop.type = res[0];
           prop.bytesAfter = res[1];
           var len = res[2]*(format >> 3)
           prop.data = buf.slice(24, 24+len);
           return prop;
       }
   ],

   ListProperties: [

       function(wid)
       {
          return ['CxSL', [21, 2, wid]];
       },

       function(buf) {
          var n = buf.unpack('S')[0];
          var i;
          var atoms = [];
          for(i=0; i < n; ++i) {
             atoms.push(buf.unpack('L', 24+4*i)[0]);
             //console.log([n, i, atoms]);
          }
          return atoms;
       }
   ],

   SetSelectionOwner: [
      function(owner, selection, time)
      {
          if (!time)
              time = 0; // current time
          return ['CxSLLL', [22, 4, owner, selection, time]];
      }
   ],

   GetSelectionOwner: [
      function(selection)
      {
          return ['CxSL', [23, 2, selection]];
      },

      function(buf) {
          return buf.unpack('L')[0];
      }
   ],

   ConvertSelection: [
      function(requestor, selection, target, property, time) {
          if (!time)
              time = 0;
          return ['CxSLLLLL', [24, 6, requestor, selection, target, property, time]];
      }
   ],

   SendEvent: [

       function(destination, propagate, eventMask, eventRawData)
       {
           return [ 'CCSLLa', [25, propagate, 11, destination, eventMask, eventRawData] ];
       }
   ],

   QueryPointer: [
       [ 'CxSL', [38, 2] ],
       function(buf) {
           var res = buf.unpack('LLssssS');
           return {
               root: res[0],
               child: res[1],
               rootX: res[2],
               rootY: res[3],
               childX: res[4],
               childY: res[5],
               keyMask: res[6]
           };
       }
   ],

   SetInputFocus: [

      function (wid, revertTo) // revertTo: 0 - None, 1 - PointerRoot, 2 - Parent
      {
          return [ 'CCSLL', [42, revertTo, 3, wid, 0] ];
      }
   ],

   WarpPointer: [

      function (srcWin, dstWin, srcX, srcY, srcWidth, srcHeight, dstX, dstY)
      {
          return [ 'CxSLLssSSss', [41, 6, srcWin, dstWin, srcX, srcY, srcWidth, srcHeight, dstX, dstY] ];
      }
   ],

   ListFonts: [
      function(pattern, max)
      {
          var req_len = 2+xutil.padded_length(pattern.length)/4;
          return [ 'CxSSSp', [49, req_len, max, pattern.length, pattern] ];
      },

      function(buf) {
          console.log(buf);
          // TODO: move to buffer.unpackStringList
          var res = [];
          var off = 24;
          while (off < buf.length)
          {
              var len = buf[off++];
              if (len == 0)
                  break;
              if (off + len > buf.length)
              {
                  len = buf.length - off;
                  if (len <= 0)
                     break;
              }
              res.push(buf.unpackString(len, off));
              off += len;
          }
          return res;
      }
   ],

   CreatePixmap: [
       function(pid, drawable, depth, width, height) {
          return [ 'CCSLLSS', [53, depth, 4, pid, drawable, width, height] ];
       }
   ],

   // opcode 55
   CreateGC: [
       function(cid, drawable, values) {
           var format = 'CxSLLL';
           var packetLength = 4 + (values ? Object.keys(values).length : 0);
           var args = [55, packetLength, cid, drawable];
           var vals = packValueMask('CreateGC', values);
           args.push(vals[0]);     // values bitmask
           var valArr = vals[1];
           for (var v in valArr)
           {
               format += 'L'; // TODO: we know format string length in advance and += inefficient for string
               args.push(valArr[v]);
           }
           return [format, args];
        }
   ],

   ChangeGC: [
       function(cid, values) {
           var format = 'CxSLL';
           var packetLength = 3 + (values ? Object.keys(values).length : 0);
           var args = [56, packetLength, cid];
           var vals = packValueMask('CreateGC', values);
           args.push(vals[0]);     // values bitmask
           var valArr = vals[1];
           for (var v in valArr)
           {
               format += 'L'; // TODO: we know format string length in advance and += inefficient for string
               args.push(valArr[v]);
           }
           return [format, args];
        }
   ],

   //
   CopyArea: [
       function(srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height) {
          return [ 'CxSLLLssssSS', [62, 7, srcDrawable, dstDrawable, gc, srcX, srcY, dstX, dstY, width, height] ];
       }
   ],


   PolyPoint: [
       function(coordMode, drawable, gc, points)
       {
          var format = 'CCSLL';
          var args = [64, coordMode, 3+points.length/2, drawable, gc];
          for (var i=0; i < points.length; ++i)
          {
              format += 'S';
              args.push(points[i]);
          }
          return [format, args];
       }
   ],

   PolyLine: [
       // TODO: remove copy-paste - exectly same as PolyPoint, only differ with opcode
       function(coordMode, drawable, gc, points)
       {
          var format = 'CCSLL';
          var args = [65, coordMode, 3+points.length/2, drawable, gc];
          for (var i=0; i < points.length; ++i)
          {
              format += 'S';
              args.push(points[i]);
          }
          return [format, args];
       }

   ],

   PolyFillRectangle: [
      function(drawable, gc, coords) { // x1, y1, w1, h1, x2, y2, w2, h2...
          var format = 'CxSLL';
          var numrects4bytes = coords.length/2;
          var args = [70, 3+numrects4bytes, drawable, gc];
          for (var i=0; i < coords.length; ++i)
          {
              format += 'S';
              args.push(coords[i]);
          }
          return [format, args];
      }
   ],

   PolyFillArc: [
      function(drawable, gc, coords) { // x1, y1, w1, h1, a11, a12, ...
          var format = 'CxSLL';
          var numrects4bytes = coords.length/2;
          var args = [71, 3+numrects4bytes, drawable, gc];
          for (var i=0; i < coords.length; ++i)
          {
              format += 'S';
              args.push(coords[i]);
          }
          return [format, args];
      }
   ],

   PutImage: [
      // format:  0 - Bitmap, 1 - XYPixmap, 2 - ZPixmap
      function(format, drawable, gc, width, height, dstX, dstY, leftPad, depth, data) {
          var padded = xutil.padded_length(data.length);
          var reqLen = 6 + padded/4; // (length + 3) >> 2 ???
          var padLength = padded - data.length;
          var pad = new Buffer(padLength); // TODO: new pack format 'X' - skip amount of bytes supplied in numerical argument

          // TODO: move code to calculate reqLength and use BigReq if needed outside of corereq.js
          // NOTE: big req is used here (first 'L' in format, 0 and +1 in params), won't work if not enabled
          return [ 'CCSLLLSSssCCxxaa', [72, format, 0, 1+reqLen, drawable, gc, width, height, dstX, dstY, leftPad, depth, data, pad]];
      }
   ],

   GetImage: [
       function(format, drawable, x, y, width, height, planeMask)
       {
           return [ 'CCSLssSSL', [73, format, 5, drawable, x, y, width, height, planeMask]];
       },
       function(buf, depth)
       {
           var visualId = buf.unpack('L')[0];
           return {
               depth: depth,
               visualId: visualId,
               data: buf.slice(20)
           };
       }
   ],

   PolyText8: [
       function(drawable, gc, x, y, items) {
          var format = 'CxSLLSS';
          var numItems = items.length;
          var reqLen = 16;
          var args = [74, 0, drawable, gc, x, y];
          for (var i=0; i < numItems; ++i)
          {
              var it = items[i];
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
          var len4 = xutil.padded_length(reqLen)/4;
          var padLen = len4*4 - reqLen;
          args[1] = len4; // set request length to calculated value
          var pad = '';
          for (var i=0; i < padLen; ++i)
             pad += String.fromCharCode(0);
          format += 'a';
          args.push(pad);
          return [format, args];
       }
   ],

   CreateColormap:
   [
       function(cmid, wid, vid, alloc)
       {
           return ['CCSLLL', [78, alloc, 4, cmid, wid, vid]];
       }
   ],

   AllocColor: [
       [ 'CxSLSSSxx', [84, 4] ], // params: colormap, red, green, blue

       function(buf) {
	   var res = buf.unpack('SSSxL');
           var color = {};
           color.red   = res[0];
           color.blue  = res[1];
           color.green = res[2];
           color.pixel = res[3]>>8; // it looks like 3 first bytes contain RGB value in response
           return color;
       }
   ],

   QueryExtension: [
       function(name) {
           var padded = xutil.padded_string(name);
           return ['CxSSxxa', [98, 2+padded.length/4, name.length, padded] ];
       },

       function(buf) {
	   var res = buf.unpack('CCCC');
           var ext = {};
           ext.present = res[0];
           ext.majorOpcode = res[1];
           ext.firstEvent = res[2];
           ext.firstError = res[3];
           return ext;
       }

   ],

   ListExtensions: [
       [ 'CxS', [99, 1] ],

       function(buf) {
          // TODO: move to buffer.unpackStringList
          var res = [];
          var off = 24;
          while (off < buf.length)
          {
              var len = buf[off++];
              if (len == 0)
                  break;
              if (off + len > buf.length)
              {
                  len = buf.length - off;
                  if (len <= 0)
                     break;
              }
              res.push(buf.unpackString(len, off));
              off += len;
          }
          return res;
       }
   ],

   GetKeyboardMapping: [
       function(startCode, num) {
           return [ 'CxSCCxx', [101, 2, startCode, num] ]
       },
       function(buff, listLength) {
           var res = [];
           var format = '';
           for (var i=0; i < listLength; ++i)
               format += 'L';
           for (var offset=24; offset < buff.length - 4*listLength; offset += 4*listLength)
                res.push(buff.unpack(format, offset));
           return res;
       }
   ],

        // todo: move up to keep reque
	GetGeometry: [
		function(drawable){
			return ['CxSL', [14, 2, drawable]]
		},
		function(buff)
		{
			var res = buff.unpack('LSSSSSx');
			var ext = {};
			ext.windowid = res[0]
			ext.xPos = res[1];
			ext.yPos = res[2];
			ext.width = res[3];
			ext.height = res[4];
			ext.borderWidth = res[5];
			return ext;
		}
   ],

   KillKlient: [
       function(resource) {
           return [ 'CxSL', [113, 2, resource] ];
       }
   ],

   SetScreenSaver: [
       function(timeout, interval, preferBlanking, allowExposures) {
           return [ 'CxSSSCCxx', [107, 3, timeout, interval, preferBlanking, allowExposures]];
       }
   ],

   ForceScreenSaver: [
       function(activate) {
           return [ 'CCS', [115, activate?1:0, 1] ];
       }
   ]


}
