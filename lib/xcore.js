const util = require('util'); // util.inherits
const net = require('net');

const handshake = require('./handshake');
//var xevents = require('./xevents');

const EventEmitter = require('events').EventEmitter;
const PackStream = require('./framebuffer');

const Buffer = require('buffer').Buffer;

const os = require('os');

const xerrors = require('./xerrors');
const coreRequests = require('./corereqs');
const stdatoms = require('./stdatoms');
const em = require('./eventmask').eventMask;
const coreEvents = require('./generated/core-events');

function stash ()
{
    require('./ext/apple-wm');
    require('./ext/big-requests');
    require('./ext/composite');
    require('./ext/damage');
    require('./ext/dpms');
    require('./ext/fixes');
    require('./ext/glxconstants');
    require('./ext/glx');
    require('./ext/glxrender');
    require('./ext/randr');
    require('./ext/render');
    require('./ext/screen-saver');
    require('./ext/shape');
    require('./ext/xc-misc');
    require('./ext/xtest');
}

function XClient(displayNum, screenNum, options)
{
    EventEmitter.call(this);
    this.options = options ? options : {};

    // TODO: this is probably not used
    this.core_requests = {};
    this.ext_requests = {};

    this.displayNum = displayNum;
    this.screenNum = screenNum;
}
util.inherits(XClient, EventEmitter);

XClient.prototype.init = function(stream)
{
    this.stream = stream;

    this.authHost = stream.remoteAddress;
    // Node v0.10.x does not have stream.remoteFamily, so dig in to find it
    this.authFamily = stream._getpeername ? stream._getpeername().family : stream.remoteFamily;
    if (!this.authHost || this.authHost === '127.0.0.1' || this.authHost === '::1') {
      this.authHost = os.hostname();
      this.authFamily = null;
    }

    const pack_stream = new PackStream();
    const client = this;
    // Outbound: FrameBuffer.attach handles write + drain/backpressure
    pack_stream.attach(stream);
    stream.on('data', data => {
        pack_stream.write(data);
    });
    stream.on('end', () => {
        client.emit('end');
    });

    this.pack_stream = pack_stream;

    this.rsrc_id = 0; // generated for each new resource
    const cli = this;
    if (cli.options.debug) {
      this.seq_num_ = 0;
      this.seq2stack = {}; // debug: map seq_num to stack at the moment request was issued
      Object.defineProperty(cli, "seq_num", {
        set : function seqNumSetter(v) {
          cli.seq_num_ = v;
          const err = new Error();
          Error.captureStackTrace(err, seqNumSetter);
          err.timestamp = Date.now();
          cli.seq2stack[client.seq_num] = err;
        },
        get() {
	  return cli.seq_num_;
        }
      });
    } else {
      this.seq_num = 0;
    }


    // in/out packets indexed by sequence ID
    this.replies = {};
    this.atoms = stdatoms;
    this.atom_names = (() => {
        const names = {};
        Object.keys(stdatoms).forEach(key => {
            names[stdatoms[key]] = key;
        });

        return names;
    })();

    this.eventMask = em;

    this.event_consumers = {}; // maps window id to eventemitter TODO: bad name
    this.eventParsers = {};
    this.errorParsers = {};
    this._extensions = {};

    this.importRequestsFromTemplates(this, coreRequests);

    this.startHandshake();
    this._closing = false;
    this._unusedIds = [];
}

// TODO: close() = set 'closing' flag, watch it in replies and writeQueue, terminate if empty
XClient.prototype.terminate = function()
{
    this.stream.end();
}

// GetAtomName used as cheapest non-modifying request with reply
// 3 - id for shortest standard atom, "ARC"
XClient.prototype.ping = function(cb) {
   const start = Date.now();
   this.GetAtomName(3, (err, str) => {
      if (err) return cb(err);
      return cb(null, Date.now() - start);
   });
}

XClient.prototype.close = function(cb) {
    const cli = this;
    cli.ping(err => {
      if (err) return cb(err);
      cli.terminate();
      if (cb) cb();
    });
    cli._closing = true;
}

XClient.prototype.importRequestsFromTemplates = function(target, reqs)
{
    const client = this;
    this.pending_atoms = {};
    for (const r in reqs)
    {
        // r is request name
        target[r] = (reqName => {

            const reqFunc = function req_proxy(...args) {

            if (client._closing)
               throw new Error('client is in closing state');

            // simple overflow handling (this means that currently there is no way to have more than 65535 requests in the queue
            // TODO: edge cases testing
            if (client.seq_num == 65535)
               client.seq_num = 0;
            else
               client.seq_num++;

            let callback = args.length > 0 ? args[args.length - 1] : null;
            if (callback && callback.constructor.name != 'Function')
                callback = null;

            // TODO: see how much we can calculate in advance (not in each request)
            const reqReplTemplate = reqs[reqName];
            const reqTemplate  = reqReplTemplate[0];
            let templateType = typeof reqTemplate;

            if (templateType == 'object')
                templateType = reqTemplate.constructor.name;

            if (templateType == 'function')
            {
                 if (reqName === 'InternAtom') {
                     const value = args[1];
                     if (client.atoms[value]) {
                         -- client.seq_num;
                         return setImmediate(() => {
                             callback(undefined, client.atoms[value]);
                         });
                     } else {
                         client.pending_atoms[client.seq_num] = value;
                     }
                 }

                 if (reqName === 'GetAtomName') {
                     const atom = args[0];
                     if (client.atom_names[atom]) {
                         -- client.seq_num;
                         return setImmediate(() => {
                             callback(undefined, client.atom_names[atom]);
                         });
                     } else {
                         client.pending_atoms[client.seq_num] = atom;
                     }
                 }

                 // pack template returns a Buffer (Buffer.write* style)
                 const packet = reqTemplate.apply(this, args);
                 if (!Buffer.isBuffer(packet))
                     throw new TypeError(`${reqName}: pack template must return a Buffer`);

                 if (callback)
                     this.replies[this.seq_num] = [reqReplTemplate[1], callback];

                 client.pack_stream.put(packet);
                 client.pack_stream.flush();

            } else if (templateType == 'Array'){
                 // legacy: should not happen once all templates are functions returning Buffer
                 throw new Error(`${reqName}: array pack templates are no longer supported; return a Buffer`);
            } else {
                 throw `unknown request format - ${templateType}`;
            }
        };
        return reqFunc;
        })(r);
    }
}

XClient.prototype.AllocID = function()
{
  if (this._unusedIds.length > 0) {
    return this._unusedIds.pop();
  }
  // TODO: handle overflow (XCMiscGetXIDRange from XC_MISC ext)
  this.display.rsrc_id++;
  return (this.display.rsrc_id << this.display.rsrc_shift) + this.display.resource_base;
};

XClient.prototype.ReleaseID = function(id) {
  this._unusedIds.push(id);
};

// Core events: generated from autogen/proto/xproto.xml via `npm run gen:events`.
// Extension events still use this.eventParsers[type].
XClient.prototype.unpackEvent = function(type, seq, extra, code, raw, headerBuf)
{
    type = type & 0x7F;
    const extUnpacker = this.eventParsers[type];
    if (extUnpacker)
        return extUnpacker(type, seq, extra, code, raw);
    return coreEvents.unpackEvent(type, seq, extra, code, raw, headerBuf);
}

XClient.prototype.expectReplyHeader = function()
{
    const client = this;
    client.pack_stream.get( 8, headerBuf => {
            // CCSL: type, detail/error_code/opt, seq, length_or_extra
            const type = headerBuf.readUInt8(0);
            const detail = headerBuf.readUInt8(1);
            const seq_num = headerBuf.readUInt16LE(2);
            const bad_value = headerBuf.readUInt32LE(4);

            if (type == 0)
            {
                const error_code = detail;
                const error = new Error();
                error.error = error_code;
                error.seq = seq_num;
                if (client.options.debug) {
                  error.longstack = client.seq2stack[error.seq]
                  console.log(client.seq2stack[error.seq].stack);
                }

                // unpack error packet (32 bytes for all error types, 8 of them in header)
                client.pack_stream.get(24, buf => {

		    error.message = xerrors.errorText[error_code];
		    error.badParam = bad_value;
		    error.minorOpcode = buf.readUInt16LE(0);
		    error.majorOpcode = buf.readUInt8(2);

	            const extUnpacker = client.errorParsers[error_code];
                    if (extUnpacker) {
                      extUnpacker(error, error_code, seq_num, bad_value, buf);
                    }

                    const handler = client.replies[seq_num];
                    if (handler) {
                        const callback = handler[1];
                        const handled = callback(error);
                        if (!handled)
                            client.emit('error', error);
                        // TODO: should we delete seq2stack and reply even if there is no handler?
			if (client.options.debug)
                          delete client.seq2stack[seq_num];
                        delete client.replies[seq_num];
                    } else
                        client.emit('error', error);
                    client.expectReplyHeader();
                } );
                return;
            } else if (type > 1)
            {
                client.pack_stream.get(24, buf => {
                    const extra = bad_value;
                    const code = detail;
                    const ev = client.unpackEvent(type, seq_num, extra, code, buf, headerBuf);

                    // raw event 32-bytes packet (primarily for use in SendEvent);
                    // TODO: Event::pack based on event parameters, inverse to unpackEvent
                    ev.rawData = Buffer.alloc(32);
                    headerBuf.copy(ev.rawData);
                    buf.copy(ev.rawData, 8);

                    client.emit('event', ev);
                    let ee = client.event_consumers[ev.wid];
                    if (ee) {
                       ee.emit('event', ev);
                    }
                    if (ev.parent) {
                       ee = client.event_consumers[ev.parent];
                       if (ee)
                         ee.emit('child-event', ev);
                    }
                    client.expectReplyHeader();
                } );
                return;
            }

            let opt_data = detail;
            const length_total = bad_value;         // in 4-bytes units, _including_ this header
            const bodylength = 24 + length_total*4; // 24 is rest if 32-bytes header

            client.pack_stream.get( bodylength, data => {

                const handler = client.replies[seq_num];
                if (handler) {
                    const unpack = handler[0];
                    if (client.pending_atoms[seq_num]) {
                        opt_data = seq_num;
                    }

                    const result = unpack.call(client, data, opt_data);
                    const callback = handler[1];
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

XClient.prototype.startHandshake = function() {
    const client = this;

    handshake.writeClientHello(this.pack_stream, this.displayNum, this.authHost, this.authFamily);
    handshake.readServerHello(this.pack_stream, (err, display) => {
        if (err) {
            client.emit('error', err);
            return;
        }
        client.expectReplyHeader();
        client.display = display;
        display.client = client;
        client.emit('connect', display);
    });
}

XClient.prototype.require = function(extName, callback)
{
   const self = this;
   let ext = this._extensions[extName];
   if (ext) {
       return process.nextTick(() => {
           callback(null, ext);
       });
   }

   ext = require(`./ext/${extName}`);
   ext.requireExt(this.display, (err, _ext) => {
       if (err) {
           return callback(err);
       }

       self._extensions[extName] = _ext;
       callback(null, _ext);
   });
};

module.exports.createClient = (options, initCb) => {
    if (typeof options === 'function') {
        initCb = options;
        options = {};
    }

    if (!options) options = {};

    let display = options.display;
    if (!display)
        display = (process.env.DISPLAY) ? process.env.DISPLAY : ':0';

    const displayMatch = display.match(/^(?:[^:]*?\/)?(.*):(\d+)(?:.(\d+))?$/);
    if (!displayMatch)
       throw new Error("Cannot parse display");

    let host = displayMatch[1];

    let displayNum = displayMatch[2];
    if (!displayNum)
        displayNum = 0;
    let screenNum = displayMatch[3];
    if (!screenNum)
        screenNum = 0;

    // open stream
    let stream;
    let connected = false;
    let cbCalled = false;
    let socketPath;

    // try local socket on non-windows platforms
    if ( !['cygwin', 'win32', 'win64'].includes(process.platform) )
    {
        if (process.platform == 'darwin' || process.platform == 'mac')
        {
            // socket path on OSX is /tmp/launch-(some id)/org.x:0
            if (display[0] == '/')
            {
                socketPath = display;
            }
        } else if(!host)
            socketPath = `/tmp/.X11-unix/X${displayNum}`;
    }
    const client = new XClient(displayNum, screenNum, options);

    const connectStream = () => {
        if (socketPath) {
            stream = net.createConnection(socketPath);
        } else {
            stream = net.createConnection(6000 + parseInt(displayNum), host);
        }
        stream.on('connect', () => {
            connected = true;
            client.init(stream);
        });
        stream.on('error', err => {
            if (!connected && socketPath && err.code === 'ENOENT') {
                // Retry connection with TCP on localhost
                socketPath = null;
                host = 'localhost';
                connectStream();
            } else if (initCb && !cbCalled) {
                cbCalled = true;
                initCb(err);
            } else {
                client.emit('error', err);
            }
        });
    };
    connectStream();
    if (initCb)
    {
        client.on('connect', display => {
            // opt-in BigReq
            if (!options.disableBigRequests) {
                client.require('big-requests', (err, BigReq) => {
                    if (err)
                        return initCb(err)
                    BigReq.Enable((err, maxLen) => {
                        display.max_request_length = maxLen;
	                cbCalled = true;
                        initCb(undefined, display);
                    });
                });
            } else {
	        cbCalled = true;
                initCb(undefined, display);
            }
        });
    }
    return client;
}
