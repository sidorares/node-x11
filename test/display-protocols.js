// Pluggable DISPLAY protocol registry + parseDisplay + options.stream.
// These tests run against an in-process fake server: no real X server needed.
const x11 = require('../lib');
const assert = require('assert');
const { EventEmitter } = require('events');

describe('parseDisplay', () => {
  it('parses bare display', () => {
    const d = x11.parseDisplay(':0');
    assert.strictEqual(d.protocol, '');
    assert.strictEqual(d.host, '');
    assert.strictEqual(d.displayNum, '0');
    assert.strictEqual(d.screenNum, 0);
  });

  it('parses host, display and screen', () => {
    const d = x11.parseDisplay('somehost:1.2');
    assert.strictEqual(d.protocol, '');
    assert.strictEqual(d.host, 'somehost');
    assert.strictEqual(d.displayNum, '1');
    assert.strictEqual(d.screenNum, '2');
  });

  it('parses protocol prefix (standard X syntax)', () => {
    const d = x11.parseDisplay('tcp/somehost:0');
    assert.strictEqual(d.protocol, 'tcp');
    assert.strictEqual(d.host, 'somehost');
  });

  it('parses custom protocol prefix', () => {
    const d = x11.parseDisplay('msg/parent:3.1');
    assert.strictEqual(d.protocol, 'msg');
    assert.strictEqual(d.host, 'parent');
    assert.strictEqual(d.displayNum, '3');
    assert.strictEqual(d.screenNum, '1');
  });

  it('keeps darwin launchd socket paths as host (no protocol)', () => {
    const d = x11.parseDisplay('/private/tmp/com.apple.launchd.abc/org.xquartz:0');
    assert.strictEqual(d.protocol, '');
    assert.strictEqual(d.host, '/private/tmp/com.apple.launchd.abc/org.xquartz');
  });

  it('rejects garbage', () => {
    assert.throws(() => x11.parseDisplay('BOGUS DISPLAY'), /Cannot parse display/);
  });
});

// Minimal in-memory duplex: what a custom transport hands to the client.
// Mirrors the subset of net.Socket the client relies on.
function fakeStreamPair() {
  const clientSide = new EventEmitter();
  const serverSide = new EventEmitter();
  clientSide.write = buf => { setImmediate(() => serverSide.emit('data', buf)); return true; };
  serverSide.write = buf => { setImmediate(() => clientSide.emit('data', buf)); return true; };
  clientSide.end = () => { setImmediate(() => serverSide.emit('end')); };
  serverSide.end = () => { setImmediate(() => clientSide.emit('end')); };
  return { clientSide, serverSide };
}

// Enough of an X server to answer the connection setup: one screen,
// one 24-bit TrueColor visual, vendor string "fake".
function buildServerHello() {
  const vendor = 'fake';
  const vendorPadded = 4 * Math.ceil(vendor.length / 4);
  // additional data after the 8-byte prefix:
  // 32 fixed + vendor + 1 format (8) + screen (40) + depth (8) + visual (24)
  const extra = 32 + vendorPadded + 8 + 40 + 8 + 24;
  const buf = Buffer.alloc(8 + extra);
  let o = 0;
  buf.writeUInt8(1, o); o += 2;            // success + pad
  buf.writeUInt16LE(11, o); o += 2;        // major
  buf.writeUInt16LE(0, o); o += 2;         // minor
  buf.writeUInt16LE(extra / 4, o); o += 2; // length of extra data in 4-byte units
  buf.writeUInt32LE(12000000, o); o += 4;  // release
  buf.writeUInt32LE(0x200000, o); o += 4;  // resource_base
  buf.writeUInt32LE(0x1fffff, o); o += 4;  // resource_mask
  buf.writeUInt32LE(256, o); o += 4;       // motion_buffer_size
  buf.writeUInt16LE(vendor.length, o); o += 2;
  buf.writeUInt16LE(65535, o); o += 2;     // max_request_length
  buf.writeUInt8(1, o++);                  // roots (screens)
  buf.writeUInt8(1, o++);                  // pixmap formats
  buf.writeUInt8(0, o++);                  // image byte order LSB
  buf.writeUInt8(0, o++);                  // bitmap bit order
  buf.writeUInt8(32, o++);                 // scanline unit
  buf.writeUInt8(32, o++);                 // scanline pad
  buf.writeUInt8(8, o++);                  // min keycode
  buf.writeUInt8(255, o++);                // max keycode
  o += 4;                                  // pad
  buf.write(vendor, o, 'latin1'); o += vendorPadded;
  // pixmap format: depth 24, bpp 32, scanline pad 32
  buf.writeUInt8(24, o); buf.writeUInt8(32, o + 1); buf.writeUInt8(32, o + 2); o += 8;
  // screen
  buf.writeUInt32LE(0x123, o); o += 4;     // root window
  buf.writeUInt32LE(0x21, o); o += 4;      // default colormap
  buf.writeUInt32LE(0xffffff, o); o += 4;  // white pixel
  buf.writeUInt32LE(0, o); o += 4;         // black pixel
  buf.writeUInt32LE(0, o); o += 4;         // input masks
  buf.writeUInt16LE(800, o); o += 2;       // width px
  buf.writeUInt16LE(600, o); o += 2;       // height px
  buf.writeUInt16LE(211, o); o += 2;       // width mm
  buf.writeUInt16LE(158, o); o += 2;       // height mm
  buf.writeUInt16LE(1, o); o += 2;         // min installed maps
  buf.writeUInt16LE(1, o); o += 2;         // max installed maps
  buf.writeUInt32LE(0x22, o); o += 4;      // root visual
  buf.writeUInt8(0, o++);                  // backing stores
  buf.writeUInt8(0, o++);                  // save unders
  buf.writeUInt8(24, o++);                 // root depth
  buf.writeUInt8(1, o++);                  // depths
  // depth 24, 1 visual
  buf.writeUInt8(24, o); buf.writeUInt16LE(1, o + 2); o += 8;
  // visual 0x22 TrueColor
  buf.writeUInt32LE(0x22, o); o += 4;
  buf.writeUInt8(4, o++);                  // class TrueColor
  buf.writeUInt8(8, o++);                  // bits per rgb
  buf.writeUInt16LE(256, o); o += 2;       // colormap entries
  buf.writeUInt32LE(0xff0000, o); o += 4;
  buf.writeUInt32LE(0x00ff00, o); o += 4;
  buf.writeUInt32LE(0x0000ff, o); o += 4;
  o += 4;                                  // pad
  assert.strictEqual(o, buf.length);
  return buf;
}

// Answer the client handshake on the server side of a fake stream pair.
// Calls back with the parsed client hello.
function serveHandshake(serverSide, onHello) {
  let pending = Buffer.alloc(0);
  let helloSeen = false;
  serverSide.on('data', data => {
    if (helloSeen) return;
    pending = Buffer.concat([pending, data]);
    if (pending.length < 12) return;
    const authNameLen = pending.readUInt16LE(6);
    const authDataLen = pending.readUInt16LE(8);
    const total = 12 + 4 * Math.ceil(authNameLen / 4) + 4 * Math.ceil(authDataLen / 4);
    if (pending.length < total) return;
    helloSeen = true;
    if (onHello)
      onHello({
        byteOrder: pending.readUInt8(0),
        protocolMajor: pending.readUInt16LE(2),
        authNameLen,
        authDataLen
      });
    serverSide.write(buildServerHello());
  });
}

describe('registerDisplayProtocol', () => {
  it('connects through a registered custom protocol', done => {
    const { clientSide, serverSide } = fakeStreamPair();
    let seenParams = null;
    let hello = null;
    x11.registerDisplayProtocol('fakeproto', (params, options) => {
      seenParams = params;
      assert.strictEqual(typeof options, 'object');
      serveHandshake(serverSide, h => { hello = h; });
      return clientSide;
    });

    const client = x11.createClient(
      { display: 'fakeproto/some-resource:7.1', disableBigRequests: true },
      (err, display) => {
        if (err) return done(err);
        try {
          assert.strictEqual(seenParams.protocol, 'fakeproto');
          assert.strictEqual(seenParams.host, 'some-resource');
          assert.strictEqual(seenParams.displayNum, '7');
          assert.strictEqual(seenParams.screenNum, '1');
          assert.strictEqual(client.screenNum, '1');
          // empty auth by default for custom transports
          assert.strictEqual(hello.authNameLen, 0);
          assert.strictEqual(hello.authDataLen, 0);
          assert.strictEqual(hello.protocolMajor, 11);
          assert.strictEqual(display.vendor, 'fake');
          assert.strictEqual(display.screen[0].root, 0x123);
          assert.strictEqual(display.screen[0].root_depth, 24);
          done();
        } catch (e) {
          done(e);
        }
      });
    client.on('error', done);
  });

  it('honours options.auth for custom transports', done => {
    const { clientSide, serverSide } = fakeStreamPair();
    x11.registerDisplayProtocol('fakeauth', () => {
      serveHandshake(serverSide, hello => {
        try {
          assert.strictEqual(hello.authNameLen, 'MIT-MAGIC-COOKIE-1'.length);
          assert.strictEqual(hello.authDataLen, 4);
        } catch (e) {
          done(e);
        }
      });
      return clientSide;
    });
    const client = x11.createClient({
      display: 'fakeauth/x:0',
      disableBigRequests: true,
      auth: { name: 'MIT-MAGIC-COOKIE-1', data: 'abcd' }
    }, err => done(err));
    client.on('error', done);
  });

  it('throws on unregistered protocol', () => {
    assert.throws(
      () => x11.createClient({ display: 'nosuchproto/x:0' }, () => {}),
      /unknown display protocol/);
  });
});

describe('options.stream', () => {
  it('uses an injected duplex stream directly', done => {
    const { clientSide, serverSide } = fakeStreamPair();
    serveHandshake(serverSide);
    const client = x11.createClient(
      { display: ':9', stream: clientSide, disableBigRequests: true },
      (err, display) => {
        if (err) return done(err);
        try {
          assert.strictEqual(client.displayNum, '9');
          assert.strictEqual(display.screen.length, 1);
          done();
        } catch (e) {
          done(e);
        }
      });
    client.on('error', done);
  });
});
