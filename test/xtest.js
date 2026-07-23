const x11 = require('../lib');
const should = require('should');
const assert = require('assert');
const util = require('util');

describe('XTEST extension', () => {
    let display;
    let X;
    let xtest;
    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (!err) {
                display = dpy;
                X = display.client;
                X.require('xtest', (err, ext) => {
                    should.not.exist(err);
                    xtest = ext;
                    done();
                });
            } else {
                done(err);
            }
        });

        client.on('error', done);
    });

    describe('GetVersion', () => {
        it('should return version 2.2', done => {
            xtest.GetVersion(2, 2, (err, version) => {
                version.should.eql([2, 2]);
                done();
            });
        });
    });

    after(done => {
        X.terminate();
        X.on('end', done);
    });
});
