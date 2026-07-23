const x11 = require('../lib');
const should = require('should');
const assert = require('assert');
const util = require('util');

describe('DPMS extension', () => {
    let display;
    let X;
    let dpms;
    before(done => {
        const client = x11.createClient((err, dpy) => {
            if (!err) {
                display = dpy;
                X = display.client;
                X.require('dpms', (err, ext) => {
                    should.not.exist(err);
                    dpms = ext;
                    done();
                });
            } else {
                done(err);
            }
        });

        client.on('error', done);
    });

    describe('Setting the DPMS timeouts to specific values', () => {

        let prev_timeouts;
        before(done => {
            dpms.GetTimeouts((err, timeouts) => {
                prev_timeouts = timeouts;
                done(err);
            });
        });

        it('GetTimeouts should return those values', done => {
            dpms.SetTimeouts(110, 110, 110);
            dpms.GetTimeouts((err, timeouts) => {
                if (!err) timeouts.should.eql([110, 110, 110]);
                done(err);
            });
        });

        after(done => {
            dpms.SetTimeouts(prev_timeouts[0], prev_timeouts[1], prev_timeouts[2]);
            dpms.GetTimeouts((err, timeouts) => {
                if (!err) timeouts.should.eql(prev_timeouts);
                done(err);
            });
        });
    });

    describe('Changing status and level of DPMS', () => {
        let prev_status;
        let prev_level;
        before(done => {
            dpms.Info((err, info) => {
                if (!err) {
                    prev_level = info[0];
                    prev_status = info[1];
                }

                done(err);
            });
        });

        it('Info should return the correct values', done => {
            if (prev_status === 0) dpms.Enable(); // for force level to work dpms must be enabled
            const new_level = prev_level === 0 ? 1 : 0;
            dpms.ForceLevel(new_level);
            dpms.Info((err, info) => {
                if (!err) {
                    info[0].should.equal(new_level);
                    info[1].should.equal(1);
                }

                done(err);
            });
        });

        after(done => {
            dpms.ForceLevel(prev_level);
            if (prev_status) dpms.Enable();
            else dpms.Disable();
            dpms.Info((err, info) => {
                if (!err) {
                    info[0].should.equal(prev_level);
                    info[1].should.equal(prev_status);
                }

                done(err);
            });
        });
    });

    after(done => {
        X.terminate();
        X.on('end', done);
    });
});
