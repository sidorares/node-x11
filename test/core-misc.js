const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('Misc control requests', () => {

  let display;
  let X;
  let root;

  beforeEach(done => {
      const client = x11.createClient((err, dpy) => {
          if (err)
              return done(err);
          display = dpy;
          X = display.client;
          root = display.screen[0].root;
          done();
      });
      client.on('error', done);
  });

  afterEach(done => {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('NoOperation should be accepted by server', done => {
      X.NoOperation();
      X.GetInputFocus(err => {
          should.not.exist(err);
          done();
      });
  });

  it('ListHosts should return host list and access control mode', done => {
      X.ListHosts((err, res) => {
          should.not.exist(err);
          [0, 1].should.containEql(res.mode);
          res.hosts.should.be.an.Array();
          done();
      });
  });

  it('ChangeHosts should insert and delete a host', done => {
      const addr = [127, 0, 0, 2];
      X.ChangeHosts(0, 0, addr); // insert Internet host
      X.ListHosts((err, res) => {
          should.not.exist(err);
          const found = res.hosts.some(
              h => h.family === 0 && h.address.equals(Buffer.from(addr)));
          found.should.be.true();
          X.ChangeHosts(1, 0, addr); // delete it
          X.ListHosts((err2, res2) => {
              should.not.exist(err2);
              const found2 = res2.hosts.some(
                  h => h.family === 0 && h.address.equals(Buffer.from(addr)));
              found2.should.be.false();
              done();
          });
      });
  });

  it('SetAccessControl should toggle mode reported by ListHosts', done => {
      X.ListHosts((err, before) => {
          should.not.exist(err);
          X.SetAccessControl(1);
          X.ListHosts((err2, res) => {
              should.not.exist(err2);
              res.mode.should.equal(1);
              X.SetAccessControl(before.mode);
              done();
          });
      });
  });

  it('SetCloseDownMode should be accepted by server', done => {
      X.SetCloseDownMode(2); // RetainTemporary
      X.SetCloseDownMode(0); // back to Destroy
      X.GetInputFocus(err => {
          should.not.exist(err);
          done();
      });
  });

  it('RotateProperties should rotate property values', done => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 1, 1);
      X.InternAtom(false, 'NODE_X11_ROT_A', (err, atomA) => {
          should.not.exist(err);
          X.InternAtom(false, 'NODE_X11_ROT_B', (err2, atomB) => {
              should.not.exist(err2);
              X.ChangeProperty(0, wid, atomA, X.atoms.STRING, 8, 'valueA');
              X.ChangeProperty(0, wid, atomB, X.atoms.STRING, 8, 'valueB');
              X.RotateProperties(wid, 1, [atomA, atomB]);
              X.GetProperty(0, wid, atomA, X.atoms.STRING, 0, 100, (err3, prop) => {
                  should.not.exist(err3);
                  assert.equal(prop.data.toString(), 'valueB');
                  X.GetProperty(0, wid, atomB, X.atoms.STRING, 0, 100, (err4, prop2) => {
                      should.not.exist(err4);
                      assert.equal(prop2.data.toString(), 'valueA');
                      X.DestroyWindow(wid);
                      done();
                  });
              });
          });
      });
  });
});
