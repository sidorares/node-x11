// test results:

// WinServ2008R2, Intel(R) Core(TM) i7 CPU 870  @ 2.93GHz + Xming 6.9.0.31
//
// 0.4.3/cygwin 32bit              : 6900 +/- 200 req/sec 
// 0.5.1/win32                     : 3700 +/- 200 req/sec
// cygwin x11perf -sync -pointer   : 2800 +/- 200 req/sec
// cygwin x11perf -pointer         : 5600 +/- 200 req/sec

//
// Ubuntu 11.04 32bit, Intel(R) Core(TM)2 Duo CPU T7250 @2.00GHz, XOrg 1:7.6+4ubuntu3.1
// 0.4.9pre                : 
// x11perf -sync -pointer  :
// x11perf -pointer        :

var x11 = require('../../../lib');
var X = x11.createClient();

var total = 50000;
var num_qp_resp_left = total;
var num_qp_req_left = total;
var start = +new Date();
var wid;

function benchmarkQP()
{
    num_qp_req_left--;          
    X.QueryPointer(wid, function(res) {
        num_qp_resp_left--;
        if (num_qp_resp_left == 0)
        {
            var end = +new Date();
            var delta = (end - start)/1000
            console.error( 'Finished ' + total + ' requests in ' + delta + ' sec, ' + total/delta + ' req/sec');
            X.terminate();
        }
    });

    if (num_qp_req_left > 0)
        process.nextTick(benchmarkQP);
}

X.on('connect', function(err, display) {
    var screen = display.screen[0];
    wid = X.AllocID();
    X.CreateWindow(wid, screen.root, 10, 10, 400, 300, 1, 1, 0, { backgroundPixel: screen.white_pixel });
    X.MapWindow(wid);
    benchmarkQP(wid);
});

X.on('error', function(err) {
    console.log(err);
});
