const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Misc control requests', () => {

  let display;
  let X;
  let root;

  beforeEach((t, done) => {
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

  afterEach((t, done) => {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('NoOperation should be accepted by server', (t, done) => {
      X.NoOperation();
      X.GetInputFocus(err => {
          assert.ifError(err);
          done();
      });
  });

  it('ListHosts should return host list and access control mode', (t, done) => {
      X.ListHosts((err, res) => {
          assert.ifError(err);
          assert.ok([0, 1].includes(res.mode));
          assert.ok(Array.isArray(res.hosts));
          done();
      });
  });

  it('ChangeHosts should insert and delete a host', (t, done) => {
      const addr = [127, 0, 0, 2];
      X.ChangeHosts(0, 0, addr); // insert Internet host
      X.ListHosts((err, res) => {
          assert.ifError(err);
          const found = res.hosts.some(
              h => h.family === 0 && h.address.equals(Buffer.from(addr)));
          assert.strictEqual(found, true);
          X.ChangeHosts(1, 0, addr); // delete it
          X.ListHosts((err2, res2) => {
              assert.ifError(err2);
              const found2 = res2.hosts.some(
                  h => h.family === 0 && h.address.equals(Buffer.from(addr)));
              assert.strictEqual(found2, false);
              done();
          });
      });
  });

  it('SetAccessControl should toggle mode reported by ListHosts', (t, done) => {
      X.ListHosts((err, before) => {
          assert.ifError(err);
          X.SetAccessControl(1);
          X.ListHosts((err2, res) => {
              assert.ifError(err2);
              assert.strictEqual(res.mode, 1);
              X.SetAccessControl(before.mode);
              done();
          });
      });
  });

  it('SetCloseDownMode should be accepted by server', (t, done) => {
      X.SetCloseDownMode(2); // RetainTemporary
      X.SetCloseDownMode(0); // back to Destroy
      X.GetInputFocus(err => {
          assert.ifError(err);
          done();
      });
  });

  it('RotateProperties should rotate property values', (t, done) => {
      const wid = X.AllocID();
      X.CreateWindow(wid, root, 0, 0, 1, 1);
      X.InternAtom(false, 'NODE_X11_ROT_A', (err, atomA) => {
          assert.ifError(err);
          X.InternAtom(false, 'NODE_X11_ROT_B', (err2, atomB) => {
              assert.ifError(err2);
              X.ChangeProperty(0, wid, atomA, X.atoms.STRING, 8, 'valueA');
              X.ChangeProperty(0, wid, atomB, X.atoms.STRING, 8, 'valueB');
              X.RotateProperties(wid, 1, [atomA, atomB]);
              X.GetProperty(0, wid, atomA, X.atoms.STRING, 0, 100, (err3, prop) => {
                  assert.ifError(err3);
                  assert.strictEqual(prop.data.toString(), 'valueB');
                  X.GetProperty(0, wid, atomB, X.atoms.STRING, 0, 100, (err4, prop2) => {
                      assert.ifError(err4);
                      assert.strictEqual(prop2.data.toString(), 'valueA');
                      X.DestroyWindow(wid);
                      done();
                  });
              });
          });
      });
  });
});
