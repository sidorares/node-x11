// WinServ2008R2 64bit, Intel(R) Core(TM) i7 CPU 870 @2.93GHz, Xming 6.9.0.31
// 0.4.3/cygwin 32bit: 12000 +/-1000  InternAtom/sec
// 0.5.1/win32       : 12000 +/-1000 

// Ubuntu 11.04 32bit, Intel(R) Core(TM)2 Duo CPU T7250 @2.00GHz, XOrg 1:7.6+4ubuntu3.1
// 0.4.9pre: 23300 +/-200 


const x11 = require('../../../lib');

const xclient = x11.createClient();
let counter = 0;
let t = +new Date();
const t0 = t;
const num = 100000;
xclient.on('connect', function(err, display) {
    console.log(display);
    process.exit(0);
    const X = this;
    for (let i=0; i < num; ++i)
    { 
       const hello = `Hello, node.js ${i}`;
       X.InternAtom(false, hello, atomId => {
           if (counter == 0)
           {
               const t1 = +new Date();
               console.log('first reply after sending %d atoms in %d ms', num, t1-t);
               t = t1;
           }
           //console.log('atom %d saved on server', atomId);
           
           if ((counter % 10000) == 0)
           {
               const t1 = +new Date();
               console.log('received 10000 (up to %d) atom ids in %d ms', counter, t1 - t);
               t = t1;
           }
           
           counter++;
           if (counter == (num-1))
           {
              const t1 = +new Date();
              const delta = t1 - t0;
              console.log(delta);
              console.log(`reqs/msec: ${num/delta}`);
              console.log(`msec per req: ${delta/num}`);
              process.exit(0); // TODO: X.end() ?
           }
       });
    }
});
