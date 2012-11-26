var x11 = require('../lib/x11');
var should = require('should');
var assert = require('assert');
var util = require('util');

describe('XTEST extension', function() {
    var display;
    var X;
    var xtest;
    before(function(done) {
        var client = x11.createClient(function(dpy) {
            display = dpy;
            X = display.client;
            X.require('xtest', function(ext) {
                if (util.isError(ext)) {
                    done(ext);
                } else {
                    xtest = ext;
                    done();
                }
            });
        });

        client.on('error', done);
    });

    describe('GetVersion', function() {
        it('should return version 2.2', function(done) {
            xtest.GetVersion(2, 2, function(err, version) {
                version.should.eql([2, 2]);
                done();
            });
        });
    });

    after(function(done) {
        X.terminate();
        X.on('end', done);
    });
});
