import fs from "fs";
import { Buffer } from "buffer";
import os from "os";
import path from "path";

// add 'unpack' method for buffer
import "./unpackbuffer";

export interface Cookie {
  type?: number;
  address?: string;
  display?: string;
  authName: string;
  authData: string;
  family?: number;
}

const typeToName: { [key: number]: string } = {
  256: "Local",
  65535: "Wild",
  254: "Netname",
  253: "Krb5Principal",
  252: "LocalHost",
  0: "Internet",
  1: "DECnet",
  2: "Chaos",
  5: "ServerInterpreted",
  6: "Internet6",
};

function parseXauth(buf: Buffer): Cookie[] {
  let offset = 0;
  const auth: Cookie[] = [];
  const cookieProperties = ["address", "display", "authName", "authData"];

  while (offset < buf.length) {
    const cookie: Cookie = {
      type: buf.readUInt16BE(offset),
      authName: "",
      authData: "",
    };
    if (!typeToName[cookie.type]) {
      console.warn("Unknown address type");
    }
    offset += 2;
    cookieProperties.forEach(function (property) {
      const length = buf.unpack("n", offset)[0];
      offset += 2;
      if (cookie.type === 0 && property == "address") {
        // Internet
        // 4 bytes of ip addess, convert to w.x.y.z string
        cookie.address = [
          buf[offset],
          buf[offset + 1],
          buf[offset + 2],
          buf[offset + 3],
        ]
          .map(function (octet) {
            return octet.toString(10);
          })
          .join(".");
      } else {
        cookie[property] = buf.unpackString(length, offset);
      }
      offset += length;
    });
    auth.push(cookie);
  }
  return auth;
}

function readXauthority(cb: (err: Error | null, data?: Buffer | null) => void) {
  const filename =
    process.env.XAUTHORITY || path.join(os.homedir(), ".Xauthority");
  fs.readFile(filename, function (err, data) {
    if (!err) return cb(null, data);
    if (err.code == "ENOENT") {
      // Xming/windows uses %HOME%/Xauthority ( .Xauthority with no dot ) - try with this name
      const altFilename =
        process.env.XAUTHORITY || path.join(os.homedir(), "Xauthority");
      fs.readFile(altFilename, function (err, data) {
        if (err.code == "ENOENT") {
          cb(null, null);
        } else {
          cb(err);
        }
      });
    } else {
      cb(err);
    }
  });
}

export function getAuthString(
  display: string,
  host: string,
  socketFamily: string,
  cb: (err: Error | null, cookie?: Cookie) => void,
) {
  let family: number;
  if (socketFamily === "IPv4") {
    family = 0; // Internet
  } else if (socketFamily === "IPv6") {
    family = 6; // Internet6
  } else {
    family = 256; // Local
  }
  readXauthority(function (err, data) {
    if (err) return cb(err);

    if (!data) {
      return cb(null, {
        authName: "",
        authData: "",
      });
    }
    const auth = parseXauth(data);
    for (const cookie of auth) {
      if (
        (typeToName[cookie.family] === "Wild" ||
          (cookie.type === family && cookie.address === host)) &&
        (cookie.display.length === 0 || cookie.display === display)
      )
        return cb(null, cookie);
    }
    // If no cookie is found, proceed without authentication
    cb(null, {
      authName: "",
      authData: "",
    });
  });
}
