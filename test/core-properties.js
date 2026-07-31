const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

  // keep for a while: this snippet helps to track global leak
  global.__defineSetter__('valueName', v => {
      console.trace();
  });

describe('Window property', () => {

  let display;
  let X;
  let wid;
  beforeEach(done => {
      const client = x11.createClient((err, dpy) => {
          if (!err) {
              display = dpy;
              X = display.client;
              wid = X.AllocID();
              X.CreateWindow(wid, display.screen[0].root, 0, 0, 100, 100, 0, 0, 0, 0, { eventMask: x11.eventMask.PropertyChange});
              done();
              client.removeListener('error', done); // all future errors should be attached to corresponding test 'done'
          } else {
              done(err);
          }
      });
      client.on('error', done);
  });

  afterEach(done => {
      X.terminate();
      X.on('end', done);
      X = null;
      display = null;
  });

  it('shuld exist after set with ChangeProperty', done => {
      X.on('error', done);
      const propvalset = "some property value";
      X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, propvalset);
      X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 10000000, (err, prop) => {
          if (err) return done(err);
          const propvalget = prop.data.toString();
          assert.equal(propvalset, propvalget, 'get property result different from set property value');
          done();
      });
  });

  it('should report the format the property was stored with', done => {
      X.on('error', done);
      // 8 vs 32 is not derivable from the type: a CARDINAL array of bytes and
      // one of words are both CARDINAL, and telling them apart is the whole
      // job when diagnosing a property that "does not work"
      const words = Buffer.alloc(8);
      words.writeUInt32LE(0x11223344, 0);
      words.writeUInt32LE(0x55667788, 4);
      X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'bytes');
      X.ChangeProperty(0, wid, X.atoms.WM_COMMAND, X.atoms.CARDINAL, 32, words);
      X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 100, (err, prop) => {
          if (err) return done(err);
          assert.strictEqual(prop.format, 8);
          assert.strictEqual(prop.data.length, 5);
          X.GetProperty(0, wid, X.atoms.WM_COMMAND, X.atoms.CARDINAL, 0, 100, (err, prop) => {
              if (err) return done(err);
              assert.strictEqual(prop.format, 32);
              assert.strictEqual(prop.data.readUInt32LE(4), 0x55667788);
              // a property that does not exist reports neither type nor format
              X.GetProperty(0, wid, X.atoms.WM_ICON_NAME, 0, 0, 100, (err, prop) => {
                  if (err) return done(err);
                  assert.strictEqual(prop.type, 0);
                  assert.strictEqual(prop.format, 0);
                  assert.strictEqual(prop.data.length, 0);
                  done();
              });
          });
      });
  });

  it('should generate PropertyNotify event', done => {
      X.on('error', done);
      const propvalset = "some property value";
      X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, propvalset);
      X.on('event', ev => {
          if (ev.name === 'PropertyNotify')
          {
              assert.equal(ev.atom, X.atoms.WM_NAME, 'atom in notification should be same as in ChangeProperty');
              // TODO: replace 0 with X.PropertyNewValue
              assert.equal(ev.state, 0, 'atom in notification should be same as in ChangeProperty');
              assert.equal(ev.wid, wid, 'window in notification should be same as in ChangeProperty');
              done();
              return;
          }
          done('unexpexted event');
      });
  });

  it('should not exist after DeleteProperty called', done => {
      X.on('error', done);
      const propvalset = "some property value";
      X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, propvalset);
      X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 10000000, (err, prop) => {
          if (err) return done(err);
          const propvalget = prop.data.toString();
          assert.equal(propvalset, propvalget, 'get property result different from set property value');
          X.DeleteProperty(wid, X.atoms.WM_NAME);
          X.GetProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 0, 10000000, (err, prop) => {
              assert.equal(prop.type, 0, 'non-existent property type should be 0');
              assert.equal(prop.data.length, 0, 'non-existent property data length should be 0');
              done();
          });
      });
  });

  // it('should exist in the ListProperties result after inserted');
  // it('should not exist after GetProperty with delete flag called');
  //it('should not exist after GetProperty with delete flag called', function(done) {
  //    done();
  //});
});
