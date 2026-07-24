const x11 = require('../lib');
const should = require('should');
const assert = require('assert');

describe('Keyboard and pointer control requests', () => {

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

  it('GetKeyboardControl should return current settings', done => {
      X.GetKeyboardControl((err, control) => {
          should.not.exist(err);
          control.bellPercent.should.be.within(0, 100);
          control.bellPitch.should.be.above(0);
          control.autoRepeats.length.should.equal(32);
          [0, 1].should.containEql(control.globalAutoRepeat);
          done();
      });
  });

  it('ChangeKeyboardControl should roundtrip bell settings', done => {
      X.GetKeyboardControl((err, before) => {
          should.not.exist(err);
          X.ChangeKeyboardControl({ bellPercent: 55, bellPitch: 456 });
          X.GetKeyboardControl((err2, control) => {
              should.not.exist(err2);
              control.bellPercent.should.equal(55);
              control.bellPitch.should.equal(456);
              X.ChangeKeyboardControl({
                  bellPercent: before.bellPercent,
                  bellPitch: before.bellPitch
              });
              done();
          });
      });
  });

  it('ChangePointerControl/GetPointerControl should roundtrip', done => {
      X.GetPointerControl((err, before) => {
          should.not.exist(err);
          X.ChangePointerControl(3, 1, 42, true, true);
          X.GetPointerControl((err2, control) => {
              should.not.exist(err2);
              control.accelNumerator.should.equal(3);
              control.accelDenominator.should.equal(1);
              control.threshold.should.equal(42);
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

  it('GetScreenSaver should roundtrip with SetScreenSaver', done => {
      X.GetScreenSaver((err, before) => {
          should.not.exist(err);
          X.SetScreenSaver(543, 21, 1, 1);
          X.GetScreenSaver((err2, saver) => {
              should.not.exist(err2);
              saver.timeout.should.equal(543);
              saver.interval.should.equal(21);
              saver.preferBlanking.should.equal(1);
              saver.allowExposures.should.equal(1);
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

  it('ChangeKeyboardMapping/GetKeyboardMapping should roundtrip', done => {
      const keycode = display.max_keycode; // remap the last valid keycode
      X.GetKeyboardMapping(keycode, 1, (err, before) => {
          should.not.exist(err);
          X.ChangeKeyboardMapping(keycode, 2, [0x61, 0x41]); // a, A
          X.GetKeyboardMapping(keycode, 1, (err2, rows) => {
              should.not.exist(err2);
              rows[0][0].should.equal(0x61);
              rows[0][1].should.equal(0x41);
              if (before[0] && before[0].length)
                  X.ChangeKeyboardMapping(keycode, before[0].length, before[0]);
              done();
          });
      });
  });

  it('GetPointerMapping/SetPointerMapping should roundtrip', done => {
      X.GetPointerMapping((err, map) => {
          should.not.exist(err);
          map.length.should.be.above(0);
          X.SetPointerMapping(map, (err2, status) => {
              should.not.exist(err2);
              status.should.equal(0); // Success
              done();
          });
      });
  });

  it('GetModifierMapping/SetModifierMapping should roundtrip', done => {
      X.GetModifierMapping((err, rows) => {
          should.not.exist(err);
          rows.length.should.equal(8);
          X.SetModifierMapping(rows, (err2, status) => {
              should.not.exist(err2);
              status.should.equal(0); // Success
              X.GetModifierMapping((err3, rows2) => {
                  should.not.exist(err3);
                  assert.deepEqual(rows2, rows);
                  done();
              });
          });
      });
  });

  it('Bell should be accepted by server', done => {
      X.Bell(50);
      X.Bell(-50);
      // broken opcode/length would corrupt the stream and error before this reply
      X.GetInputFocus(err => {
          should.not.exist(err);
          done();
      });
  });

  it('GetMotionEvents should return an array', done => {
      X.GetMotionEvents(root, 0, 0, (err, events) => {
          should.not.exist(err);
          events.should.be.an.Array();
          done();
      });
  });
});
