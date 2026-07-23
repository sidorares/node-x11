const x11 = require('../lib');
const should = require('should');

//Used Atoms
const ATOM = {};

describe('ClientMessage', () => {
    before(function(done) {
      const self = this;
      const client = x11.createClient((err, dpy) => {
          should.not.exist(err);
          self.X = dpy.client;
          self.wid = self.X.AllocID();
          self.X.CreateWindow(self.wid, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window

          self.X.InternAtom(false, 'TEST_ATOM_1', (err, atom) => {
              should.not.exist(err);
              ATOM['TEST_ATOM_1'] = atom;

              done();
            });
      });

      client.on('error', done);
    });

    it('should receive client message with format=8', function(done) {
        const self = this;

        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X.once('event', ev => {
                ev.name.should.equal('ClientMessage');
                ev.wid.should.equal(self.wid);
                ev.message_type.should.equal(ATOM.TEST_ATOM_1);
                ev.data.should.be.an.Array();
                ev.data.length.should.equal(20);
                done();
            });

            const X = dpy.client;
            const eventData = Buffer.alloc(32);
            eventData.writeInt8(33, 0);                          //Event Type 33 = ClientMessage
            eventData.writeInt8(8,  1);                          //Format
            eventData.writeInt32LE(self.wid, 4);                 //Window ID
            eventData.writeInt32LE(ATOM.TEST_ATOM_1, 8);         //Message Type

            X.SendEvent(self.wid, false, 0, eventData);
        });

        client.on('error', done);
    });

    it('should receive client message with format=16', function(done) {
        const self = this;

        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X.once('event', ev => {
                ev.name.should.equal('ClientMessage');
                ev.wid.should.equal(self.wid);
                ev.message_type.should.equal(ATOM.TEST_ATOM_1);
                ev.data.should.be.an.Array();
                ev.data.length.should.equal(10);
                done();
            });

            const X = dpy.client;
            const eventData = Buffer.alloc(32);
            eventData.writeInt8(33, 0);                          //Event Type 33 = ClientMessage
            eventData.writeInt8(16,  1);                          //Format
            eventData.writeInt32LE(self.wid, 4);                 //Window ID
            eventData.writeInt32LE(ATOM.TEST_ATOM_1, 8);         //Message Type

            X.SendEvent(self.wid, false, 0, eventData);
        });

        client.on('error', done);
    });

    it('should receive client message with format=32', function(done) {
        const self = this;

        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X.once('event', ev => {
                ev.name.should.equal('ClientMessage');
                ev.wid.should.equal(self.wid);
                ev.message_type.should.equal(ATOM.TEST_ATOM_1);
                ev.data.should.be.an.Array();
                ev.data.length.should.equal(5);
                done();
            });

            const X = dpy.client;
            const eventData = Buffer.alloc(32);
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
