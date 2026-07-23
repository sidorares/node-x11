// test results:

// WinServ2008R2, Intel(R) Core(TM) i7 CPU 870  @ 2.93GHz + Xming 6.9.0.31
//
// 0.4.3/cygwin 32bit : 8500 +/- 2000 InternAtom/sec
// 0.5.1/win32        : N/A
//
// Ubuntu 11.04 32bit, Intel(R) Core(TM)2 Duo CPU T7250 @2.00GHz, XOrg 1:7.6+4ubuntu3.1
// 0.4.9pre:  16700 +/-300


const x11 = require('../../../lib');

const xclient = x11.createClient();
let reqcounter = 0;
let rescounter = 0;

const num = 400000;
let X;

const t0 = +new Date();

function benchmarkAtoms()
{
    if (reqcounter > num)
        return;

    X.InternAtom(false, `test ${reqcounter}`, atomId => {
        rescounter++;
        //console.log('%d received', rescounter);
        if ( (rescounter % 10000) == 0)
        { 
            const t2 = X.t1;
            X.t1 = +new Date();
            const delta = X.t1 - t2;
            console.log(reqcounter - rescounter);
            console.log(`reqs/msec: ${10000/delta}`);
            console.log(`msec per req: ${delta/10000}`);
        }
        if (rescounter == (num-2))
        {
            const t1 = +new Date();
            const delta = t1 - t0;
            console.log(delta);
            console.log(`reqs/msec: ${num/delta}`);
            console.log(`msec per req: ${delta/num}`);
             
            process.exit(0);
        }
    });

    reqcounter++;
    //console.log('%d sent', reqcounter);
    process.nextTick(benchmarkAtoms);
}



xclient.on('connect', function(err, display) {
    X = this;
    X.t1 = +new Date();
    benchmarkAtoms();
});
