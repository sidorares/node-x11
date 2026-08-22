// Wire-format tests for the Apple-WM extension. These stub the client, so
// they need neither a real X server nor XQuartz and run everywhere.
//
// Field offsets below are from applewmproto.h (XQuartz), e.g.
//   typedef struct _AppleWMFrameHitTest {
//       CARD8 reqType; CARD8 wmReqType; CARD16 length;
//       CARD16 frame_class; CARD16 pad1;
//       CARD16 px; CARD16 py;                  <-- note the pad before px
//       CARD16 ix, iy, iw, ih, ox, oy, ow, oh;
//   } xAppleWMFrameHitTestReq;   /* sz = 28 */

const assert = require('assert');
const appleWM = require('../lib/ext/apple-wm');

const MAJOR = 130;
const FIRST_EVENT = 68;

/** Build an ext with a stubbed client, capturing everything written. */
function makeExt() {
  const written = [];
  const X = {
    seq_num: 0,
    replies: {},
    eventParsers: {},
    pack_stream: {
      put: (buf) => written.push(buf),
      submit: () => {},
    },
    QueryExtension: (name, cb) => {
      assert.strictEqual(name, 'Apple-WM');
      cb(null, { present: true, majorOpcode: MAJOR, firstEvent: FIRST_EVENT });
    },
  };
  let ext = null;
  appleWM.requireExt({ client: X }, (err, e) => {
    assert.ifError(err);
    ext = e;
  });
  return { ext, X, written, last: () => written[written.length - 1] };
}

describe('Apple-WM', () => {
  it('exposes events and EventKind by the time the callback runs', () => {
    // these used to be assigned *after* callback(null, ext), so a consumer
    // reading them inside the callback got undefined
    const X = {
      seq_num: 0,
      replies: {},
      eventParsers: {},
      pack_stream: { put: () => {}, submit: () => {} },
      QueryExtension: (name, cb) =>
        cb(null, { present: true, majorOpcode: MAJOR, firstEvent: FIRST_EVENT }),
    };
    let seen = null;
    appleWM.requireExt({ client: X }, (err, ext) => {
      seen = {
        events: ext.events,
        eventKind: ext.EventKind,
        notifyMask: ext.NotifyMask,
      };
    });
    assert.ok(seen, 'callback should have run');
    assert.deepStrictEqual(seen.events, {
      AppleWMControllerNotify: 0,
      AppleWMActivationNotify: 1,
      AppleWMPasteboardNotify: 2,
    });
    assert.strictEqual(seen.eventKind.Controller.CloseWindow, 2);
    assert.strictEqual(seen.notifyMask.All, 7);
  });

  it('registers event parsers for all three notify events', () => {
    const { X } = makeExt();
    for (const offset of [0, 1, 2]) {
      assert.strictEqual(
        typeof X.eventParsers[FIRST_EVENT + offset],
        'function',
        `parser missing for event ${FIRST_EVENT + offset}`,
      );
    }
  });

  it('parses a notify into name/type/kind/time/arg', () => {
    const { X } = makeExt();
    // xAppleWMNotifyEvent: type, kind, sequenceNumber, time, pad1, arg
    // -> the parser gets bytes 8+, so arg sits at raw offset 2
    const raw = Buffer.alloc(24);
    raw.writeUInt32LE(0x12345678, 2);
    const type = FIRST_EVENT + 0;
    const ev = X.eventParsers[type](type, 9, 0xaabbccdd, 2 /* CloseWindow */, raw);
    assert.strictEqual(ev.name, 'AppleWMControllerNotify');
    assert.strictEqual(ev.type, type, 'type is the wire event type');
    assert.strictEqual(ev.kind, 2, 'kind is the detail byte (EventKind.*)');
    assert.strictEqual(ev.seq, 9);
    assert.strictEqual(ev.time, 0xaabbccdd);
    assert.strictEqual(ev.arg, 0x12345678);
  });

  it('encodes FrameHitTest with px/py after the pad word', () => {
    const { ext, last } = makeExt();
    ext.FrameHitTest(
      1, // frame_class
      11, // px
      22, // py
      33, // ix
      44, // iy
      55, // iw
      66, // ih
      77, // ox
      88, // oy
      99, // ow
      111, // oh
      () => {},
    );
    const b = last();
    assert.strictEqual(b.length, 28, 'sz_xAppleWMFrameHitTestReq');
    assert.strictEqual(b.readUInt8(0), MAJOR);
    assert.strictEqual(b.readUInt8(1), 2, 'X_AppleWMFrameHitTest');
    assert.strictEqual(b.readUInt16LE(2), 7, 'request length in words');
    assert.strictEqual(b.readUInt16LE(4), 1, 'frame_class');
    assert.strictEqual(b.readUInt16LE(6), 0, 'pad1 must stay zero');
    assert.strictEqual(b.readUInt16LE(8), 11, 'px');
    assert.strictEqual(b.readUInt16LE(10), 22, 'py');
    assert.strictEqual(b.readUInt16LE(12), 33, 'ix');
    assert.strictEqual(b.readUInt16LE(14), 44, 'iy');
    assert.strictEqual(b.readUInt16LE(16), 55, 'iw');
    assert.strictEqual(b.readUInt16LE(18), 66, 'ih');
    assert.strictEqual(b.readUInt16LE(20), 77, 'ox');
    assert.strictEqual(b.readUInt16LE(22), 88, 'oy');
    assert.strictEqual(b.readUInt16LE(24), 99, 'ow');
    assert.strictEqual(b.readUInt16LE(26), 111, 'oh');
  });

  it('encodes FrameGetRect (frame_rect occupies the second word)', () => {
    const { ext, last } = makeExt();
    ext.FrameGetRect(1, 2, 33, 44, 55, 66, 77, 88, 99, 111, () => {});
    const b = last();
    assert.strictEqual(b.length, 24, 'sz_xAppleWMFrameGetRectReq');
    assert.strictEqual(b.readUInt8(1), 1, 'X_AppleWMFrameGetRect');
    assert.strictEqual(b.readUInt16LE(2), 6, 'request length in words');
    assert.strictEqual(b.readUInt16LE(4), 1, 'frame_class');
    assert.strictEqual(b.readUInt16LE(6), 2, 'frame_rect');
    assert.strictEqual(b.readUInt16LE(8), 33, 'ix');
    assert.strictEqual(b.readUInt16LE(22), 111, 'oh');
  });

  it('encodes SetWindowLevel', () => {
    const { ext, last } = makeExt();
    ext.SetWindowLevel(0x1234, ext.WindowLevel.Floating);
    const b = last();
    assert.strictEqual(b.length, 12);
    assert.strictEqual(b.readUInt8(1), 9, 'X_AppleWMSetWindowLevel');
    assert.strictEqual(b.readUInt32LE(4), 0x1234, 'window');
    assert.strictEqual(b.readUInt32LE(8), 1, 'level');
  });

  it('encodes SetWindowMenu items as shortcut byte + NUL-terminated label', () => {
    const { ext, last } = makeExt();
    ext.SetWindowMenu(['one', ['C', 'two']]);
    const b = last();
    assert.strictEqual(b.readUInt8(1), 11, 'X_AppleWMSetWindowMenu');
    assert.strictEqual(b.readUInt16LE(4), 2, 'item count');
    assert.strictEqual(b.readUInt8(8), 0, 'no shortcut for the first item');
    assert.strictEqual(b.toString('latin1', 9, 12), 'one');
    assert.strictEqual(b.readUInt8(12), 0, 'NUL terminator');
    assert.strictEqual(String.fromCharCode(b.readUInt8(13)), 'C', 'shortcut');
    assert.strictEqual(b.toString('latin1', 14, 17), 'two');
  });
});
