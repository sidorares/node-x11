const x11 = require('./lib');
const Mocha = require('mocha');
const fs = require('fs');
const path = require('path');
const async = require('async');

const mocha = new Mocha({
    timeout : 80000,
    reporter : 'spec'
});

// Extension-specific test files are only added when the server advertises the
// extension (checked with QueryExtension by on-the-wire name).
const extensionTests = {
    'damage.js': 'DAMAGE',
    'dbe.js': 'DOUBLE-BUFFER',
    'dpms.js': 'DPMS',
    'fixes.js': 'XFIXES',
    'ge.js': 'Generic Event Extension',
    'present.js': 'Present',
    'randr.js': 'RANDR',
    'record.js': 'RECORD',
    'render.js': 'RENDER',
    'res.js': 'X-Resource',
    'screen-saver.js': 'MIT-SCREEN-SAVER',
    'shape.js': 'SHAPE',
    'shm.js': 'MIT-SHM',
    'sync.js': 'SYNC',
    'xc-misc.js': 'XC-MISC',
    'xinerama.js': 'XINERAMA',
    'xinput.js': 'XInputExtension',
    'xkb.js': 'XKEYBOARD',
    'xtest.js': 'XTEST',
    'xv.js': 'XVideo'
};

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
            const addIf = run => {
                if (run) {
                    mocha.addFile(path.join('./test', file));
                }

                cb();
            };

            if (file === 'dpms.js') {
                run_dpms_test(X, addIf);
            } else if (file === 'randr.js') {
                run_randr_test(X, addIf);
            } else if (extensionTests[file]) {
                X.QueryExtension(extensionTests[file], (err, ext) => {
                    addIf(!err && ext.present);
                });
            } else {
                addIf(true);
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
