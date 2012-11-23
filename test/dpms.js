var x11 = require('../lib/x11');
var should = require('should');
var assert = require('assert');
var util = require('util');

describe('DPMS extension', function() {
    var display;
    var X;
    var dpms;
    before(function(done) {
        var client = x11.createClient(function(dpy) {
            display = dpy;
            X = display.client;
            // To be able to perform the tests we need the server:
            // 1 - to support the dpms extension.
            // 2 - dpms version is 1.1.
            // 3 - to be dpms capable.
            X.require('dpms', function(ext) {
                if (util.isError(ext)) {
                    done(ext);
                } else {
                    dpms = ext;
                    dpms.GetVersion(undefined, undefined, function(err, version) {
                        if (err) return done(err);
                        version.should.eql([1, 1]);
                        dpms.Capable(function(err, capable) {
                            if (!err) capable.should.eql([1]);
                            done(err);
                        });
                    });
                }
            });
        });

        client.on('error', done);
    });

    describe('Setting the DPMS timeouts to specific values', function() {

        var prev_timeouts;
        before(function(done) {
            dpms.GetTimeouts(function(err, timeouts) {
                prev_timeouts = timeouts;
                done(err);
            });
        });

        it('GetTimeouts should return those values', function(done) {
            dpms.SetTimeouts(110, 110, 110);
            dpms.GetTimeouts(function(err, timeouts) {
                if (!err) timeouts.should.eql([110, 110, 110]);
                done(err);
            });
        });

        after(function(done) {
            dpms.SetTimeouts(prev_timeouts[0], prev_timeouts[1], prev_timeouts[2]);
            dpms.GetTimeouts(function(err, timeouts) {
                if (!err) timeouts.should.eql(prev_timeouts);
                done(err);
            });
        });
    });

    describe('Changing status and level of DPMS', function() {
        var prev_status;
        var prev_level;
        before(function(done) {
            dpms.Info(function(err, info) {
                if (!err) {
                    prev_level = info[0];
                    prev_status = info[1];
                }

                done(err);
            });
        });

        it('Info should return the correct values', function(done) {
            if (prev_status === 0) dpms.Enable(); // for force level to work dpms must be enabled
            var new_level = prev_level === 0 ? 1 : 0;
            dpms.ForceLevel(new_level);
            dpms.Info(function(err, info) {
                if (!err) {
                    info[0].should.equal(new_level);
                    info[1].should.equal(1);
                }

                done(err);
            });
        });

        after(function(done) {
            dpms.ForceLevel(prev_level);
            if (prev_status) dpms.Enable();
            else dpms.Disable();
            dpms.Info(function(err, info) {
                if (!err) {
                    info[0].should.equal(prev_level);
                    info[1].should.equal(prev_status);
                }

                done(err);
            });
        });
    });

    after(function(done) {
        X.terminate();
        X.on('end', done);
    });
});
