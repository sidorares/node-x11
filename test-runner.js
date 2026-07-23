const x11 = require('./lib');
const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');
const async = require('async');

const mocha = new Mocha({
    timeout : 80000,
    reporter : 'spec'
});

// To be able to perform the tests we need the server:
// 1 - to support the dpms extension.
// 2 - dpms version is 1.1.
// 3 - to be dpms capable.
const run_dpms_test = (X, cb) => {
    X.require('dpms', (err, ext) => {
        if (!err) {
            const dpms = ext;
            dpms.GetVersion(undefined, undefined, (err, version) => {
                if (!err && version[0] === 1 && version[1] === 1) {
                    dpms.Capable((err, capable) => {
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

const run_xtest_test = (X, cb) => {
    X.require('xtest', err => {
        if (!err) cb(true);
        else cb(false);
    });
};

const run_randr_test = (X, cb) => {
    X.require('randr', (err, ext) => {
        if (!err) {
            const randr = ext;
            randr.QueryVersion(1, 2, (err, version) => {
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

x11.createClient((err, display) => {
    if (err) {
        console.log('Could not create X client');
        process.exit(-1);
    }

    const X = display.client;
    // Add all files from test root directory
    async.forEach(
        fs.readdirSync('./test'),
        (file, cb) => {
            if (file === 'dpms.js') {
                run_dpms_test(X, run => {
                    if (run) {
                        mocha.addFile(path.join('./test', file));
                    }

                    cb();
                });
            } else if (file === 'xtest.js') {
                run_xtest_test(X, run => {
                    if (run) {
                        mocha.addFile(path.join('./test', file));
                    }

                    cb();
                });
            } else if (file === 'randr.js') {
                run_randr_test(X, run => {
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
        () => {
            X.terminate();
            X.on('end', () => {
                mocha.run(failures => {
                    process.exit(failures);
                });
            });

        }
    );
});
