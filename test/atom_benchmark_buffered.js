// WinServ2008R2, Intel(R) Core(TM) i7 CPU 870  @ 2.93GHz   
// 0.4.3: 12000 +/-1000  InternAtom/sec
// 0.5.1: 12000 +/-1000 

var x11 = require('../lib/x11');

var xclient = x11.createClient();
var counter = 0;
var t = +new Date();
var t0 = t;
var num = 10000;
xclient.on('connect', function(display) {
    var X = this;
    for (var i=0; i < num; ++i)
    { 
       var hello = 'Hello, node.js ' + i;
       X.InternAtom(false, hello, function(atomId) {
           if (counter == 0)
           {
               var t1 = +new Date();
               console.log('first reply after sending %d atoms in %d ms', num, t1-t);
               t = t1;
           }
           //console.log('atom %d saved on server', atomId);
           /*
           if ((counter % 1000) == 0)
           {
               var t1 = +new Date();
               console.log('received 1000 (up to %d) atom ids in %d ms', counter, t1 - t);
               t = t1;
           }
           */
           counter++;
           if (counter == num)
           {
              var t1 = +new Date();
              var delta = t1 - t0;
              console.log(delta);
              console.log('reqs/msec: ' + num/delta);
              console.log('msec per req: ' + delta/num);
              process.exit(0); // TODO: X.end() ?
           }
       });
    }
});
