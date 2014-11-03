var x11 = require('./lib');
var Mocha = require('mocha');
var fs = require('fs');
var path = require('path');
var async = require('async');

var mocha = new Mocha({
    timeout : 80000,
    reporter : 'spec'
});

// To be able to perform the tests we need the server:
// 1 - to support the dpms extension.
// 2 - dpms version is 1.1.
// 3 - to be dpms capable.
var run_dpms_test = function(X, cb) {
    X.require('dpms', function(err, ext) {
        if (!err) {
            var dpms = ext;
            dpms.GetVersion(undefined, undefined, function(err, version) {
                if (!err && version[0] === 1 && version[1] === 1) {
                    dpms.Capable(function(err, capable) {
                        if (!err && capable[0] == 1) cb(true);
                        else cb(false);
                    });
                } else {
                    cb(false);
                }
            });
        } else {
            cb(false);
        }
    });
};

var run_xtest_test = function(X, cb) {
    X.require('xtest', function(err) {
        if (!err) cb(true);
        else cb(false);
    });
};

var run_randr_test = function(X, cb) {
    X.require('randr', function(err, ext) {
        if (!err) {
            var randr = ext;
            randr.QueryVersion(1, 2, function(err, version) {
                if (err) {
                    cb(false);
                } else {
                    cb((version[0] === 1) && (version[1] >= 2));
                }
            });
        } else {
            cb(false);
        }
    });
};

x11.createClient(function(err, display) {
    if (err) {
        console.log('Could not create X client');
        process.exit(-1);
    }

    var X = display.client;
    // Add all files from test root directory
    async.forEach(
        fs.readdirSync('./test'),
        function(file, cb) {
            if (file === 'dpms.js') {
                run_dpms_test(X, function(run) {
                    if (run) {
                        mocha.addFile(path.join('./test', file));
                    }

                    cb();
                });
            } else if (file === 'xtest.js') {
                run_xtest_test(X, function(run) {
                    if (run) {
                        mocha.addFile(path.join('./test', file));
                    }

                    cb();
                });
            } else if (file === 'randr.js') {
                run_randr_test(X, function(run) {
                    if (run) {
                        mocha.addFile(path.join('./test', file));
                    }

                    cb();
                });
            } else {
                mocha.addFile(path.join('./test', file));
                cb();
            }
        },
        function() {
            X.terminate();
            X.on('end', function() {
                mocha.run(function(failures) {
                    process.exit(failures);
                });
            });

        }
    );
});
