var valueMask = {
    backgroundPixmap: 0x00000001,
    backgroundPixel : 0x00000002,
    borderPixmap    : 0x00000004,
    borderPixel     : 0x00000008,
    bitGrawity      : 0x00000010,
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
};

var valueMaskNames = {};
for (var m in valueMask) {
    valueMaskNames[valueMask[m]] = m;
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
       function(id, parentId, x, y, width, height, borderWidth, class, visual, values) {

           // TODO: ??? there is depth field in xproto, but xlib just sets it to zero
           var depth = 0;

           var packetLength = 8 + Object.keys(values).length;
           // TODO: should be CCSLLssSSSSLL - x,y are signed
           var format = 'CCSLLSSSSSSLL';

           // create bitmask
           var bitmask = 0;
           // TODO: slice from function arguments?
           var args = [1, depth, packetLength, id, parentId, x, y, width, height, borderWidth, class, visual];
           
           // TODO: the code is a little bit mess
           // additional values need to be packed in the following way:
           // bitmask (bytes #24 to #31 in the packet) - 32 bit indicating what adittional arguments we supply
           // values list (bytes #32 .. #32+4*num_values) in order of corresponding bits
         
           var masksList = [];
           for (var v in values)
           {
               var valueBit = valueMask[v];
               if (!valueBit)
               {
                   throw new Error('CreateWindow: incorrect value param ' + v);
               }
               masksList.push(valueBit);
               bitmask |= valueBit;
               format += 'L';
           }
           // values packed in order of corresponding bit
           masksList.sort();
           // set bits to indicate additional values we are sending in this request
           args.push(bitmask);
           // add values in the order of the bits
           // TODO: maybe it's better just to scan all 32 bits anstead of sorting parameters we are actually have?
           for (m in masksList)
           {
              valueName = valueMaskNames[masksList[m]];
              args.push( values[valueName] );
           }
           return [format, args];
       }

   ],

   MapWindow: [
       // 8 - opcode, 2 - length
       [ 'CxSL', [8, 2] ]
   ],

   UnmapWindow: [
       [ 'CxSL', [10, 2] ]
   ]  
}
