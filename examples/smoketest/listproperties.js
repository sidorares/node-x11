var x11 = require('../../lib');

x11.createClient(function(err, display) {
    var X = display.client;
   
    function quotize(i) { return '\"' + i + '\"'; }
    function decodeProperty(type, data, cb) {
        switch(type) {
            case 'STRING': 
                var result = [];
                var s = '';
                for (var i=0; i < data.length; ++i)
                {
                    if (data[i] == 0) {
                       result.push(s);
                       s = '';
                       continue;
                    }
                    s += String.fromCharCode(data[i]);
                }
                result.push(s);
                return cb(result.map(quotize).join(', '));

            case 'ATOM':
                var numAtoms = data.length/4;
                var res = [];
                for (var i=0; i < data.length; i+=4) {
                    var a = data.unpack('L', i)[0];
                    X.GetAtomName(a, function(err, str) {
                       res.push(str);
                       if (res.length === numAtoms)
                           cb(res.join(', '));
                    });
                }
                return;

            case 'INTEGER':
                var numAtoms = data.length/4;
                var res = [];
                for (var i=0; i < data.length; i+=4) {
                    res.push(data.unpack('L', i)[0]);
                }
                return cb(res.join(', '));
            
            case 'WINDOW':
                var numAtoms = data.length/4;
                var res = [];
                for (var i=0; i < data.length; i+=4) {
                    res.push(data.unpack('L', i)[0]);
                }
                return cb('window id# ' + res.map(function(n) {return '0x'+n.toString(16);}).join(', '));
                
            default:
                return cb('WTF ' + type);
        }
    }

    var id = parseInt(process.argv[2]);
    var root = display.screen[0].root;
    X.ListProperties(id, function(err, props) {
        props.forEach(function(p) {
            X.GetProperty(0, id, p, 0, 0, 10000000, function(err, propValue) {
                X.GetAtomName(propValue.type, function(err, typeName) {
                    X.GetAtomName(p, function(err, propName) {
                        decodeProperty(typeName, propValue.data, function(decodedData) {
                            console.log(propName + '(' + typeName + ') = ' + decodedData);
                        });
                    });
                });
            });
        })   
    });
    X.on('event', console.log);
    X.on('error', console.error);
});
