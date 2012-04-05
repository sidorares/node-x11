if (process.platform == 'darwin') {
    // some strage dns related errors in core node libs on OSX (node v0.6.5)
    // skip them at the moment
    process.on('uncaughtException', function (err) {
        console.log(err);
        console.log('Caught exception: ' + err);
    });
}

var util = require('util'); // util.inherits
var net = require('net');

var handshake = require('./handshake');
//var xevents = require('./xevents');

var EventEmitter = require('events').EventEmitter;
var PackStream = require('./unpackstream');
var coreRequestsTemplate = require('./corereqs');
var hexy = require('./hexy').hexy;

var Buffer = require('buffer').Buffer;
// add 'unpack' method for buffer
require('./unpackbuffer').addUnpack(Buffer);

var os = require('os');

var xerrors = require('./xerrors');
var coreRequests = require('./autogen/requests');
var stdatoms = require('./stdatoms');

function XClient(stream, displayNum, screenNum)
{
    EventEmitter.call(this);
    this.stream = stream;

    this.core_requests = {};
    this.ext_requests = {};

    this.displayNum = displayNum;
    this.screenNum = screenNum;
    this.authHost = os.hostname();

    pack_stream = new PackStream();

    // data received from stream is dispached to
    // read requests set by calls to .unpack and .unpackTo
    //stream.pipe(pack_stream);
   
     // pack_stream write requests are buffered and
    // flushed to stream as result of call to .flush
    // TODO: listen for drain event and flush automatically 
    //pack_stream.pipe(stream);
    
    pack_stream.on('data', function( data ) {
        //console.error(hexy(data, {prefix: 'from packer '}));
        //for (var i=0; i < data.length; ++i)
        //   console.log('<<< ' + data[i]);
        stream.write(data);
    });
    stream.on('data', function( data ) {
        //console.error(hexy(data, {prefix: 'to unpacker '}));
        //for (var i=0; i < data.length; ++i)
        //   console.log('>>> ' + data[i]);
        pack_stream.write(data);
    });

    this.pack_stream = pack_stream;

    this.rsrc_id = 0; // generated for each new resource
    this.seq_num = 0; // incremented in each request. (even if we don't expect reply)
    this.seq2stack = {}; // debug: map seq_num to stack at the moment request was issued   
 
    // in/out packets indexed by sequence ID
    this.replies = {};
    this.atoms = stdatoms;
    this.event_consumers = {}; // maps window id to eventemitter TODO: bad name
   
    this.importRequestsFromTemplates(this, coreRequests);
    
    this.startHandshake();
}
util.inherits(XClient, EventEmitter);

// TODO: close() = set 'closing' flag, watch it in replies and writeQueue, terminate if empty
XClient.prototype.terminate = function()
{
    this.stream.end();
}

XClient.prototype.importRequestsFromTemplates = function(target, reqs)
{
    var client = this;
    for (r in reqs)
    {
        // r is request name
        target[r] = (function(reqName) { 
            
            var reqFunc = function req_proxy() {
            client.seq_num++; // TODO: handle overflow (seq should be last 15 (?)  bits of the number

            var err = new Error;
            err.name = reqName;
            Error.captureStackTrace(err, arguments.callee);
            client.seq2stack[client.seq_num] = err.stack;

            // is it fast?
            var args = Array.prototype.slice.call(req_proxy.arguments);

            var callback = args.length > 0 ? args[args.length - 1] : null;
            if (callback && callback.constructor.name != 'Function')
                callback = null;

            // TODO: see how much we can calculate in advance (not in each request)
            var reqReplTemplate = reqs[reqName];
            var reqTemplate  = reqReplTemplate[0];
            var templateType = typeof reqTemplate;

            if (templateType == 'object')
                templateType = reqTemplate.constructor.name;

            if (templateType == 'function')
            {
                 // call template with input arguments (not including callback which is last argument TODO currently with callback. won't hurt)
                 //reqPack = reqTemplate.call(args);
                 var reqPack = reqTemplate.apply(this, req_proxy.arguments); 
                 var format = reqPack[0];
                 var requestArguments = reqPack[1];

                 if (callback)
                     this.replies[this.seq_num] = [reqReplTemplate[1], callback];
                 
                 client.pack_stream.pack(format, requestArguments);
                 var b = client.pack_stream.write_queue[0];
                 client.pack_stream.flush();
                 
            } else if (templateType == 'Array'){
                 var format = reqTemplate[0];
                 var requestArguments = [];

                 for (a = 0; a < reqTemplate[1].length; ++a)
                     requestArguments.push(reqTemplate[1][a]);                 
                 for (a in args)
                     requestArguments.push(args[a]);

                 if (callback)
                     this.replies[this.seq_num] = [reqReplTemplate[1], callback];

                 client.pack_stream.pack(format, requestArguments);
                 client.pack_stream.flush();
            } else {
                 throw 'unknown request format - ' + templateType;
            }
        }
        return reqFunc;
        })(r);
    }
}

XClient.prototype.AllocID = function()
{
    // TODO: handle overflow (XCMiscGetXIDRange from XC_MISC ext)
    // TODO: unused id buffer
    this.display.rsrc_id++;
    return (this.display.rsrc_id << this.display.rsrc_shift) + this.display.resource_base;
}

XClient.prototype.unpackEvent = function(type, seq, extra, code, raw)
{
    var event = {}; // TODO: constructor & base functions
    event.type = type;
    event.seq = seq;

    if (type == 2 || type == 3 || type == 4 || type == 5 || type == 6) { // motion event
        var values = raw.unpack('LLLssssSC');
        //event.raw = values;
        // TODO: use unpackTo???
        event.time = extra;
        event.keycode = code;        
        event.root = values[0];
        event.wid = values[1];
        event.child = values[2];
        event.rootx = values[3];
        event.rooty = values[4];
        event.x = values[5];
        event.y = values[6];
        event.buttons = values[7];
        event.sameScreen = values[8];
    } else if (type == 12) { // Expose
        var values = raw.unpack('SSSSS');
        event.wid = extra;
        event.x = values[0];
        event.y = values[1];
        event.width = values[2];
        event.height = values[3];
        event.count = values[4]; // TODO: ???
    } else if (type == 16) { // CreateNotify
        var values = raw.unpack('LLssSSSc');
        event.parent = extra;
        event.wid = values[0];
        event.x = values[2];
        event.y = values[3];
        event.width = values[4];
        event.height = values[5];
        event.overrideRedirect = values[6] ? true : false;
        // x, y, width, height, border
    } else if (type == 17) { // destroy notify
        var values = raw.unpack('LL');
        event.wid = extra;
        event.wid1 = values[0];
    } else if (type == 19) { // MapNotify
        var values = raw.unpack('LLC');
        event.wid = extra;
        event.wid1 = values[0];
    } else if (type == 20) {
        var values = raw.unpack('LL');
        event.parent = extra;
        event.wid = values[0]
    } else if (type == 23) {
        var values = raw.unpack('LLLssSSS');
        event.parent = extra;
        event.wid = values[0];
        event.x = values[1]
        event.y = values[2]
        event.width = values[3]
        event.height = values[4]
        event.borderWidth = values[5];
        // 
        // The value-mask indicates which components were specified in
        // the request. The value-mask and the corresponding values are reported as given
        // in the request. The remaining values are filled in from the current geometry of the
        // window, except in the case of sibling and stack-mode, which are reported as None
        // and Above (respectively) if not given in the request.
        event.mask = values[6]; 
        // 322, [ 12582925, 0, 0, 484, 316, 1, 12, 0
        //console.log([extra, code, values]);
    }
    return event;
}

XClient.prototype.expectReplyHeader = function()
{
    // TODO: BigReq!!!!

    var client = this;
    client.pack_stream.get( 8, function(headerBuf) {
            var res = headerBuf.unpack('CCSL');
            var type = res[0];
            var seq_num = res[2];

            if (type == 0)
            {              
                var error_code = res[1];
                var error = {};
                error.error = error_code;
                error.seq = seq_num;
                error.message = xerrors.errorText[error_code];
                error.stack = client.seq2stack[error.seq]

                // unpack error packet (32 bytes for all error types, 8 of them in CCSL header)
                client.pack_stream.get(24, function(buf) {
                    // TODO: dispatch, use sequence number
                    //TODO: add more generic way to read common values
                    // if (error_code == 14)
                    {
                        var res = buf.unpack('LSC');
                        error.badParam = res[0]; // id: GC, WinID, Font, Atom etc; Value
                        error.minorOpcode = res[1];
                        error.majorOpcode = res[2];                       
                    }
                    var handler = client.replies[seq_num];
                    if (handler) {
                        var callback = handler[1];
                        var handled = callback(error);
                        if (!handled)
                            client.emit('error', error);
                        // TODO: should we delete seq2stack and reply even if there is no handler?
                        delete client.seq2stack[seq_num];
                        delete client.replies[seq_num];
                    } else
                        client.emit('error', error);
                    client.expectReplyHeader();
                } ); 
                return;
            } else if (type > 1)
            {
                client.pack_stream.get(24, function(buf) {
                    var extra = res[3];
                    var code = res[1];
                    var ev = client.unpackEvent(type, seq_num, extra, code, buf);
              
                    // raw event 32-bytes packet (primarily for use in SendEvent);
                    // TODO: Event::pack based on event parameters, inverse to unpackEvent
                    ev.rawData = new Buffer(32);
                    headerBuf.copy(ev.rawData);
                    buf.copy(ev.rawData, 8);
                    
                    client.emit('event', ev);
                    var ee = client.event_consumers[ev.wid];
                    if (ee) {
                       ee.emit('event', ev);
                    }
                    client.expectReplyHeader();
                } ); 
                return;
            }

            var opt_data = res[1];
            var length_total = res[3];            // in 4-bytes units, _including_ this header
            var bodylength = 24 + length_total*4; // 24 is rest if 32-bytes header

            client.pack_stream.get( bodylength, function( data ) {
                
                var handler = client.replies[seq_num];
                if (handler) {
                    var unpack = handler[0];
                    var result = unpack( data, opt_data, bodylength );
                    var callback = handler[1];
                    callback(result);
                    // TODO: add multiple replies flag and delete handler only after last reply (eg ListFontsWithInfo)
                    delete client.replies[seq_num];
                }
                // wait for new packet from server
                client.expectReplyHeader();
            });        
        } 
    );
}

XClient.prototype.startHandshake = function()
{
    var client = this;

    handshake.writeClientHello(this.pack_stream, this.displayNum, this.authHost);
    handshake.readServerHello(this.pack_stream, function(display) 
    {
        // TODO: readServerHello can set error state in display
        // emit error in that case
        client.expectReplyHeader();
        client.display = display;
        display.client = client;
        client.emit('connect', display);
    });   
}

XClient.prototype.require = function(extName, callback)
{
   var ext = require('./ext/' + extName);
   ext.requireExt(this.display, callback);
}

module.exports.createClient = function(initCb, display)
{
    if (!display)
       display = process.env.DISPLAY;
    if (!display)
        display = ':0';

    var displayMatch = display.match(/^(?:[^:]*?\/)?(.*):(\d+)(?:.(\d+))?$/);
    var host = displayMatch[1];
    if (!host)
        host = '127.0.0.1';

    var displayNum = displayMatch[2];
    if (!displayNum)
        displayNum = 0;
    var screenNum = displayMatch[3];
    if (!screenNum)
        screenNum = 0;
    
    // open stream
    var stream;
    var socketPath;

    // try local socket on non-windows platforms
    if ( ['cygwin', 'win32', 'win64'].indexOf(process.platform) < 0 )
    {
        if (process.platform == 'darwin' || process.platform == 'mac')
        {
            // socket path on OSX is /tmp/launch-(some id)/org.x:0
            if (display[0] == '/') 
            {
                socketPath = display;
            }           
        } else if(host == '127.0.0.1') //TODO check if it's consistent with xlib (DISPLAY=127.0.0.1:0 -> local unix socket or port 6000?)
            socketPath = '/tmp/.X11-unix/X' + displayNum;
    } 
    if(socketPath)
    {
    	stream = net.createConnection(socketPath);
    }
    else
    {
    	stream = net.createConnection(6000 + parseInt(displayNum), host);
    }
    var client = new XClient(stream, displayNum, screenNum);
    if (initCb)
    {
        client.on('connect', function(display) {
            initCb(display);
        });
    } 
    return client;     
}
