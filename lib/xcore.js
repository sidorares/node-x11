const handshake = require('./handshake');
//var xevents = require('./xevents');

const EventEmitter = require('events').EventEmitter;
const PackStream = require('./framebuffer');

const Buffer = require('buffer').Buffer;

const xerrors = require('./xerrors');
const coreRequests = require('./corereqs');
const stdatoms = require('./stdatoms');
const em = require('./eventmask').eventMask;
const coreEvents = require('./generated/core-events');

// Static require map so bundlers (esbuild/webpack) can resolve
// X.require('name') without dynamic-require support.
const extensionModules = {
    'apple-wm': () => require('./ext/apple-wm'),
    'big-requests': () => require('./ext/big-requests'),
    'composite': () => require('./ext/composite'),
    'damage': () => require('./ext/damage'),
    'dbe': () => require('./ext/dbe'),
    'dpms': () => require('./ext/dpms'),
    'fixes': () => require('./ext/fixes'),
    'ge': () => require('./ext/ge'),
    'glx': () => require('./ext/glx'),
    'present': () => require('./ext/present'),
    'randr': () => require('./ext/randr'),
    'record': () => require('./ext/record'),
    'render': () => require('./ext/render'),
    'res': () => require('./ext/res'),
    'screen-saver': () => require('./ext/screen-saver'),
    'shape': () => require('./ext/shape'),
    'shm': () => require('./ext/shm'),
    'sync': () => require('./ext/sync'),
    'xc-misc': () => require('./ext/xc-misc'),
    'xinerama': () => require('./ext/xinerama'),
    'xinput': () => require('./ext/xinput'),
    'xkb': () => require('./ext/xkb'),
    'xtest': () => require('./ext/xtest'),
    'xv': () => require('./ext/xv')
};

// Pluggable DISPLAY connection protocols: `proto/resource:display.screen`.
// Handlers receive { display, host, displayNum, screenNum, options } and
// return a duplex-stream-like object (write/end + 'data'/'end'/'error'
// events). If the stream is not immediately usable it must set
// `connecting = true` and emit 'connect' once ready (net.Socket semantics).
const displayProtocols = {};

function registerDisplayProtocol(name, connect) {
    if (typeof connect !== 'function')
        throw new TypeError('registerDisplayProtocol expects a connect function');
    displayProtocols[name] = connect;
}

function parseDisplay(display) {
    const displayMatch = display.match(/^(?:([A-Za-z][A-Za-z0-9+.-]*)\/)?(.*):(\d+)(?:\.(\d+))?$/);
    if (!displayMatch)
        throw new Error('Cannot parse display');
    return {
        display: display,
        protocol: displayMatch[1] || '',
        host: displayMatch[2],
        displayNum: displayMatch[3] || 0,
        screenNum: displayMatch[4] || 0
    };
}

function hostname() {
    try {
        return require('os').hostname();
    } catch {
        return 'localhost'; // browser bundle: no os module
    }
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
Object.setPrototypeOf(XClient.prototype, EventEmitter.prototype);

XClient.prototype.init = function(stream)
{
    this.stream = stream;

    this.authHost = stream.remoteAddress;
    // Node v0.10.x does not have stream.remoteFamily, so dig in to find it
    this.authFamily = stream._getpeername ? stream._getpeername().family : stream.remoteFamily;
    if (!this.authHost || this.authHost === '127.0.0.1' || this.authHost === '::1') {
      this.authHost = hostname();
      this.authFamily = null;
    }

    const pack_stream = new PackStream();
    const client = this;
    // Outbound: FrameBuffer.attach handles write + drain/backpressure
    pack_stream.attach(stream);
    pack_stream.on('drain', () => {
        client.emit('drain');
    });
    stream.on('data', data => {
        pack_stream.write(data);
    });
    stream.on('end', () => {
        client.emit('end');
    });

    this.pack_stream = pack_stream;

    this.rsrc_id = 0; // generated for each new resource

    // seq_num is full-width and never wraps: requests don't carry it on the
    // wire, and incoming 16-bit sequence numbers are widened in _widenSeq.
    this._recv_seq = 0;        // full seq of the last packet received
    this._last_seq_anchor = 0; // seq of the last reply-generating request sent
    this._last_void_seq = 0;   // seq of the last void request with a callback
    this._void_sync_scheduled = false;
    this._injecting_anchor = false;

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
    // GenericEvent (type 35) parsers, keyed by extension major opcode
    this.geEventParsers = {};
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

XClient.prototype.ping = function(cb) {
   const start = Date.now();
   this.sync(err => {
      if (err) return cb(err);
      return cb(null, Date.now() - start);
   });
}

// Round trip to the server: the callback fires once every request issued so
// far has been processed. Any errors those requests caused have been
// delivered by then, so this is the barrier XSync/xcb_request_check provide.
// Without a callback a Promise is returned.
XClient.prototype.sync = function(cb) {
    if (!cb) {
        return new Promise((resolve, reject) => {
            this.sync(err => (err ? reject(err) : resolve()));
        });
    }
    // GetInputFocus is the traditional cheapest request with a reply
    this.GetInputFocus(err => {
        cb(err || null);
        return true;
    });
}

// The callback fires once all request bytes buffered so far have been handed
// to the OS (issue #195). Without a callback a Promise is returned.
XClient.prototype.flush = function(cb) {
    if (!cb) {
        return new Promise(resolve => {
            this.flush(resolve);
        });
    }
    this.pack_stream.flush(cb);
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

            // Wire sequence numbers are 16 bits. Keep at least one
            // reply-generating request in every 60000-request window so
            // incoming numbers widen unambiguously (libxcb does the same).
            if (!client._injecting_anchor &&
                client.seq_num - client._last_seq_anchor >= 60000) {
               client._injecting_anchor = true;
               client.GetInputFocus(() => true);
               client._injecting_anchor = false;
            }

            client.seq_num++;

            // A trailing function is the callback. Test the type, not the
            // constructor name: an async or generator function is still a
            // callable, and an object with a null prototype has no
            // constructor to name at all.
            let callback = args.length > 0 ? args[args.length - 1] : null;
            if (typeof callback !== 'function')
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
                         setImmediate(() => {
                             callback(undefined, client.atoms[value]);
                         });
                         return true;
                     } else {
                         client.pending_atoms[client.seq_num] = value;
                     }
                 }

                 if (reqName === 'GetAtomName') {
                     const atom = args[0];
                     if (client.atom_names[atom]) {
                         -- client.seq_num;
                         setImmediate(() => {
                             callback(undefined, client.atom_names[atom]);
                         });
                         return true;
                     } else {
                         client.pending_atoms[client.seq_num] = atom;
                     }
                 }

                 // pack template returns a Buffer (Buffer.write* style)
                 const packet = reqTemplate.apply(this, args);
                 if (!Buffer.isBuffer(packet))
                     throw new TypeError(`${reqName}: pack template must return a Buffer`);

                 const expectsReply = !!reqReplTemplate[1];
                 if (expectsReply)
                     client._last_seq_anchor = client.seq_num;

                 if (callback) {
                     this.replies[this.seq_num] = [reqReplTemplate[1], callback, reqReplTemplate[2]];
                     // a void request only hears back on failure; make sure a
                     // later reply confirms its success (issue #85)
                     if (!expectsReply)
                         client._scheduleVoidSync(this.seq_num);
                 }

                 client.pack_stream.put(packet);
                 // false = socket backpressure: pause and wait for 'drain'
                 return client.pack_stream.flush();

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
    if (type === 35) {
        // GenericEvent: code = extension major opcode, extra = extra length
        // in 4-byte units, raw = event bytes 8+ (evtype at raw offset 0)
        const geUnpacker = this.geEventParsers[code];
        if (geUnpacker)
            return geUnpacker(type, seq, extra, code, raw);
        return { type: type, seq: seq, extension: code, evtype: raw.readUInt16LE(0), raw: raw };
    }
    const extUnpacker = this.eventParsers[type];
    if (extUnpacker)
        return extUnpacker(type, seq, extra, code, raw);
    return coreEvents.unpackEvent(type, seq, extra, code, raw, headerBuf);
}

// Server packets carry only the low 16 bits of the request sequence number;
// reconstruct the full value. Packets arrive in non-decreasing sequence
// order, and request issuing guarantees an anchor (a reply) at least every
// 60000 requests, so the gap between consecutive received numbers is < 2^16.
XClient.prototype._widenSeq = function(wire16)
{
    let full = this._recv_seq - (this._recv_seq % 0x10000) + wire16;
    if (full < this._recv_seq)
        full += 0x10000;
    this._recv_seq = full;
    return full;
}

// The server processes requests in order and sends errors immediately, so
// once a packet with sequence number `uptoSeq` arrives, every void request
// up to it that did not error has succeeded: fire its callback (issue #85).
XClient.prototype._sweepVoid = function(uptoSeq)
{
    let done = null;
    for (const key in this.replies) {
        const seq = +key;
        if (seq > uptoSeq)
            break; // integer keys enumerate in ascending order
        const handler = this.replies[seq];
        if (handler[0])
            continue; // expects a reply; resolved by its own reply packet
        delete this.replies[seq];
        if (this.options.debug)
            delete this.seq2stack[seq];
        (done = done || []).push(handler[1]);
    }
    if (done)
        for (const callback of done)
            callback(null);
}

// A void request's success is only observable once the server gets past it.
// If nothing after it will generate a reply, force a cheap round trip so the
// callback always fires. Coalesced: one round trip covers any number of void
// requests issued in the same tick.
XClient.prototype._scheduleVoidSync = function(seq)
{
    this._last_void_seq = seq;
    if (this._void_sync_scheduled)
        return;
    this._void_sync_scheduled = true;
    setImmediate(() => {
        this._void_sync_scheduled = false;
        if (this._closing || (this.stream && this.stream.writableEnded))
            return;
        // skip if a reply-generating request was sent after the void request
        // (its reply confirms it) or the server already got past it
        if (this._last_seq_anchor < this._last_void_seq &&
            this._recv_seq < this._last_void_seq)
            this.GetInputFocus(() => true);
    });
}

XClient.prototype.expectReplyHeader = function()
{
    const client = this;
    client.pack_stream.get( 8, headerBuf => {
            // CCSL: type, detail/error_code/opt, seq, length_or_extra
            const type = headerBuf.readUInt8(0);
            const detail = headerBuf.readUInt8(1);
            // KeymapNotify (11) is the only packet without a sequence number
            const seq_num = (type & 0x7f) === 11 ?
                client._recv_seq : client._widenSeq(headerBuf.readUInt16LE(2));
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

                    client._sweepVoid(seq_num - 1);
                    // dispatch can throw — most commonly emit('error') with no
                    // listener attached. Re-arm the parser regardless: without
                    // it the connection silently drops every later packet
                    try {
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
                    } finally {
                        client.expectReplyHeader();
                    }
                } );
                return;
            } else if (type > 1)
            {
                // GenericEvent (35) carries its extra length (in 4-byte units)
                // where other events keep 32-bit event data
                const event_body_length = (type & 0x7f) === 35 ? 24 + bad_value * 4 : 24;
                client.pack_stream.get(event_body_length, buf => {
                    client._sweepVoid(seq_num);
                    const extra = bad_value;
                    const code = detail;
                    const ev = client.unpackEvent(type, seq_num, extra, code, buf, headerBuf);

                    // raw event packet, 32 bytes unless GenericEvent (primarily
                    // for use in SendEvent);
                    // TODO: Event::pack based on event parameters, inverse to unpackEvent
                    ev.rawData = Buffer.alloc(8 + buf.length);
                    headerBuf.copy(ev.rawData);
                    buf.copy(ev.rawData, 8);

                    // a throwing event consumer must not kill the parser
                    try {
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
                    } finally {
                        client.expectReplyHeader();
                    }
                } );
                return;
            }

            let opt_data = detail;
            const length_total = bad_value;         // in 4-bytes units, _including_ this header
            const bodylength = 24 + length_total*4; // 24 is rest if 32-bytes header

            client.pack_stream.get( bodylength, data => {

                client._sweepVoid(seq_num);
                // a throwing reply callback must not kill the parser
                try {
                    const handler = client.replies[seq_num];
                    if (handler) {
                        const unpack = handler[0];
                        if (client.pending_atoms[seq_num]) {
                            opt_data = seq_num;
                        }

                        const result = unpack.call(client, data, opt_data);
                        const callback = handler[1];
                        if (handler[2]) {
                            // multi-reply request (eg ListFontsWithInfo):
                            // unpack returns undefined for the terminating reply
                            if (result === undefined) {
                                callback(null, handler[3] || []);
                                delete client.replies[seq_num];
                            } else {
                                (handler[3] = handler[3] || []).push(result);
                            }
                        } else {
                            callback(null, result);
                            delete client.replies[seq_num];
                        }
                    }
                } finally {
                    // wait for new packet from server
                    client.expectReplyHeader();
                }
            });
        }
    );
}

XClient.prototype.startHandshake = function() {
    const client = this;

    handshake.writeClientHello(this.pack_stream, this.displayNum, this.authHost, this.authFamily, this.options.auth);
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

   const loadExt = extensionModules[extName];
   if (!loadExt) {
       return process.nextTick(() => {
           callback(new Error(`unknown extension: ${extName}`));
       });
   }
   ext = loadExt();
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

    const env = (typeof process === 'object' && process.env) ? process.env : {};
    const platform = (typeof process === 'object' && process.platform) ? process.platform : 'browser';

    let display = options.display;
    if (!display)
        display = env.DISPLAY ? env.DISPLAY : ':0';

    const parsed = parseDisplay(display);
    const protocol = parsed.protocol;
    let host = parsed.host;
    const displayNum = parsed.displayNum;
    const screenNum = parsed.screenNum;

    // open stream
    let stream;
    let connected = false;
    let cbCalled = false;
    let socketPath;

    const client = new XClient(displayNum, screenNum, options);

    const onStreamError = err => {
        if (initCb && !cbCalled) {
            cbCalled = true;
            initCb(err);
        } else {
            client.emit('error', err);
        }
    };

    const attachStream = () => {
        stream.on('connect', () => {
            if (connected) return;
            connected = true;
            client.init(stream);
        });
        if (!stream.connecting && stream.readyState !== 'opening') {
            // already-open streams (options.stream / custom transports that
            // hand back a usable duplex) never emit 'connect'
            queueMicrotask(() => {
                if (!connected) {
                    connected = true;
                    client.init(stream);
                }
            });
        }
    };

    const customProtocol = protocol && !['unix', 'local', 'tcp', 'inet', 'inet6'].includes(protocol);

    if (options.stream || customProtocol) {
        // Injected streams and custom transports have no Xauthority file to
        // consult; default to an empty auth handshake unless told otherwise.
        if (!('auth' in options))
            options.auth = { name: '', data: '' };
    }

    if (options.stream) {
        stream = options.stream;
        stream.on('error', onStreamError);
        attachStream();
    } else if (customProtocol) {
        const connect = displayProtocols[protocol];
        if (!connect)
            throw new Error(`unknown display protocol: ${protocol} (register it with registerDisplayProtocol)`);
        stream = connect(parsed, options);
        stream.on('error', onStreamError);
        attachStream();
    } else {
        // built-in transports: unix socket and/or TCP
        const forceUnix = protocol === 'unix' || protocol === 'local';
        const forceTcp = protocol === 'tcp' || protocol === 'inet' || protocol === 'inet6';

        if (!forceTcp && !['cygwin', 'win32', 'win64'].includes(platform))
        {
            if (platform == 'darwin' || platform == 'mac')
            {
                // socket path on OSX is /tmp/launch-(some id)/org.x:0
                if (display[0] == '/')
                {
                    socketPath = display;
                }
                else if (forceUnix)
                    socketPath = `/tmp/.X11-unix/X${displayNum}`;
                else if (!host)
                {
                    // Xvfb, Xephyr and Xnest on macOS create the standard
                    // socket and advertise a plain ":N" DISPLAY, which used
                    // to fall through to TCP 6000+N and fail to connect.
                    // Only take it if it is really there, so a display that
                    // genuinely means TCP still gets TCP.
                    const candidate = `/tmp/.X11-unix/X${displayNum}`;
                    if (require('fs').existsSync(candidate))
                        socketPath = candidate;
                }
            } else if(!host || forceUnix)
                socketPath = `/tmp/.X11-unix/X${displayNum}`;
        }

        const net = require('net');
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
                } else {
                    onStreamError(err);
                }
            });
        };
        connectStream();
    }
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

module.exports.registerDisplayProtocol = registerDisplayProtocol;
module.exports.parseDisplay = parseDisplay;
