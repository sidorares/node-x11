// XVideo test pattern: hands an adaptor colour bars, one frame at a time.
//
//   node examples/xv/testpattern.js [--shm] [--width N] [--height N]
//
// Needs an adaptor, which means a real driver: Xvfb and XQuartz advertise the
// extension and report zero adaptors, and this prints what it found and exits
// in that case (which is what a client should do - fall back to core
// PutImage). `xvinfo` lists the same adaptors from the command line.
//
// --shm renders into a MIT-SHM segment and uses XvShmPutImage, recycling the
// segment on the ShmCompletion event.

const x11 = require('../../lib');

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = (name, dflt) => {
    const i = args.indexOf(name);
    return i === -1 ? dflt : parseInt(args[i + 1], 10);
};

const USE_SHM = flag('--shm');
const WIDTH = value('--width', 640);
const HEIGHT = value('--height', 480);

const fourcc = id => String.fromCharCode(id & 0xff, (id >> 8) & 0xff, (id >> 16) & 0xff, (id >> 24) & 0xff);

// 75% colour bars, BT.601 (the values a broadcast generator puts out)
const BARS = [
    [180, 128, 128], // white
    [162, 44, 142],  // yellow
    [131, 156, 44],  // cyan
    [112, 72, 58],   // green
    [84, 184, 198],  // magenta
    [65, 100, 212],  // red
    [35, 212, 114],  // blue
    [16, 128, 128]   // black
];

// Write one frame of bars into `buf`, with a white sweep line at `phase`
// (0..1). Handles the two layouts every adaptor offers: packed YUY2-style
// (one plane, Y per pixel and U/V per pair) and planar I420/YV12-style
// (three planes, U/V at half resolution both ways).
function drawFrame(buf, base, plane, planar, uvSwapped, phase) {
    const { width, height, pitches, offsets } = plane;
    const sweep = Math.floor(phase * width);
    const sample = x => {
        if (x >= sweep && x < sweep + 8)
            return [235, 128, 128];
        return BARS[Math.min(BARS.length - 1, Math.floor(x * BARS.length / width))];
    };
    if (!planar) {
        for (let y = 0; y < height; y++) {
            const row = base + offsets[0] + y * pitches[0];
            for (let x = 0; x < width; x += 2) {
                const a = sample(x), b = sample(x + 1);
                buf[row + x * 2] = a[0];
                buf[row + x * 2 + 1] = (a[1] + b[1]) >> 1;
                buf[row + x * 2 + 2] = b[0];
                buf[row + x * 2 + 3] = (a[2] + b[2]) >> 1;
            }
        }
        return;
    }
    const uPlane = uvSwapped ? 2 : 1;
    const vPlane = uvSwapped ? 1 : 2;
    for (let y = 0; y < height; y++) {
        const row = base + offsets[0] + y * pitches[0];
        for (let x = 0; x < width; x++)
            buf[row + x] = sample(x)[0];
    }
    for (let y = 0; y < height >> 1; y++) {
        const uRow = base + offsets[uPlane] + y * pitches[uPlane];
        const vRow = base + offsets[vPlane] + y * pitches[vPlane];
        for (let x = 0; x < width >> 1; x++) {
            const s = sample(x * 2);
            buf[uRow + x] = s[1];
            buf[vRow + x] = s[2];
        }
    }
}

x11.createClient((err, display) => {
    if (err)
        throw err;
    const X = display.client;
    const screen = display.screen[0];
    X.on('error', e => console.error('X error:', e));

    X.require('xv', (err, Xv) => {
        if (err) {
            console.error('no XVideo extension on this server:', err.message);
            return X.terminate();
        }
        console.log(`X-Video Extension version ${Xv.major}.${Xv.minor}`);

        Xv.QueryAdaptors(screen.root, (err, adaptors) => {
            if (err)
                throw err;
            if (adaptors.length === 0) {
                console.log('no adaptors present - nothing can take a frame here.');
                console.log('(a client should fall back to core PutImage)');
                return X.terminate();
            }

            let chosen = null;
            for (const a of adaptors) {
                console.log(`adaptor "${a.name}": ports ${a.baseId}..${a.baseId + a.numPorts - 1}, type 0x${a.type.toString(16)}`);
                if (!chosen && (a.type & Xv.Type.ImageMask))
                    chosen = a;
            }
            if (!chosen) {
                console.log('no adaptor takes images from client memory (Type.ImageMask)');
                return X.terminate();
            }

            const port = chosen.baseId;
            Xv.ListImageFormats(port, (err, formats) => {
                if (err)
                    throw err;
                for (const f of formats)
                    console.log(`  format ${fourcc(f.id)} (0x${f.id.toString(16)}): ${f.bpp} bpp, ${f.numPlanes} plane(s), ${f.format === Xv.ImageFormatInfoFormat.Planar ? 'planar' : 'packed'} ${f.compOrder}`);

                // planar first: it is the point of Xv, half the bytes of packed
                const format = formats.find(f => fourcc(f.id) === 'I420') ||
                    formats.find(f => fourcc(f.id) === 'YV12') ||
                    formats.find(f => fourcc(f.id) === 'YUY2') ||
                    formats[0];
                const planar = format.format === Xv.ImageFormatInfoFormat.Planar;
                const uvSwapped = fourcc(format.id) === 'YV12';
                console.log(`using port ${port}, format ${fourcc(format.id)}`);

                Xv.QueryImageAttributes(port, format.id, WIDTH, HEIGHT, (err, plane) => {
                    if (err)
                        throw err;
                    console.log(`frame ${plane.width}x${plane.height}: ${plane.dataSize} bytes, pitches ${plane.pitches}, offsets ${plane.offsets}`);
                    console.log(`(core PutImage would be ${plane.width * plane.height * 4} bytes for the same frame)`);

                    const wid = X.AllocID();
                    X.CreateWindow(wid, screen.root, 0, 0, WIDTH, HEIGHT, 0, 0, 0, 0, {
                        backgroundPixel: screen.black_pixel,
                        eventMask: x11.eventMask.Exposure | x11.eventMask.StructureNotify
                    });
                    X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8, 'Xv test pattern');
                    X.MapWindow(wid);
                    const gc = X.AllocID();
                    X.CreateGC(gc, wid);

                    let frames = 0;
                    let bytes = 0;
                    let since = Date.now();
                    const stats = () => {
                        const dt = (Date.now() - since) / 1000;
                        if (dt < 1)
                            return;
                        console.log(`${(frames / dt).toFixed(1)} fps, ${(bytes / dt / (1 << 20)).toFixed(1)} MiB/s`);
                        frames = bytes = 0;
                        since = Date.now();
                    };

                    const geometry = () => ({
                        srcX: 0, srcY: 0, srcWidth: plane.width, srcHeight: plane.height,
                        drwX: 0, drwY: 0, drwWidth: WIDTH, drwHeight: HEIGHT,
                        width: plane.width, height: plane.height
                    });

                    const start = shmSegment => {
                        // two buffers when sending over the wire: the request
                        // queues `data` by reference, so the one in flight must
                        // not be touched. With SHM the ShmCompletion event says
                        // when the single segment is free again.
                        const buffers = shmSegment ? [shmSegment.buffer] :
                            [Buffer.alloc(plane.dataSize), Buffer.alloc(plane.dataSize)];
                        let n = 0;
                        const render = () => {
                            const buf = buffers[n % buffers.length];
                            drawFrame(buf, 0, plane, planar, uvSwapped, (n % 60) / 60);
                            n++;
                            frames++;
                            bytes += plane.dataSize;
                            if (shmSegment) {
                                shmSegment.commit(0);
                                Xv.ShmPutImage(port, wid, gc, shmSegment.shmseg, format.id,
                                    Object.assign({ offset: 0, sendEvent: true }, geometry()));
                            } else {
                                Xv.PutImage(port, wid, gc, format.id,
                                    Object.assign({ data: buf }, geometry()));
                                X.flush();
                            }
                            stats();
                        };
                        if (shmSegment) {
                            // one frame in flight at a time: the next goes out
                            // when the server is done reading the segment
                            shmSegment.on('complete', () => setImmediate(render));
                            render();
                        } else {
                            setInterval(render, 1000 / 60);
                        }
                    };

                    if (!USE_SHM)
                        return start(null);

                    X.require('shm', (err, Shm) => {
                        if (err) {
                            console.log('no MIT-SHM on this server, sending over the wire');
                            return start(null);
                        }
                        Shm.usable((err, ok) => {
                            if (!ok) {
                                console.log('no usable shared-memory provider, sending over the wire');
                                return start(null);
                            }
                            Shm.createSegment(plane.dataSize, (err, segment) => {
                                if (err) {
                                    console.log('createSegment failed, sending over the wire:', err.message);
                                    return start(null);
                                }
                                console.log(`using MIT-SHM segment ${segment.shmseg} (${segment.zeroCopy ? 'zero-copy' : 'copied'})`);
                                start(segment);
                            });
                        });
                    });
                });
            });
        });
    });
});
