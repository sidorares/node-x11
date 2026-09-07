'use strict';

// A minimal XVideo adaptor for the pure-JS X server (lib/xserver), used by
// test/xserver/xv.js to exercise the client's image path end to end.
//
// Real Xv adaptors only exist on hardware: Xvfb and XQuartz advertise the
// extension and answer "no adaptors present", so nothing in CI can accept a
// frame. This registers one image adaptor with two formats - YUY2 (packed)
// and I420 (planar) - decodes XvPutImage/XvShmPutImage into the target
// drawable, and sends XvVideoNotify/XvPortNotify to clients that selected
// them. The wire layouts come from autogen/proto/xv.xml, not from the
// client's encoder.
//
// Deliberate liberties, all noted where they happen:
//  - scaling is nearest-neighbour, so a test can predict every pixel;
//  - a PutImage starts a "stream" on its drawable and StopVideo ends one, so
//    VideoNotify Started/Stopped follow those transitions rather than a real
//    video timeline;
//  - ShmPutImage reads from a segment the test registers directly on the
//    extension, because the JS server has no MIT-SHM.

const { XError, codes } = require('../../lib/xserver/errors');

const pad4 = n => (n + 3) & ~3;

// image adaptor: takes images from client memory (Type.ImageMask | InputMask)
const ADAPTOR_TYPE = 16 | 1;
const BASE_PORT = 0x1f00;
const NUM_PORTS = 2;
const ENCODING = 0x1f10;

const PACKED = 0, PLANAR = 1;
const YUV = 1;

const guid = hex => Buffer.from(hex.replace(/ /g, ''), 'hex');

const FORMATS = [
    {
        id: 0x32595559, // 'YUY2'
        type: YUV,
        byteOrder: 0,
        guid: guid('59 55 59 32 00 00 10 00 80 00 00 aa 00 38 9b 71'),
        bpp: 16,
        numPlanes: 1,
        depth: 24,
        format: PACKED,
        compOrder: 'YUYV',
        scanlineOrder: 0
    },
    {
        id: 0x30323449, // 'I420'
        type: YUV,
        byteOrder: 0,
        guid: guid('49 34 32 30 00 00 10 00 80 00 00 aa 00 38 9b 71'),
        bpp: 12,
        numPlanes: 3,
        depth: 24,
        format: PLANAR,
        compOrder: 'YUV',
        scanlineOrder: 0
    }
];

const ATTRIBUTES = [
    { name: 'XV_BRIGHTNESS', flags: 3, min: -1000, max: 1000, value: 0 },
    { name: 'XV_CONTRAST', flags: 3, min: -1000, max: 1000, value: 0 }
];

// Plane layout, following the xf86 XvQueryImageAttributes convention:
// dimensions round up to even, every pitch rounds up to 4 bytes.
function layout(format, width, height) {
    const w = (width + 1) & ~1;
    const h = (height + 1) & ~1;
    if (format.format === PACKED) {
        const pitch = pad4(w * 2);
        return { width: w, height: h, pitches: [pitch], offsets: [0], size: pitch * h };
    }
    const yPitch = pad4(w);
    const ySize = yPitch * h;
    const uvPitch = pad4(w >> 1);
    const uvSize = uvPitch * (h >> 1);
    return {
        width: w,
        height: h,
        pitches: [yPitch, uvPitch, uvPitch],
        offsets: [0, ySize, ySize + uvSize],
        size: ySize + uvSize * 2
    };
}

// BT.601 limited range, the conversion an adaptor does in hardware.
function yuvToRgb(y, u, v) {
    const c = y - 16, d = u - 128, e = v - 128;
    const clamp = n => n < 0 ? 0 : (n > 255 ? 255 : n | 0);
    const r = clamp((298 * c + 409 * e + 128) >> 8);
    const g = clamp((298 * c - 100 * d - 208 * e + 128) >> 8);
    const b = clamp((298 * c + 516 * d + 128) >> 8);
    return ((r << 16) | (g << 8) | b) >>> 0;
}

// One pixel of a decoded frame, as 0x00RRGGBB.
function samplePixel(format, plane, data, base, x, y) {
    if (format.format === PACKED) {
        // YUY2: Y0 U Y1 V per two pixels
        const row = base + plane.offsets[0] + y * plane.pitches[0];
        const pair = row + (x >> 1) * 4;
        const yv = data[pair + ((x & 1) ? 2 : 0)];
        return yuvToRgb(yv, data[pair + 1], data[pair + 3]);
    }
    const yv = data[base + plane.offsets[0] + y * plane.pitches[0] + x];
    const uv = base + plane.offsets[1] + (y >> 1) * plane.pitches[1] + (x >> 1);
    const vv = base + plane.offsets[2] + (y >> 1) * plane.pitches[2] + (x >> 1);
    return yuvToRgb(yv, data[uv], data[vv]);
}

module.exports = function createXvAdaptor() {
    const state = {
        firstEvent: 0,
        firstError: 0,
        grabs: new Map(),          // port -> client
        attributes: new Map(),     // port -> {name: value}
        videoNotify: new Map(),    // drawable -> Set(client)
        portNotify: new Map(),     // port -> Set(client)
        segments: new Map(),       // shmseg -> Buffer (the test fills this in)
        streaming: new Map(),      // drawable -> port currently putting to it
        putImages: [],             // decoded PutImage headers, for assertions
        shmPutImages: []           // decoded ShmPutImage headers
    };

    const badPort = port => new XError(state.firstError + 0, port);

    const checkPort = port => {
        if (port < BASE_PORT || port >= BASE_PORT + NUM_PORTS)
            throw badPort(port);
        return port;
    };

    const findFormat = id => {
        const f = FORMATS.find(f => f.id === id);
        if (!f)
            throw new XError(codes.Match, id);
        return f;
    };

    const attrValues = port => {
        let v = state.attributes.get(port);
        if (!v) {
            v = {};
            for (const a of ATTRIBUTES)
                v[a.name] = a.value;
            state.attributes.set(port, v);
        }
        return v;
    };

    const select = (map, key, client, onoff) => {
        let set = map.get(key);
        if (onoff) {
            if (!set)
                map.set(key, set = new Set());
            set.add(client);
        } else if (set) {
            set.delete(client);
        }
    };

    // A real adaptor reports Started when a stream begins on a drawable and
    // Stopped when it ends, not once per frame - so only transitions notify.
    const startStream = (server, drawable, port) => {
        if (state.streaming.get(drawable) === port)
            return;
        state.streaming.set(drawable, port);
        sendVideoNotify(server, drawable, port, 0 /* Started */);
    };

    const stopStream = (server, drawable, port) => {
        if (state.streaming.get(drawable) === undefined)
            return;
        state.streaming.delete(drawable);
        sendVideoNotify(server, drawable, port, 1 /* Stopped */);
    };

    const sendVideoNotify = (server, drawable, port, reason) => {
        const set = state.videoNotify.get(drawable);
        if (!set)
            return;
        const b = Buffer.alloc(32);
        b[0] = state.firstEvent + 0;
        b[1] = reason;
        b.writeUInt32LE(server.now() >>> 0, 4);
        b.writeUInt32LE(drawable >>> 0, 8);
        b.writeUInt32LE(port >>> 0, 12);
        for (const c of set)
            c.sendEvent(b);
    };

    const sendPortNotify = (server, port, attribute, value) => {
        const set = state.portNotify.get(port);
        if (!set)
            return;
        const b = Buffer.alloc(32);
        b[0] = state.firstEvent + 1;
        b.writeUInt32LE(server.now() >>> 0, 4);
        b.writeUInt32LE(port >>> 0, 8);
        b.writeUInt32LE(attribute >>> 0, 12);
        b.writeInt32LE(value, 16);
        for (const c of set)
            c.sendEvent(b);
    };

    // The shared half of PutImage / ShmPutImage: decode `data` at `base` per
    // the format's plane layout and blit it, nearest-neighbour scaled, into
    // the drawable.
    const blit = (server, req, data, base) => {
        const format = findFormat(req.id);
        const plane = layout(format, req.width, req.height);
        if (base + plane.size > data.length)
            throw new XError(codes.Length, plane.size);
        const drawable = server.getDrawable(req.drawable);
        const gc = server.getGC(req.gc);
        const raster = drawable.raster;
        const rgc = gc.rasterGC();
        for (let dy = 0; dy < req.drwHeight; dy++) {
            const sy = req.srcY + Math.floor(dy * req.srcHeight / req.drwHeight);
            if (sy < 0 || sy >= plane.height)
                continue;
            for (let dx = 0; dx < req.drwWidth; dx++) {
                const sx = req.srcX + Math.floor(dx * req.srcWidth / req.drwWidth);
                if (sx < 0 || sx >= plane.width)
                    continue;
                raster.setPixel(rgc, req.drwX + dx, req.drwY + dy,
                    samplePixel(format, plane, data, base, sx, sy));
            }
        }
    };

    // 40-byte PutImage header (36 bytes past the request header), or the
    // same fields at the same offsets for the 52-byte ShmPutImage.
    const readGeometry = (body, off) => ({
        srcX: body.readInt16LE(off),
        srcY: body.readInt16LE(off + 2),
        srcWidth: body.readUInt16LE(off + 4),
        srcHeight: body.readUInt16LE(off + 6),
        drwX: body.readInt16LE(off + 8),
        drwY: body.readInt16LE(off + 10),
        drwWidth: body.readUInt16LE(off + 12),
        drwHeight: body.readUInt16LE(off + 14),
        width: body.readUInt16LE(off + 16),
        height: body.readUInt16LE(off + 18)
    });

    return {
        name: 'XVideo',
        eventsCount: 2,
        errorsCount: 3,
        state,
        layout,
        yuvToRgb,
        formats: FORMATS,
        basePort: BASE_PORT,
        numPorts: NUM_PORTS,

        init(server, ext) {
            state.firstEvent = ext.firstEvent;
            state.firstError = ext.firstError;
        },

        handleRequest(server, client, minor, body) {
            switch (minor) {
                case 0: { // QueryExtension (version)
                    const b = client.startReply(0, 0);
                    b.writeUInt16LE(2, 8);
                    b.writeUInt16LE(2, 10);
                    client.send(b);
                    break;
                }

                case 1: { // QueryAdaptors
                    server.getWindow(body.readUInt32LE(0));
                    const name = 'JS Test Video';
                    const infoLen = 12 + pad4(name.length) + 8;
                    const b = client.startReply(infoLen / 4, 0);
                    b.writeUInt16LE(1, 8);          // num_adaptors
                    let o = 32;
                    b.writeUInt32LE(BASE_PORT, o);
                    b.writeUInt16LE(name.length, o + 4);
                    b.writeUInt16LE(NUM_PORTS, o + 6);
                    b.writeUInt16LE(1, o + 8);      // num_formats
                    b.writeUInt8(ADAPTOR_TYPE, o + 10);
                    o += 12;
                    b.write(name, o, 'latin1');
                    o += pad4(name.length);
                    b.writeUInt32LE(server.rootVisual >>> 0, o);
                    b.writeUInt8(24, o + 4);
                    client.send(b);
                    break;
                }

                case 2: { // QueryEncodings
                    checkPort(body.readUInt32LE(0));
                    const name = 'XV_IMAGE';
                    const b = client.startReply((20 + pad4(name.length)) / 4, 0);
                    b.writeUInt16LE(1, 8);          // num_encodings
                    let o = 32;
                    b.writeUInt32LE(ENCODING, o);
                    b.writeUInt16LE(name.length, o + 4);
                    b.writeUInt16LE(2048, o + 6);   // max width
                    b.writeUInt16LE(2048, o + 8);   // max height
                    b.writeInt32LE(0, o + 12);      // rate numerator
                    b.writeInt32LE(1, o + 16);      // rate denominator
                    o += 20;
                    b.write(name, o, 'latin1');
                    client.send(b);
                    break;
                }

                case 3: { // GrabPort
                    const port = checkPort(body.readUInt32LE(0));
                    const owner = state.grabs.get(port);
                    const status = (owner && owner !== client) ? 2 /* AlreadyGrabbed */ : 0;
                    if (status === 0)
                        state.grabs.set(port, client);
                    client.send(client.startReply(0, status));
                    break;
                }

                case 4: { // UngrabPort
                    const port = checkPort(body.readUInt32LE(0));
                    if (state.grabs.get(port) === client)
                        state.grabs.delete(port);
                    break;
                }

                case 9: { // StopVideo
                    const port = checkPort(body.readUInt32LE(0));
                    const drawable = body.readUInt32LE(4);
                    server.getDrawable(drawable);
                    stopStream(server, drawable, port);
                    break;
                }

                case 10: { // SelectVideoNotify
                    const drawable = body.readUInt32LE(0);
                    server.getDrawable(drawable);
                    select(state.videoNotify, drawable, client, body.readUInt8(4) !== 0);
                    break;
                }

                case 11: { // SelectPortNotify
                    const port = checkPort(body.readUInt32LE(0));
                    select(state.portNotify, port, client, body.readUInt8(4) !== 0);
                    break;
                }

                case 12: { // QueryBestSize
                    checkPort(body.readUInt32LE(0));
                    const b = client.startReply(0, 0);
                    // this adaptor scales freely: the requested size is best
                    b.writeUInt16LE(body.readUInt16LE(8), 8);
                    b.writeUInt16LE(body.readUInt16LE(10), 10);
                    client.send(b);
                    break;
                }

                case 13: { // SetPortAttribute
                    const port = checkPort(body.readUInt32LE(0));
                    const atom = body.readUInt32LE(4);
                    const value = body.readInt32LE(8);
                    const name = server.atomsById.get(atom);
                    const attr = ATTRIBUTES.find(a => a.name === name);
                    if (!attr)
                        throw new XError(codes.Match, atom);
                    if (value < attr.min || value > attr.max)
                        throw new XError(codes.Value, value);
                    attrValues(port)[name] = value;
                    sendPortNotify(server, port, atom, value);
                    break;
                }

                case 14: { // GetPortAttribute
                    const port = checkPort(body.readUInt32LE(0));
                    const atom = body.readUInt32LE(4);
                    const name = server.atomsById.get(atom);
                    const attr = ATTRIBUTES.find(a => a.name === name);
                    if (!attr)
                        throw new XError(codes.Match, atom);
                    const b = client.startReply(0, 0);
                    b.writeInt32LE(attrValues(port)[name], 8);
                    client.send(b);
                    break;
                }

                case 15: { // QueryPortAttributes
                    checkPort(body.readUInt32LE(0));
                    // text_size counts the name strings (each NUL-terminated
                    // and padded), not the fixed part of the structs
                    let textSize = 0;
                    for (const a of ATTRIBUTES)
                        textSize += pad4(a.name.length + 1);
                    const b = client.startReply((ATTRIBUTES.length * 16 + textSize) / 4, 0);
                    b.writeUInt32LE(ATTRIBUTES.length, 8);
                    b.writeUInt32LE(textSize, 12);
                    let o = 32;
                    for (const a of ATTRIBUTES) {
                        b.writeUInt32LE(a.flags, o);
                        b.writeInt32LE(a.min, o + 4);
                        b.writeInt32LE(a.max, o + 8);
                        b.writeUInt32LE(a.name.length + 1, o + 12);
                        b.write(a.name, o + 16, 'latin1');
                        o += 16 + pad4(a.name.length + 1);
                    }
                    client.send(b);
                    break;
                }

                case 16: { // ListImageFormats
                    checkPort(body.readUInt32LE(0));
                    const b = client.startReply(FORMATS.length * 32, 0);
                    b.writeUInt32LE(FORMATS.length, 8);
                    let o = 32;
                    for (const f of FORMATS) {
                        b.writeUInt32LE(f.id, o);
                        b.writeUInt8(f.type, o + 4);
                        b.writeUInt8(f.byteOrder, o + 5);
                        f.guid.copy(b, o + 8);
                        b.writeUInt8(f.bpp, o + 24);
                        b.writeUInt8(f.numPlanes, o + 25);
                        b.writeUInt8(f.depth, o + 28);
                        b.writeUInt8(f.format, o + 44);
                        b.writeUInt32LE(8, o + 48);   // y_sample_bits
                        b.writeUInt32LE(8, o + 52);   // u_sample_bits
                        b.writeUInt32LE(8, o + 56);   // v_sample_bits
                        // chroma subsampling: 4:2:2 packed, 4:2:0 planar
                        const vertUV = f.format === PLANAR ? 2 : 1;
                        b.writeUInt32LE(1, o + 60);   // horz_y_period
                        b.writeUInt32LE(2, o + 64);   // horz_u_period
                        b.writeUInt32LE(2, o + 68);   // horz_v_period
                        b.writeUInt32LE(1, o + 72);   // vert_y_period
                        b.writeUInt32LE(vertUV, o + 76);
                        b.writeUInt32LE(vertUV, o + 80);
                        b.write(f.compOrder, o + 84, 'latin1');
                        b.writeUInt8(f.scanlineOrder, o + 116);
                        o += 128;
                    }
                    client.send(b);
                    break;
                }

                case 17: { // QueryImageAttributes
                    checkPort(body.readUInt32LE(0));
                    const format = findFormat(body.readUInt32LE(4));
                    const plane = layout(format, body.readUInt16LE(8), body.readUInt16LE(10));
                    const b = client.startReply(plane.pitches.length * 2, 0);
                    b.writeUInt32LE(plane.pitches.length, 8);
                    b.writeUInt32LE(plane.size, 12);
                    b.writeUInt16LE(plane.width, 16);
                    b.writeUInt16LE(plane.height, 18);
                    for (let i = 0; i < plane.pitches.length; i++) {
                        b.writeUInt32LE(plane.pitches[i], 32 + i * 4);
                        b.writeUInt32LE(plane.offsets[i], 32 + plane.pitches.length * 4 + i * 4);
                    }
                    client.send(b);
                    break;
                }

                case 18: { // PutImage
                    const req = Object.assign({
                        port: checkPort(body.readUInt32LE(0)),
                        drawable: body.readUInt32LE(4),
                        gc: body.readUInt32LE(8),
                        id: body.readUInt32LE(12)
                    }, readGeometry(body, 16));
                    req.dataLength = body.length - 36;
                    state.putImages.push(req);
                    blit(server, req, body, 36);
                    startStream(server, req.drawable, req.port);
                    break;
                }

                case 19: { // ShmPutImage
                    const req = Object.assign({
                        port: checkPort(body.readUInt32LE(0)),
                        drawable: body.readUInt32LE(4),
                        gc: body.readUInt32LE(8),
                        shmseg: body.readUInt32LE(12),
                        id: body.readUInt32LE(16),
                        offset: body.readUInt32LE(20)
                    }, readGeometry(body, 24));
                    req.sendEvent = body.readUInt8(44) !== 0;
                    state.shmPutImages.push(req);
                    const segment = state.segments.get(req.shmseg);
                    if (!segment)
                        throw new XError(codes.Value, req.shmseg);
                    blit(server, req, segment, req.offset);
                    startStream(server, req.drawable, req.port);
                    break;
                }

                default:
                    throw new XError(codes.Implementation, minor);
            }
        }
    };
};
