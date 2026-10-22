const { describe, it, beforeEach, afterEach } = require('node:test');
const x11 = require('../lib');
const assert = require('node:assert/strict');

describe('Keyboard and pointer control requests', () => {

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

  it('GetKeyboardControl should return current settings', (t, done) => {
      X.GetKeyboardControl((err, control) => {
          assert.ifError(err);
          assert.ok(control.bellPercent >= 0 && control.bellPercent <= 100);
          assert.ok(control.bellPitch > 0);
          assert.strictEqual(control.autoRepeats.length, 32);
          assert.ok([0, 1].includes(control.globalAutoRepeat));
          done();
      });
  });

  it('ChangeKeyboardControl should roundtrip bell settings', (t, done) => {
      X.GetKeyboardControl((err, before) => {
          assert.ifError(err);
          X.ChangeKeyboardControl({ bellPercent: 55, bellPitch: 456 });
          X.GetKeyboardControl((err2, control) => {
              assert.ifError(err2);
              assert.strictEqual(control.bellPercent, 55);
              assert.strictEqual(control.bellPitch, 456);
              X.ChangeKeyboardControl({
                  bellPercent: before.bellPercent,
                  bellPitch: before.bellPitch
              });
              done();
          });
      });
  });

  it('ChangePointerControl/GetPointerControl should roundtrip', (t, done) => {
      X.GetPointerControl((err, before) => {
          assert.ifError(err);
          X.ChangePointerControl(3, 1, 42, true, true);
          X.GetPointerControl((err2, control) => {
              assert.ifError(err2);
              assert.strictEqual(control.accelNumerator, 3);
              assert.strictEqual(control.accelDenominator, 1);
              assert.strictEqual(control.threshold, 42);
              X.ChangePointerControl(
                  before.accelNumerator,
                  before.accelDenominator,
                  before.threshold,
                  true,
                  true
              );
              done();
          });
      });
  });

  it('GetScreenSaver should roundtrip with SetScreenSaver', (t, done) => {
      X.GetScreenSaver((err, before) => {
          assert.ifError(err);
          X.SetScreenSaver(543, 21, 1, 1);
          X.GetScreenSaver((err2, saver) => {
              assert.ifError(err2);
              assert.strictEqual(saver.timeout, 543);
              assert.strictEqual(saver.interval, 21);
              assert.strictEqual(saver.preferBlanking, 1);
              assert.strictEqual(saver.allowExposures, 1);
              X.SetScreenSaver(
                  before.timeout,
                  before.interval,
                  before.preferBlanking,
                  before.allowExposures
              );
              done();
          });
      });
  });

  it('ChangeKeyboardMapping/GetKeyboardMapping should roundtrip', (t, done) => {
      const keycode = display.max_keycode; // remap the last valid keycode
      X.GetKeyboardMapping(keycode, 1, (err, before) => {
          assert.ifError(err);
          X.ChangeKeyboardMapping(keycode, 2, [0x61, 0x41]); // a, A
          X.GetKeyboardMapping(keycode, 1, (err2, rows) => {
              assert.ifError(err2);
              assert.strictEqual(rows[0][0], 0x61);
              assert.strictEqual(rows[0][1], 0x41);
              if (before[0] && before[0].length)
                  X.ChangeKeyboardMapping(keycode, before[0].length, before[0]);
              done();
          });
      });
  });

  it('GetPointerMapping/SetPointerMapping should roundtrip', (t, done) => {
      X.GetPointerMapping((err, map) => {
          assert.ifError(err);
          assert.ok(map.length > 0);
          X.SetPointerMapping(map, (err2, status) => {
              assert.ifError(err2);
              assert.strictEqual(status, 0); // Success
              done();
          });
      });
  });

  it('GetModifierMapping/SetModifierMapping should roundtrip', (t, done) => {
      X.GetModifierMapping((err, rows) => {
          assert.ifError(err);
          assert.strictEqual(rows.length, 8);
          X.SetModifierMapping(rows, (err2, status) => {
              assert.ifError(err2);
              assert.strictEqual(status, 0); // Success
              X.GetModifierMapping((err3, rows2) => {
                  assert.ifError(err3);
                  assert.deepStrictEqual(rows2, rows);
                  done();
              });
          });
      });
  });

  it('Bell should be accepted by server', (t, done) => {
      X.Bell(50);
      X.Bell(-50);
      // broken opcode/length would corrupt the stream and error before this reply
      X.GetInputFocus(err => {
          assert.ifError(err);
          done();
      });
  });

  it('GetMotionEvents should return an array', (t, done) => {
      X.GetMotionEvents(root, 0, 0, (err, events) => {
          assert.ifError(err);
          assert.ok(Array.isArray(events));
          done();
      });
  });
});
