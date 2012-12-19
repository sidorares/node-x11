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
var coreRequests = require('./corereqs');
var stdatoms = require('./stdatoms');

function XClient(stream, displayNum, screenNum, options)
{
    EventEmitter.call(this);
    this.stream = stream;
    this.options = options ? options : {};

    // TODO: this is probably not used
    this.core_requests = {};
    this.ext_requests = {};
    
    this.displayNum = displayNum;
    this.screenNum = screenNum;
    this.authHost = os.hostname();

    var pack_stream = new PackStream();

    // data received from stream is dispached to
    // read requests set by calls to .unpack and .unpackTo
    //stream.pipe(pack_stream);
   
    // pack_stream write requests are buffered and
    // flushed to stream as result of call to .flush
    // TODO: listen for drain event and flush automatically 
    //pack_stream.pipe(stream);
    var client = this;
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
    stream.on('end', function() {
        client.emit('end');
    });

    this.pack_stream = pack_stream;

    this.rsrc_id = 0; // generated for each new resource
    this.seq_num = 0; // incremented in each request. (even if we don't expect reply)
    this.seq2stack = {}; // debug: map seq_num to stack at the moment request was issued   
 
    // in/out packets indexed by sequence ID
    this.replies = {};
    this.atoms = stdatoms;
    this.event_consumers = {}; // maps window id to eventemitter TODO: bad name
    this.eventParsers = {};   

    this.importRequestsFromTemplates(this, coreRequests);
    
    this.startHandshake();
    this._closing = false;
}
util.inherits(XClient, EventEmitter);

// TODO: close() = set 'closing' flag, watch it in replies and writeQueue, terminate if empty
XClient.prototype.terminate = function()
{
    this.stream.end();
}

// GetAtomName used as cheapest non-modifying request with reply
// 3 - id for shortest standard atom, "ARC"
XClient.prototype.ping = function(cb) {
   var start = Date.now();
   this.GetAtomName(3, function(err, str) {
      if (err) return cb(err);
      return cb(null, Date.now() - start);
   });
}

XClient.prototype.close = function(cb) {
    var cli = this;
    cli.ping(function(err) {
      if (err) return cb(err);
      cli.terminate();
      if (cb) cb();
    });
    cli._closing = true;
}

XClient.prototype.importRequestsFromTemplates = function(target, reqs)
{
    var client = this;
    for (var r in reqs)
    {
        // r is request name
        target[r] = (function(reqName) { 
            
            var reqFunc = function req_proxy() {
            
            if (client._closing)
               throw new Error('client is in closing state');
   
            // simple overflow handling (this means that currently there is no way to have more than 65535 requests in the queue
            // TODO: edge cases testing 
            if (client.seq_num == 65535)
               client.seq_num = 0;
            else
               client.seq_num++;
           
            // disable long stack trace for the moment, it's too expensive
            // performance when enabled (travis-ci worker, Xfvb): 70000 requests finished in 52196 ms, 1341.0989347842747 req/sec
            // without: 70000 requests finished in 14904 ms, 4696.725711218465 req/sec
            // MBPro, XQuartz: with 3600 req/sec, without 24200 req/sec 
            if (this.options.debug === true) {
               var err = new Error();
               err.name = reqName; //???
               Error.captureStackTrace(err, arguments.callee);
               err.timestamp = Date.now();
               client.seq2stack[client.seq_num] = err;
            }

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

                 for (var a = 0; a < reqTemplate[1].length; ++a)
                     requestArguments.push(reqTemplate[1][a]);                 
                 for (var a in args)
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

    var extUnpacker = this.eventParsers[type];
    if (extUnpacker)
    {
        return extUnpacker(type, seq, extra, code, raw);
    }

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
        event.wid = values[0];
    } else if (type == 22) {
        var values = raw.unpack('LLssSSSC');
        event.wid = extra;
        event.wid1 = values[0];
        event.aboveSibling = values[1];
        event.x = values[2];
        event.y = values[3];
        event.width = values[4];
        event.height = values[5];
        event.borderWidth = values[6];
        event.overrideRedirect = values[7];
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
    } else if (type == 28) {// PropertyNotify
        event.name = 'PropertyNotify';
        var values = raw.unpack('LLC');
        event.window = extra;
        event.atom = values[0];
        event.time = values[1];
        event.state = values[2];
    } else if (type == 29) {// SelectionClear
        event.name = 'SelectionClear';
        event.time = extra;
        var values = raw.unpack('LL');
        event.owner = values[0];
        event.selection = values[1];
    } else if (type == 30) {// SelectionRequest
        event.name = 'SelectionRequest';
        event.time = extra;
        var values = raw.unpack('LLLLL');
        event.owner = values[0];
        event.requestor = values[1];
        event.selection = values[2];
        event.target = values[3];
        event.property = values[4];       
    } else if (type == 31) {// SelectionNotify
        event.name = 'SelectionNotify';
        event.time = extra;
        var values = raw.unpack('LLLL');
        event.requestor = values[0];
        event.selection = values[1];
        event.target = values[2];
        event.property = values[3];       
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
                var error = new Error();
                error.error = error_code;
                error.seq = seq_num;
                error.message = xerrors.errorText[error_code];
                if (client.options.debug)
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
                    var result = unpack( data, opt_data );
                    var callback = handler[1];
                    callback(null, result);
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

module.exports.createClient = function(options, initCb)
{
    if (typeof options === 'function') {
        initCb = options;
        options = {};
    }

    if (!options) options = {};

    var display = options.display;
    if (!display)
        display = (process.env.DISPLAY) ? process.env.DISPLAY : ':0';

    var displayMatch = display.match(/^(?:[^:]*?\/)?(.*):(\d+)(?:.(\d+))?$/);
    if (!displayMatch)
       throw new Error("Cannot parse display");

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
    //socketPath = '/tmp/.X11-unix/X' + displayNum;
    if(socketPath)
    {
    	stream = net.createConnection(socketPath);
    }
    else
    {
    	stream = net.createConnection(6000 + parseInt(displayNum), host);
    }
    var client = new XClient(stream, displayNum, screenNum, options);
    if (initCb)
    {
        client.on('connect', function(display) {
            // Once connected don't call initCb on error, just emit
            stream.removeListener('error', initCb);
            stream.on('error', function(err) {
                client.emit('error', err);
            });
            // opt-in BigReq
            if (!options.disableBigRequests) {
                client.require('big-requests', function(BigReq) {
                    BigReq.Enable(function(err, maxLen) {
                        display.max_request_length = maxLen;
                        initCb(undefined, display);
                    });
                });
            } else {
                initCb(undefined, display);
            }
        });

        stream.on('error', initCb);
    }
    return client;
}
