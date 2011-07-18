// test results:

// WinServ2008R2, Intel(R) Core(TM) i7 CPU 870  @ 2.93GHz + Xming 6.9.0.31
// 0.4.3/cygwin 32bit : 8500 +/- 2000 InternAtom/sec
// 0.5.1/win32        : N/A

var x11 = require('../lib/x11');

var xclient = x11.createClient();
var reqcounter = 0;
var rescounter = 0;

var t = +new Date();
var t0 = t;
var num = 400000;
var X;

var t0 = +new Date();

function benchmarkAtoms()
{
    if (reqcounter > num)
        return;

    X.InternAtom(false, 'test ' + reqcounter, function(atomId) {
        rescounter++;
        //console.log('%d received', rescounter);
        //if ( (rescounter % 1000) == 0)
        //    console.log(reqcounter - rescounter);
        if (rescounter == num)
        {
            var t1 = +new Date();
            var delta = t1 - t0;
            console.log(delta);
            console.log('reqs/msec: ' + num/delta);
            console.log('msec per req: ' + delta/num);
             
            process.exit(0);
        }
    });

    reqcounter++;
    //console.log('%d sent', reqcounter);
    process.nextTick(benchmarkAtoms);
}



xclient.on('connect', function(display) {
    X = this;
    benchmarkAtoms();
});
