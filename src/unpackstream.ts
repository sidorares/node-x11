import { Buffer } from "buffer";
import { EventEmitter } from "events";
import { Writable } from "stream";
import { padded_length } from "./xutil";

interface ArgumentLength {
  C: number;
  S: number;
  s: number;
  L: number;
  l: number;
  x: number;
}

const argument_length: ArgumentLength = {
  C: 1,
  S: 2,
  s: 2,
  L: 4,
  l: 4,
  x: 1,
};

interface ReadFormatRequestCallback {
  (data: number[]): void;
}

class ReadFormatRequest {
  format: string;
  current_arg: number = 0;
  data: number[] = [];
  callback: ReadFormatRequestCallback;

  constructor(format: string, callback: ReadFormatRequestCallback) {
    this.format = format;
    this.callback = callback;
  }

  execute(bufferlist: UnpackStream): boolean {
    while (this.current_arg < this.format.length) {
      const arg = this.format[this.current_arg];
      if (bufferlist.length < argument_length[arg]) return false; // need to wait for more data to prcess this argument

      switch (arg) {
        case "C": {
          this.data.push(bufferlist.getbyte());
          break;
        }
        case "S":
        case "s": {
          const b1 = bufferlist.getbyte();
          const b2 = bufferlist.getbyte();
          this.data.push(b2 * 256 + b1);
          break;
        }
        case "l":
        case "L": {
          const b1 = bufferlist.getbyte();
          const b2 = bufferlist.getbyte();
          const b3 = bufferlist.getbyte();
          const b4 = bufferlist.getbyte();
          this.data.push(((b4 * 256 + b3) * 256 + b2) * 256 + b1);
          break;
        }
        case "x": {
          bufferlist.getbyte();
          break;
        }
      }
      this.current_arg++;
    }
    this.callback(this.data);
    return true;
  }
}

interface ReadFixedRequestCallback {
  (data: Buffer): void;
}

class ReadFixedRequest {
  length: number;
  callback: ReadFixedRequestCallback;
  data: Buffer;
  received_bytes: number;

  constructor(length: number, callback: ReadFixedRequestCallback) {
    this.length = length;
    this.callback = callback;
    this.data = Buffer.alloc(length);
    this.received_bytes = 0;
  }

  execute(bufferlist: UnpackStream): boolean {
    const to_receive = this.length - this.received_bytes;
    for (let i = 0; i < to_receive; ++i) {
      if (bufferlist.length == 0) return false;
      this.data[this.received_bytes++] = bufferlist.getbyte();
    }
    this.callback(this.data);
    return true;
  }
}

export class UnpackStream extends EventEmitter {
  readlist: Buffer[] = [];
  length: number = 0;
  offset: number = 0;
  read_queue: (ReadFormatRequest | ReadFixedRequest)[] = [];
  write_queue: Buffer[] = [];
  write_length: number = 0;
  resumed = false;

  write(buf: Buffer): void {
    this.readlist.push(buf);
    this.length += buf.length;
    this.resume();
  }

  pipe(stream: Writable): void {
    this.on("data", function (data) {
      stream.write(data);
    });
  }

  unpack(format: string, callback: ReadFormatRequestCallback): void {
    this.read_queue.push(new ReadFormatRequest(format, callback));
    this.resume();
  }

  unpackTo(
    destination: Record<string, any>,
    names_formats: string[],
    callback: (destination: Record<string, any>) => void,
  ): void {
    const names: string[] = [];
    let format = "";

    for (let i = 0; i < names_formats.length; ++i) {
      let off = 0;
      while (off < names_formats[i].length && names_formats[i][off] == "x") {
        format += "x";
        off++;
      }

      if (off < names_formats[i].length) {
        format += names_formats[i][off];
        const name = names_formats[i].substr(off + 2);
        names.push(name);
      }
    }

    this.unpack(format, function (data) {
      if (data.length != names.length)
        throw (
          "Number of arguments mismatch, " +
          names.length +
          " fields and " +
          data.length +
          " arguments"
        );
      for (let fld = 0; fld < data.length; ++fld) {
        destination[names[fld]] = data[fld];
      }
      callback(destination);
    });
  }

  get(length: number, callback: ReadFixedRequestCallback): void {
    this.read_queue.push(new ReadFixedRequest(length, callback));
    this.resume();
  }

  resume(): void {
    if (this.resumed) return;
    this.resumed = true;
    while (this.read_queue[0].execute(this)) {
      this.read_queue.shift();
      if (this.read_queue.length == 0) return;
    }
    this.resumed = false;
  }

  getbyte(): number {
    let res = 0;
    const b = this.readlist[0];
    if (this.offset + 1 < b.length) {
      res = b[this.offset];
      this.offset++;
      this.length--;
    } else {
      res = b[this.offset];
      this.readlist.shift();
      this.length--;
      this.offset = 0;
    }
    return res;
  }

  pack(format: string, args: any[]): UnpackStream {
    let packetlength = 0;

    let arg = 0;
    for (let i = 0; i < format.length; ++i) {
      const f = format[i];
      if (f == "x") {
        packetlength++;
      } else if (f == "p") {
        packetlength += padded_length(args[arg++].length);
      } else if (f == "a") {
        packetlength += args[arg].length;
        arg++;
      } else {
        packetlength += argument_length[f];
        arg++;
      }
    }

    const buf = Buffer.alloc(packetlength);
    let offset = 0;
    arg = 0;
    for (let i = 0; i < format.length; ++i) {
      switch (format[i]) {
        case "x": {
          buf[offset++] = 0;
          break;
        }
        case "C": {
          const n = args[arg++];
          buf[offset++] = n;
          break;
        }
        case "s": {
          const n = args[arg++];
          buf.writeInt16LE(n, offset);
          offset += 2;
          break;
        }
        case "S": {
          const n = args[arg++];
          buf[offset++] = n & 0xff;
          buf[offset++] = (n >> 8) & 0xff;
          break;
        }
        case "l": {
          const n = args[arg++];
          buf.writeInt32LE(n, offset);
          offset += 4;
          break;
        }
        case "L": {
          const n = args[arg++];
          buf[offset++] = n & 0xff;
          buf[offset++] = (n >> 8) & 0xff;
          buf[offset++] = (n >> 16) & 0xff;
          buf[offset++] = (n >> 24) & 0xff;
          break;
        }
        case "a": {
          const str = args[arg++];
          if (Buffer.isBuffer(str)) {
            str.copy(buf, offset);
            offset += str.length;
          } else if (Array.isArray(str)) {
            for (const item of str) buf[offset++] = item;
          } else {
            for (let c = 0; c < str.length; ++c)
              buf[offset++] = str.charCodeAt(c);
          }
          break;
        }
        case "p": {
          const str = args[arg++];
          const len = padded_length(str.length);
          let c = 0;
          for (; c < str.length; ++c) buf[offset++] = str.charCodeAt(c);
          for (; c < len; ++c) buf[offset++] = 0;
          break;
        }
      }
    }
    this.write_queue.push(buf);
    this.write_length += buf.length;
    return this;
  }

  flush(): void {
    for (let i = 0; i < this.write_queue.length; ++i) {
      this.emit("data", this.write_queue[i]);
    }
    this.write_queue = [];
    this.write_length = 0;
  }
}
