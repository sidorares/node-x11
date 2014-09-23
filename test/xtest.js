var x11 = require('../lib');
var should = require('should');
var assert = require('assert');
var util = require('util');

describe('XTEST extension', function() {
    var display;
    var X;
    var xtest;
    before(function(done) {
        var client = x11.createClient(function(err, dpy) {
            if (!err) {
                display = dpy;
                X = display.client;
                X.require('xtest', function(err, ext) {
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
