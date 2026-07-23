const x11 = require('../../lib');

x11.createClient((err, display) => {
    const X = display.client;
   
    function quotize(i) { return `"${i}"`; }
    function decodeProperty(type, data, cb) {
        switch(type) {
            case 'STRING': 
                const result = [];
                let s = '';
                for (let i=0; i < data.length; ++i)
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

            case 'ATOM': {
                const numAtoms = data.length/4;
                const res = [];
                for (let i=0; i < data.length; i+=4) {
                    const a = data.unpack('L', i)[0];
                    X.GetAtomName(a, (err, str) => {
                       res.push(str);
                       if (res.length === numAtoms)
                           cb(res.join(', '));
                    });
                }
                return;
            }
            case 'INTEGER': {
                const res = [];
                for (let i=0; i < data.length; i+=4) {
                    res.push(data.unpack('L', i)[0]);
                }
                return cb(res.join(', '));
            }
            case 'WINDOW': {
                const res = [];
                for (let i=0; i < data.length; i+=4) {
                    res.push(data.unpack('L', i)[0]);
                }
                return cb(`window id# ${res.map(n => `0x${n.toString(16)}`).join(', ')}`);
            }
            default:
                return cb(`WTF ${type}`);
        }
    }

    const id = parseInt(process.argv[2]);
    const root = display.screen[0].root;
    X.ListProperties(id, (err, props) => {
        props.forEach(p => {
            X.GetProperty(0, id, p, 0, 0, 10000000, (err, propValue) => {
                X.GetAtomName(propValue.type, (err, typeName) => {
                    X.GetAtomName(p, (err, propName) => {
                        decodeProperty(typeName, propValue.data, decodedData => {
                            console.log(`${propName}(${typeName}) = ${decodedData}`);
                        });
                    });
                });
            });
        })   
    });
    X.on('event', console.log);
    X.on('error', console.error);
});
