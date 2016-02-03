var x11 = require('../lib');
var UnpackStream = require('../lib/unpackstream.js');
var should = require('should');

//Used Atoms
var ATOM = {};

describe('ClientMessage', function() {
    before(function(done) {
      var self = this;
      var client = x11.createClient(function(err, dpy) {
          should.not.exist(err);
          self.X = dpy.client;
          self.wid = self.X.AllocID();
          self.X.CreateWindow(self.wid, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window

          self.X.InternAtom(false, 'TEST_ATOM_1', function(err, atom) {
              should.not.exist(err);
              ATOM['TEST_ATOM_1'] = atom;

              done();
            });
      });

      client.on('error', done);
    });

    it('should receive client message with format=8', function(done) {
        var self = this;

        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X.once('event', function(ev) {
                ev.name.should.equal('ClientMessage');
                ev.wid.should.equal(self.wid);
                ev.message_type.should.equal(ATOM.TEST_ATOM_1);
                ev.data.should.be.an.Array();
                ev.data.length.should.equal(20);
                done();
            });

            var X = dpy.client;
            var eventData = new Buffer(32);
            eventData.writeInt8(33, 0);                          //Event Type 33 = ClientMessage
            eventData.writeInt8(8,  1);                          //Format
            eventData.writeInt32LE(self.wid, 4);                 //Window ID
            eventData.writeInt32LE(ATOM.TEST_ATOM_1, 8);         //Message Type

            X.SendEvent(self.wid, false, 0, eventData);
        });

        client.on('error', done);
    });

    it('should receive client message with format=16', function(done) {
        var self = this;

        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X.once('event', function(ev) {
                ev.name.should.equal('ClientMessage');
                ev.wid.should.equal(self.wid);
                ev.message_type.should.equal(ATOM.TEST_ATOM_1);
                ev.data.should.be.an.Array();
                ev.data.length.should.equal(10);
                done();
            });

            var X = dpy.client;
            var eventData = new Buffer(32);
            eventData.writeInt8(33, 0);                          //Event Type 33 = ClientMessage
            eventData.writeInt8(16,  1);                          //Format
            eventData.writeInt32LE(self.wid, 4);                 //Window ID
            eventData.writeInt32LE(ATOM.TEST_ATOM_1, 8);         //Message Type

            X.SendEvent(self.wid, false, 0, eventData);
        });

        client.on('error', done);
    });

    it('should receive client message with format=32', function(done) {
        var self = this;

        var client = x11.createClient(function(err, dpy) {
            should.not.exist(err);
            self.X.once('event', function(ev) {
                ev.name.should.equal('ClientMessage');
                ev.wid.should.equal(self.wid);
                ev.message_type.should.equal(ATOM.TEST_ATOM_1);
                ev.data.should.be.an.Array();
                ev.data.length.should.equal(5);
                done();
            });

            var X = dpy.client;
            var eventData = new Buffer(32);
            eventData.writeInt8(33, 0);                          //Event Type 33 = ClientMessage
            eventData.writeInt8(32,  1);                         //Format
            eventData.writeInt32LE(self.wid, 4);                 //Window ID
            eventData.writeInt32LE(ATOM.TEST_ATOM_1, 8);         //Message Type

            X.SendEvent(self.wid, false, 0, eventData);
        });

        client.on('error', done);
    });

    after(function(done) {
        this.X.DestroyWindow(this.wid);
        this.X.on('end', done);
        this.X.terminate();
    });
});
