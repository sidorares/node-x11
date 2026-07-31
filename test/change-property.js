const x11 = require('../lib');
const should = require('should');

const TEST_PROPERTY = 'My Test Property';

describe('ChangeProperty', () => {
    before(function(done) {
        const self = this;
        const client = x11.createClient((err, dpy) => {
            should.not.exist(err);
            self.X = dpy.client;
            self.wid = self.X.AllocID();
            self.wid_helper = self.X.AllocID();
            self.X.CreateWindow(self.wid, dpy.screen[0].root, 0, 0, 1, 1); // 1x1 pixel window
            self.X.QueryTree(dpy.screen[0].root, (err, list) => {
                should.not.exist(err);
                list.children.indexOf(self.wid).should.not.equal(-1);
                self.X.ChangeWindowAttributes(self.wid, { eventMask: x11.eventMask.PropertyChange });
                done();
            });
        });

        client.on('error', done);
    });

    it('should add a new WINDOW property with length 1', function(done) {
        const self = this;
        this.X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            should.not.exist(err);
            const raw = Buffer.alloc(4);
            raw.writeUInt32LE(self.wid, 0);
            self.X.ChangeProperty(0, self.wid, atom, self.X.atoms.WINDOW, 32, raw);
            self.X.once('event', ev => {
                ev.type.should.equal(28);
                ev.atom.should.equal(atom);
                ev.wid.should.equal(self.wid);
                self.X.GetProperty(0, self.wid, atom, self.X.atoms.WINDOW, 0, 1000000000, (err, prop) => {
                    should.not.exist(err);
                    prop.data.readUInt32LE(0).should.equal(self.wid);
                    done();
                });
            });
        });
    });

    it('should add a new WINDOW property with length 2', function(done) {
        const self = this;
        this.X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            should.not.exist(err);
            const raw = Buffer.from(new Array(8));
            raw.writeUInt32LE(self.wid, 0);
            raw.writeUInt32LE(self.wid_helper, 4);
            self.X.ChangeProperty(0, self.wid, atom, self.X.atoms.ATOM, 32, raw);
            self.X.once('event', ev => {
                ev.type.should.equal(28);
                ev.atom.should.equal(atom);
                ev.wid.should.equal(self.wid);
                self.X.GetProperty(0, self.wid, atom, self.X.atoms.ATOM, 0, 1000000000, (err, prop) => {
                    should.not.exist(err);
                    prop.data.readUInt32LE(0).should.equal(self.wid);
                    prop.data.readUInt32LE(4).should.equal(self.wid_helper);
                    done();
                });
            });
        });
    });

    it('should replace a the WINDOW property with length 0', function(done) {
        const self = this;
        this.X.InternAtom(false, TEST_PROPERTY, (err, atom) => {
            should.not.exist(err);
            const raw = Buffer.alloc(0);
            self.X.ChangeProperty(0, self.wid, atom, self.X.atoms.WINDOW, 32, raw);
            self.X.once('event', ev => {
                ev.type.should.equal(28);
                ev.atom.should.equal(atom);
                ev.wid.should.equal(self.wid);
                self.X.GetProperty(0, self.wid, atom, self.X.atoms.WINDOW, 0, 1000000000, (err, prop) => {
                    should.not.exist(err);
                    prop.data.length.should.equal(0);
                    done();
                });
            });
        });
    });

    it('should encode a number array at the declared format width', function(done) {
        const self = this;
        // Buffer.from([1366]) keeps only the low byte, so this used to reach
        // the server as an empty property with one garbage byte behind it
        const strut = [0, 0, 0, 23, 0, 0, 0, 0, 0, 0, 0, 1366];
        this.X.InternAtom(false, 'X11_TEST_STRUT', (err, atom) => {
            should.not.exist(err);
            self.X.ChangeProperty(0, self.wid, atom, self.X.atoms.CARDINAL, 32, strut);
            self.X.GetProperty(0, self.wid, atom, self.X.atoms.CARDINAL, 0, 100, (err, prop) => {
                should.not.exist(err);
                prop.data.length.should.equal(48);
                const out = [];
                for (let i = 0; i + 4 <= prop.data.length; i += 4)
                    out.push(prop.data.readUInt32LE(i));
                out.should.eql(strut);
                done();
            });
        });
    });

    it('should encode a bare number as one element of the declared format', function(done) {
        const self = this;
        this.X.InternAtom(false, 'X11_TEST_NUMBER', (err, atom) => {
            should.not.exist(err);
            self.X.ChangeProperty(0, self.wid, atom, self.X.atoms.CARDINAL, 32, 0xdeadbeef);
            self.X.GetProperty(0, self.wid, atom, self.X.atoms.CARDINAL, 0, 100, (err, prop) => {
                should.not.exist(err);
                prop.data.length.should.equal(4);
                prop.data.readUInt32LE(0).should.equal(0xdeadbeef);
                done();
            });
        });
    });

    it('should keep packing a byte array at format 8', function(done) {
        const self = this;
        this.X.InternAtom(false, 'X11_TEST_BYTES', (err, atom) => {
            should.not.exist(err);
            self.X.ChangeProperty(0, self.wid, atom, self.X.atoms.STRING, 8, [104, 105]);
            self.X.GetProperty(0, self.wid, atom, self.X.atoms.STRING, 0, 100, (err, prop) => {
                should.not.exist(err);
                prop.data.toString().should.equal('hi');
                done();
            });
        });
    });

    after(function(done) {
        this.X.DestroyWindow(this.wid);
        this.X.terminate();
        this.X.on('end', done);
    });
});

