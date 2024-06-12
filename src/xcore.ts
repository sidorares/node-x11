import * as net from "net";

import * as handshake from "./handshake";

import { EventEmitter } from "events";
import { UnpackStream } from "./unpackstream";

import { Buffer } from "buffer";
import * as os from "os";

import * as xerrors from "./statics/xerrors";
import { templates as coreRequests } from "./corereqs";
import { stdatoms } from "./statics/stdatoms";
import { eventMask as em } from "./statics/eventmask";
import { XError } from "./statics/xerrors";

class XClient extends EventEmitter {
  options: any;
  core_requests: any;
  ext_requests: any;
  displayNum: number;
  screenNum: number;
  stream: any;
  authHost: string;
  authFamily: string;
  pack_stream: any;
  rsrc_id: number;
  seq_num_: number;
  seq2stack: any;
  seq_num: number;
  replies: any;
  atoms: any;
  atom_names: any;
  eventMask: any;
  event_consumers: any;
  eventParsers: any;
  errorParsers: any;
  _extensions: any;
  _closing: boolean;
  _unusedIds: number[];

  // inferred from code
  pending_atoms: any;
  GetAtomName: any;
  display: any;

  constructor(displayNum: number, screenNum: number, options: any) {
    super();
    this.options = options ? options : {};

    this.core_requests = {};
    this.ext_requests = {};

    this.displayNum = displayNum;
    this.screenNum = screenNum;
  }
  init(stream: any) {
    this.stream = stream;

    this.authHost = stream.remoteAddress;
    this.authFamily = stream._getpeername
      ? stream._getpeername().family
      : stream.remoteFamily;
    if (
      !this.authHost ||
      this.authHost === "127.0.0.1" ||
      this.authHost === "::1"
    ) {
      this.authHost = os.hostname();
      this.authFamily = null;
    }

    var pack_stream = new UnpackStream();

    var client = this;
    pack_stream.on("data", function (data: any) {
      stream.write(data);
    });
    stream.on("data", function (data: any) {
      pack_stream.write(data);
    });
    stream.on("end", function () {
      client.emit("end");
    });

    this.pack_stream = pack_stream;

    this.rsrc_id = 0;
    var cli = this;
    if (cli.options.debug) {
      this.seq_num_ = 0;
      this.seq2stack = {};
      Object.defineProperty(cli, "seq_num", {
        set: function (v: number) {
          cli.seq_num_ = v;
          var err = new XError();
          Error.captureStackTrace(err, arguments.callee);
          err.timestamp = Date.now();
          cli.seq2stack[client.seq_num] = err;
        },
        get: function () {
          return cli.seq_num_;
        },
      });
    } else {
      this.seq_num = 0;
    }

    this.replies = {};
    this.atoms = stdatoms;
    this.atom_names = (function () {
      var names: any = {};
      Object.keys(stdatoms).forEach(function (key) {
        names[stdatoms[key]] = key;
      });

      return names;
    })();

    this.eventMask = em;

    this.event_consumers = {};
    this.eventParsers = {};
    this.errorParsers = {};
    this._extensions = {};

    this.importRequestsFromTemplates(this, coreRequests);

    this.startHandshake();
    this._closing = false;
    this._unusedIds = [];
  }
  terminate() {
    this.stream.end();
  }
  ping(cb: Function) {
    var start = Date.now();
    this.GetAtomName(3, function (err: any, str: any) {
      if (err) return cb(err);
      return cb(null, Date.now() - start);
    });
  }
  close(cb: Function) {
    var cli = this;
    cli.ping(function (err: any) {
      if (err) return cb(err);
      cli.terminate();
      if (cb) cb();
    });
    cli._closing = true;
  }
  importRequestsFromTemplates(target: any, reqs: any) {
    var client = this;
    this.pending_atoms = {};
    for (var r in reqs) {
      target[r] = ((reqName: string) => {
        var reqFunc = (...args: any[]) => {
          if (client._closing) throw new Error("client is in closing state");

          if (client.seq_num == 65535) client.seq_num = 0;
          else client.seq_num++;

          var callback = args.length > 0 ? args[args.length - 1] : null;
          if (callback && callback.constructor.name != "Function")
            callback = null;

          var reqReplTemplate = reqs[reqName];
          var reqTemplate = reqReplTemplate[0];
          var templateType = typeof reqTemplate;

          if (templateType == "object")
            templateType = reqTemplate.constructor.name;

          if (templateType == "function") {
            if (reqName === "InternAtom") {
              var value = args[1];
              if (client.atoms[value]) {
                --client.seq_num;
                return setImmediate(function () {
                  callback(undefined, client.atoms[value]);
                });
              } else {
                client.pending_atoms[client.seq_num] = value;
              }
            }

            var reqPack = reqTemplate.apply(this, args);
            var format = reqPack[0];
            var requestArguments = reqPack[1];

            if (callback)
              this.replies[this.seq_num] = [reqReplTemplate[1], callback];

            client.pack_stream.pack(format, requestArguments);
            var b = client.pack_stream.write_queue[0];
            client.pack_stream.flush();
          } else if (Array.isArray(reqTemplate)) {
            if (reqName === "GetAtomName") {
              var atom = args[0];
              if (client.atom_names[atom]) {
                --client.seq_num;
                return setImmediate(function () {
                  callback(undefined, client.atom_names[atom]);
                });
              } else {
                client.pending_atoms[client.seq_num] = atom;
              }
            }

            var format = reqTemplate[0];
            // @ts-ignore
            var requestArguments: any[] = [];

            for (let a = 0; a < reqTemplate[1].length; ++a)
              requestArguments.push(reqTemplate[1][a]);
            for (const i in args) requestArguments.push(args[i]);

            if (callback)
              this.replies[this.seq_num] = [reqReplTemplate[1], callback];

            client.pack_stream.pack(format, requestArguments);
            client.pack_stream.flush();
          } else {
            throw "unknown request format - " + templateType;
          }
        };
        return reqFunc;
      })(r);
    }
  }
  AllocID() {
    if (this._unusedIds.length > 0) {
      return this._unusedIds.pop();
    }
    this.display.rsrc_id++;
    return (
      (this.display.rsrc_id << this.display.rsrc_shift) +
      this.display.resource_base
    );
  }
  ReleaseID(id: number) {
    this._unusedIds.push(id);
  }
  unpackEvent(
    type: number,
    seq: number,
    extra: any,
    code: any,
    raw: any,
    headerBuf: any,
  ) {
    var event: any = {};
    type = type & 0x7f;
    event.type = type;
    event.seq = seq;

    var extUnpacker = this.eventParsers[type];
    if (extUnpacker) {
      return extUnpacker(type, seq, extra, code, raw);
    }

    if (type == 2 || type == 3 || type == 4 || type == 5 || type == 6) {
      var values = raw.unpack("LLLssssSC");
      event.name = [
        ,
        ,
        "KeyPress",
        "KeyRelease",
        "ButtonPress",
        "ButtonRelease",
        "MotionNotify",
      ][type];
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
    } else if (type == 7 || type == 8) {
      event.name = type === 7 ? "EnterNotify" : "LeaveNotify";
      var values = raw.unpack("LLLssssSC");
      event.root = values[0];
      event.wid = values[1];
      event.child = values[2];
      event.rootx = values[3];
      event.rooty = values[4];
      event.x = values[5];
      event.y = values[6];
      event.values = values;
    } else if (type == 9) {
      event.name = "FocusIn";
      event.mode = raw.unpack("C")[0];
      event.wid = extra;
    } else if (type == 10) {
      event.name = "FocusOut";
      event.mode = raw.unpack("C")[0];
      event.wid = extra;
    } else if (type == 12) {
      var values = raw.unpack("SSSSS");
      event.name = "Expose";
      event.wid = extra;
      event.x = values[0];
      event.y = values[1];
      event.width = values[2];
      event.height = values[3];
      event.count = values[4];
    } else if (type == 16) {
      var values = raw.unpack("LssSSSc");
      event.name = "CreateNotify";
      event.parent = extra;
      event.wid = values[0];
      event.x = values[1];
      event.y = values[2];
      event.width = values[3];
      event.height = values[4];
      event.borderWidth = values[5];
      event.overrideRedirect = values[6] ? true : false;
    } else if (type == 17) {
      var values = raw.unpack("L");
      event.name = "DestroyNotify";
      event.event = extra;
      event.wid = values[0];
    } else if (type == 18) {
      var values = raw.unpack("LC");
      event.name = "UnmapNotify";
      event.event = extra;
      event.wid = values[0];
      event.fromConfigure = values[1] ? true : false;
    } else if (type == 19) {
      var values = raw.unpack("LC");
      event.name = "MapNotify";
      event.event = extra;
      event.wid = values[0];
      event.overrideRedirect = values[1] ? true : false;
    } else if (type == 20) {
      var values = raw.unpack("L");
      event.name = "MapRequest";
      event.parent = extra;
      event.wid = values[0];
    } else if (type == 22) {
      var values = raw.unpack("LLssSSSC");
      event.name = "ConfigureNotify";
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
      var values = raw.unpack("LLssSSSS");
      event.name = "ConfigureRequest";
      event.stackMode = code;
      event.parent = extra;
      event.wid = values[0];
      event.sibling = values[1];
      event.x = values[2];
      event.y = values[3];
      event.width = values[4];
      event.height = values[5];
      event.borderWidth = values[6];
      event.mask = values[7];
    } else if (type == 28) {
      event.name = "PropertyNotify";
      var values = raw.unpack("LLC");
      event.wid = extra;
      event.atom = values[0];
      event.time = values[1];
      event.state = values[2];
    } else if (type == 29) {
      event.name = "SelectionClear";
      event.time = extra;
      var values = raw.unpack("LL");
      event.owner = values[0];
      event.selection = values[1];
    } else if (type == 30) {
      event.name = "SelectionRequest";
      event.time = extra;
      var values = raw.unpack("LLLLL");
      event.owner = values[0];
      event.requestor = values[1];
      event.selection = values[2];
      event.target = values[3];
      event.property = values[4];
    } else if (type == 31) {
      event.name = "SelectionNotify";
      event.time = extra;
      var values = raw.unpack("LLLL");
      event.requestor = values[0];
      event.selection = values[1];
      event.target = values[2];
      event.property = values[3];
    } else if (type == 33) {
      event.name = "ClientMessage";
      event.format = code;
      event.wid = extra;
      event.message_type = raw.unpack("L")[0];
      var format =
        code === 32
          ? "LLLLL"
          : code === 16
            ? "SSSSSSSSSS"
            : "CCCCCCCCCCCCCCCCCCCC";
      event.data = raw.unpack(format, 4);
    } else if (type == 34) {
      event.name = "MappingNotify";
      event.request = headerBuf[4];
      event.firstKeyCode = headerBuf[5];
      event.count = headerBuf[6];
    }
    return event;
  }
  expectReplyHeader() {
    var client = this;
    client.pack_stream.get(8, function (headerBuf: any) {
      var res = headerBuf.unpack("CCSL");
      var type = res[0];
      var seq_num = res[2];
      var bad_value = res[3];

      if (type == 0) {
        var error_code = res[1];
        var error = new XError();
        error.error = error_code;
        error.seq = seq_num;
        if (client.options.debug) {
          error.longstack = client.seq2stack[error.seq];
          console.log(client.seq2stack[error.seq].stack);
        }

        client.pack_stream.get(24, function (buf: any) {
          var res = buf.unpack("SC");
          error.message = xerrors.errorText[error_code];
          error.badParam = bad_value;
          error.minorOpcode = res[0];
          error.majorOpcode = res[1];

          var extUnpacker = client.errorParsers[error_code];
          if (extUnpacker) {
            extUnpacker(error, error_code, seq_num, bad_value, buf);
          }

          var handler = client.replies[seq_num];
          if (handler) {
            var callback = handler[1];
            var handled = callback(error);
            if (!handled) client.emit("error", error);
            if (client.options.debug) delete client.seq2stack[seq_num];
            delete client.replies[seq_num];
          } else client.emit("error", error);
          client.expectReplyHeader();
        });
        return;
      } else if (type > 1) {
        client.pack_stream.get(24, function (buf: any) {
          var extra = res[3];
          var code = res[1];
          var ev = client.unpackEvent(
            type,
            seq_num,
            extra,
            code,
            buf,
            headerBuf,
          );

          ev.rawData = Buffer.alloc(32);
          headerBuf.copy(ev.rawData);
          buf.copy(ev.rawData, 8);

          client.emit("event", ev);
          var ee = client.event_consumers[ev.wid];
          if (ee) {
            ee.emit("event", ev);
          }
          if (ev.parent) {
            ee = client.event_consumers[ev.parent];
            if (ee) ee.emit("child-event", ev);
          }
          client.expectReplyHeader();
        });
        return;
      }

      var opt_data = res[1];
      var length_total = res[3];
      var bodylength = 24 + length_total * 4;

      client.pack_stream.get(bodylength, function (data: any) {
        var handler = client.replies[seq_num];
        if (handler) {
          var unpack = handler[0];
          if (client.pending_atoms[seq_num]) {
            opt_data = seq_num;
          }

          var result = unpack.call(client, data, opt_data);
          var callback = handler[1];
          callback(null, result);
          delete client.replies[seq_num];
        }
        client.expectReplyHeader();
      });
    });
  }
  startHandshake() {
    var client = this;

    handshake.writeClientHello(
      this.pack_stream,
      this.displayNum,
      this.authHost,
      this.authFamily,
    );
    handshake.readServerHello(
      this.pack_stream,
      function (err: any, display: any) {
        if (err) {
          client.emit("error", err);
          return;
        }
        client.expectReplyHeader();
        client.display = display;
        display.client = client;
        client.emit("connect", display);
      },
    );
  }
  require(extName: string, callback: Function) {
    var self = this;
    var ext = this._extensions[extName];
    if (ext) {
      return process.nextTick(function () {
        callback(null, ext);
      });
    }

    ext = require("./ext/" + extName);
    ext.requireExt(this.display, function (err: any, _ext: any) {
      if (err) {
        return callback(err);
      }

      self._extensions[extName] = _ext;
      callback(null, _ext);
    });
  }
}

export function createClient(options: any, initCb: Function) {
  if (typeof options === "function") {
    initCb = options;
    options = {};
  }

  if (!options) options = {};

  var display = options.display;
  if (!display) display = process.env.DISPLAY ? process.env.DISPLAY : ":0";

  var displayMatch = display.match(/^(?:[^:]*?\/)?(.*):(\d+)(?:.(\d+))?$/);
  if (!displayMatch) throw new Error("Cannot parse display");

  var host = displayMatch[1];

  var displayNum = displayMatch[2];
  if (!displayNum) displayNum = 0;
  var screenNum = displayMatch[3];
  if (!screenNum) screenNum = 0;

  var stream;
  var connected = false;
  var cbCalled = false;
  var socketPath;

  if (["cygwin", "win32", "win64"].indexOf(process.platform) < 0) {
    if (process.platform == "darwin") {
      if (display[0] == "/") {
        socketPath = display;
      }
    } else if (!host) socketPath = "/tmp/.X11-unix/X" + displayNum;
  }
  var client = new XClient(displayNum, screenNum, options);

  var connectStream = function () {
    if (socketPath) {
      stream = net.createConnection(socketPath);
    } else {
      stream = net.createConnection(6000 + parseInt(displayNum), host);
    }
    stream.on("connect", function () {
      connected = true;
      client.init(stream);
    });
    stream.on("error", function (err: any) {
      if (!connected && socketPath && err.code === "ENOENT") {
        socketPath = null;
        host = "localhost";
        connectStream();
      } else if (initCb && !cbCalled) {
        cbCalled = true;
        initCb(err);
      } else {
        client.emit("error", err);
      }
    });
  };
  connectStream();
  if (initCb) {
    client.on("connect", function (display: any) {
      if (!options.disableBigRequests) {
        client.require("big-requests", function (err: any, BigReq: any) {
          if (err) return initCb(err);
          BigReq.Enable(function (err: any, maxLen: any) {
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
