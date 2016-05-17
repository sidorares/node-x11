// TODO: differentiate between auth types (i.e., MIT-MAGIC-COOKIE-1 and XDM-AUTHORIZATION-1)
// and choose the best based on the algorithm in libXau's XauGetBestAuthByAddr

var fs = require('fs');
var Buffer = require('buffer').Buffer;
// add 'unpack' method for buffer
require('./unpackbuffer').addUnpack(Buffer);

var typeToName = {
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

function parseXauth( buf )
{
    var offset = 0;
    var auth = [];
    var cookieProperties = ['address', 'display', 'authName', 'authData'];

    while (offset < buf.length)
    {
        var cookie = {};
        cookie.type = buf.readUInt16BE(offset);
        if (!typeToName[cookie.type]) {
            console.warn('Unknown address type');
        }
        offset += 2;
        cookieProperties.forEach(function(property) {
          var length = buf.unpack('n', offset)[0];
          offset += 2;
          if (cookie.type === 0 && property == 'address') { // Internet
            // 4 bytes of ip addess, convert to w.x.y.z string
            cookie.address = [ buf[offset], buf[offset+1], buf[offset+2], buf[offset+3]]
              .map(function(octet) { return octet.toString(10) }).join('.');
          } else {
            cookie[property] = buf.unpackString(length, offset);
          }
          offset += length;
        });
        auth.push(cookie);
    }
    return auth;
}

var homedir = require('os-homedir');
var path = require('path');

function readXauthority(cb) {
  var filename = process.env.XAUTHORITY || path.join(homedir(), '.Xauthority');
  fs.readFile(filename, function(err, data) {
    if (!err)
      return cb(null, data);
    if(err.code == 'ENOENT') {
      // Xming/windows uses %HOME%/Xauthority ( .Xauthority with no dot ) - try with this name
      filename = process.env.XAUTHORITY || path.join(homedir(), 'Xauthority');
      fs.readFile(filename, function (err, data) {
        if (err.code == 'ENOENT') {
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

module.exports = function( display, host, socketFamily, cb )
{
  var family;
  if (socketFamily === 'IPv4') {
    family = 0; // Internet
  } else if (socketFamily === 'IPv6') {
    family = 6; // Internet6
  } else {
    family = 256; // Local
  }
  readXauthority(function(err, data) {
    if(err) return cb(err);

    if (!data) {
      return cb(null, {
        authName: '',
        authData: ''
      });
    }
    var auth = parseXauth(data);
    for (var cookieNum in auth)
    {
      var cookie = auth[cookieNum];
      if ((typeToName[cookie.family] === 'Wild' || (cookie.type === family && cookie.address === host)) &&
          (cookie.display.length === 0 || cookie.display === display))
        return cb( null, cookie );
    }
    // If no cookie is found, proceed without authentication
    cb(null, {
      authName: '',
      authData: ''
    });
  });
};
