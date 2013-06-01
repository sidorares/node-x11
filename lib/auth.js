// TODO: http://en.wikipedia.org/wiki/X_Window_authorization

var fs = require('fs');
var Buffer = require('buffer').Buffer;
// add 'unpack' method for buffer
require('./unpackbuffer').addUnpack(Buffer);

function parseXauth( buf )
{
    var offset = 0;
    var auth = [];

    while (offset < buf.length)
    {
        var cookie = {};        
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
              6: 'InternetV6'
        };
        var cookieFields = [
            'address',
            'display',
            'authName',
            'authData'
        ];
        cookie.type = buf.unpack('n')[0];
        offset += 2;
        for (var i = 0; i < 4; i += 1) {
            var length = buf.unpack('n', offset)[0];
            offset += 2;
            cookie[cookieFields[i]] = buf.unpackString(length, offset);
            offset += length;
        }
        auth.push(cookie);
    }
    return auth;
}

module.exports = function( display, host, cb )
{
    var XAuthorityFile = process.env.XAUTHORITY;
    if (!XAuthorityFile)
    {
        if ( process.platform.match(/win/) ) {
            // http://www.straightrunning.com/XmingNotes/trouble.php
            //
            // The Xming magic cookie program, xauth (user-based), uses an 
            // Xauthority file (not the traditional .Xauthority file) in 
            // the %HOME% directory. To use xauth from Command Processor 
            // e.g. on Windows machine 192.168.0.2 with user colin...
            XAuthorityFile = process.env.USERPROFILE + '\\Xauthority';
        } else {
            XAuthorityFile = process.env.HOME + '/.Xauthority';
        }
    }

    fs.readFile(XAuthorityFile, function (err, data) {

        if (err) 
        {
            if (err.code == 'ENOENT')
            {
                cb('','');
                return;
            }
            throw err;
        }

        var auth = parseXauth(data);
        for (var cookieNum in auth)
        {
            var cookie = auth[cookieNum];
            if (cookie.display == display && cookie.address == host)
            {
                cb( cookie.authName, cookie.authData );
                return;
            }
        }
        // throw 'No auth cookie matching display=' + display + ' and  host=' + host;
        cb( '', '' );            
    });       
};
