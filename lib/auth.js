// TODO: differentiate between auth types (i.e., MIT-MAGIC-COOKIE-1 and XDM-AUTHORIZATION-1)
// and choose the best based on the algorithm in libXau's XauGetBestAuthByAddr

const fs = require('fs');
const Buffer = require('buffer').Buffer;

const typeToName = {
    256: 'Local',
  65535: 'Wild',
    254: 'Netname',
    253: 'Krb5Principal',
    252: 'LocalHost',
      0: 'Internet',
      1: 'DECnet',
      2: 'Chaos',
      5: 'ServerInterpreted',
      6: 'Internet6'
};

// FamilyWild matches any address. `xauth generate` and `xauth add :0 . <key>`
// both write entries with this family, so it is not an exotic case.
const FAMILY_WILD = 65535;
const FAMILY_INTERNET = 0;

function familyLabel(type) {
    return typeToName[type] ? `${typeToName[type]} (${type})` : `unknown family ${type}`;
}

function parseXauth( buf, filename )
{
    let offset = 0;
    const auth = [];
    const cookieProperties = ['address', 'display', 'authName', 'authData'];

    while (offset + 2 <= buf.length)
    {
        const cookie = {};
        cookie.type = buf.readUInt16BE(offset);
        if (!typeToName[cookie.type]) {
            console.warn(`x11: unknown address family ${cookie.type} in ${filename}`);
        }
        offset += 2;
        // A half-written or truncated file must not throw RangeError out of an
        // fs callback, where no caller can catch it. Keep what parsed cleanly.
        let truncated = false;
        for (const property of cookieProperties) {
          if (offset + 2 > buf.length) {
            truncated = true;
            break;
          }
          const length = buf.readUInt16BE(offset);
          offset += 2;
          if (offset + length > buf.length) {
            truncated = true;
            break;
          }
          if (cookie.type === FAMILY_INTERNET && property === 'address' && length === 4) {
            // 4 bytes of ip addess, convert to w.x.y.z string
            cookie.address = [ buf[offset], buf[offset+1], buf[offset+2], buf[offset+3]]
              .map(octet => octet.toString(10)).join('.');
          } else {
            cookie[property] = buf.toString('latin1', offset, offset + length);
          }
          offset += length;
        }
        if (truncated) {
            console.warn(
                `x11: ${filename} ends in the middle of an entry; using the ` +
                `${auth.length} complete ${auth.length === 1 ? 'entry' : 'entries'} before it`);
            break;
        }
        auth.push(cookie);
    }
    return auth;
}

const homedir = require('os').homedir;
const path = require('path');

/**
 * Read the Xauthority file, reporting which one was read.
 *
 * cb(err, data, filename) — `data` is null when there is simply no file,
 * which is the ordinary state on a server that allows unauthenticated
 * connections and must stay silent.
 */
function readXauthority(cb) {
  const fromEnv = process.env.XAUTHORITY;
  if (fromEnv) {
    // an explicit path is the whole answer: guessing a second one would only
    // hide the user's typo
    return fs.readFile(fromEnv, (err, data) => {
      if (!err)
        return cb(null, data, fromEnv);
      if (err.code === 'ENOENT')
        return cb(null, null, fromEnv);
      cb(err);
    });
  }
  const dotted = path.join(homedir(), '.Xauthority');
  fs.readFile(dotted, (err, data) => {
    if (!err)
      return cb(null, data, dotted);
    if (err.code !== 'ENOENT')
      return cb(err);
    // Xming on Windows writes %HOME%/Xauthority, with no leading dot
    const undotted = path.join(homedir(), 'Xauthority');
    fs.readFile(undotted, (err2, data2) => {
      if (!err2)
        return cb(null, data2, undotted);
      if (err2.code === 'ENOENT')
        return cb(null, null, dotted);
      cb(err2);
    });
  });
}

const MAX_LISTED_ENTRIES = 8;
const warnedMatchFailures = new Set();

/**
 * Say why a cookie file that exists did not produce a cookie.
 *
 * Falling back to an unauthenticated connection is right — plenty of servers
 * accept one — but doing it silently means the only symptom is the server's
 * generic "Authorization required", which looks identical to having no
 * Xauthority file at all. Naming the file, what was wanted and what was in it
 * turns that into a one-line diagnosis.
 */
function warnNoMatch(filename, auth, family, host, display) {
  let found;
  if (auth.length === 0) {
    found = '    (no entries)';
  } else {
    // never the auth data itself — that is the secret being looked up
    const shown = auth.slice(0, MAX_LISTED_ENTRIES).map(c =>
      `    ${familyLabel(c.type)} address ${JSON.stringify(c.address)} ` +
      `display ${JSON.stringify(c.display)} ${c.authName}`);
    if (auth.length > MAX_LISTED_ENTRIES)
      shown.push(`    ... and ${auth.length - MAX_LISTED_ENTRIES} more`);
    found = shown.join('\n');
  }
  const message =
    `x11: no entry in ${filename} matches this connection, so it is being made without\n` +
    `  authentication - the server will refuse it unless it accepts unauthenticated clients.\n` +
    `  wanted: ${familyLabel(family)} address ${JSON.stringify(host)} display ${JSON.stringify(display)}\n` +
    `  file has:\n${found}`;
  if (warnedMatchFailures.has(message))
    return;
  warnedMatchFailures.add(message);
  console.warn(message);
}

module.exports = (display, host, socketFamily, cb) => {
  let family;
  if (socketFamily === 'IPv4') {
    family = 0; // Internet
  } else if (socketFamily === 'IPv6') {
    family = 6; // Internet6
  } else {
    family = 256; // Local
  }
  readXauthority((err, data, filename) => {
    if(err) return cb(err);

    if (!data || data.length === 0) {
      return cb(null, {
        authName: '',
        authData: ''
      });
    }
    const auth = parseXauth(data, filename);
    for (const cookie of auth)
    {
      // FamilyWild is a wildcard over the address, not over the display
      const addressMatches = cookie.type === FAMILY_WILD ||
          (cookie.type === family && cookie.address === host);
      if (addressMatches &&
          (cookie.display.length === 0 || cookie.display === display))
        return cb( null, cookie );
    }
    // No cookie matched. Proceed without authentication, but say so.
    warnNoMatch(filename, auth, family, host, display);
    cb(null, {
      authName: '',
      authData: ''
    });
  });
};
