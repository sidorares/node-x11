// DRI3 + Present without a GPU: the pixels are computed in JavaScript, but
// they still reach the X server as a dma-buf — CPU memory turned into one by
// the kernel's udmabuf device — so the presentation path is byte-for-byte the
// modern one (no PutImage, no MIT-SHM, no pixel copies over the socket).
//
//   memfd (plain RAM, mapped into JS as an ArrayBuffer)
//     -> /dev/udmabuf  ->  dma-buf fd  ->  DRI3 PixmapFromBuffer
//     -> Present.Pixmap, paced by CompleteNotify, double buffered
//
// This is the same trick Xwayland itself uses to run GPU-less while speaking
// a dma-buf protocol. It needs: /dev/udmabuf accessible, and a server whose
// driver can import CPU dma-bufs (Xorg+glamor and Xwayland on real hardware
// can; a virtualized GPU usually refuses, which this example reports and
// exits — the GPU variant cube.js in this folder is the main show).
//
// The 3D content is an old-school wireframe cube, rasterized by hand.

const x11 = require('x11');

let dri;
try {
    dri = require('x11-dri');
} catch (e) {
    console.error('The native companion is not installed. Run `npm install` in this folder.');
    console.error('(x11-dri: https://github.com/sidorares/node-x11-dri — builds anywhere with a C toolchain)');
    console.error(`(${e.message})`);
    process.exit(1);
}

const W = 480;
const H = 360;

x11.createClient((err, display) => {
    if (err) throw err;
    const X = display.client;
    const screen = display.screen[0];
    const depth = screen.root_depth;

    X.require('dri3', (err, DRI3) => {
        if (err) {
            console.error('DRI3 not available:', err.message);
            return X.terminate();
        }
        X.require('present', (err, Present) => {
            if (err) throw err;
            start(X, screen, depth, DRI3, Present);
        });
    });
}).on('error', err => {
    console.error('X connection:', err.message || err);
    process.exit(0);
});

function start(X, screen, depth, DRI3, Present) {
    // two CPU dma-bufs, presented in alternation
    let bufs;
    try {
        bufs = [0, 1].map(() => {
            const b = dri.createUdmabuf(W * H * 4);
            b.px = new Uint32Array(b.buffer);
            b.busy = false;
            return b;
        });
    } catch (e) {
        console.error('no udmabuf:', e.message);
        console.error('(needs /dev/udmabuf; modprobe udmabuf, and rw access)');
        return X.terminate();
    }

    const wid = X.AllocID();
    const eid = X.AllocID();
    X.CreateWindow(wid, screen.root, 0, 0, W, H, 0, depth, 1, 0, {
        backgroundPixel: screen.black_pixel,
        eventMask: x11.eventMask.StructureNotify | x11.eventMask.KeyPress
    });
    X.ChangeProperty(0, wid, X.atoms.WM_NAME, X.atoms.STRING, 8,
        Buffer.from('DRI3 software cube - node-x11', 'latin1'));
    X.MapWindow(wid);
    Present.SelectInput(eid, wid,
        Present.EventMask.CompleteNotify | Present.EventMask.IdleNotify);

    // wrap each dma-buf in a pixmap; the first import tells us whether this
    // server can take CPU dma-bufs at all
    let imported = 0;
    bufs.forEach(b => {
        b.pixmap = X.AllocID();
        // the fd is consumed by the send; pixels keep flowing through the
        // memfd mapping (b.px), which aliases the same pages
        DRI3.PixmapFromBuffer(b.pixmap, wid, {
            fd: b.fd, width: W, height: H, stride: W * 4, depth, bpp: 32
        }, impErr => {
            if (closing)
                return;
            if (impErr) {
                console.error('this server/driver cannot import CPU dma-bufs:', impErr.message);
                console.error('(typical on virtualized GPUs; on real hardware Xorg+glamor and');
                console.error(' Xwayland accept them. See cube.js in this folder for the');
                console.error(' GPU path, or examples/* MIT-SHM demos for the classic one.)');
                return shutdown(1);
            }
            b.imported = true;
            if (++imported === bufs.length)
                renderFrame(0); // both pixmaps live: go
        });
    });

    // --- hand-rolled 3D: project cube edges, Bresenham them into the buffer
    const corners = [];
    for (let i = 0; i < 8; i++)
        corners.push([(i & 1) * 2 - 1, ((i >> 1) & 1) * 2 - 1, ((i >> 2) & 1) * 2 - 1]);
    const edges = [];
    for (let a = 0; a < 8; a++)
        for (let b = a + 1; b < 8; b++) {
            const d = (a ^ b);
            if (d === 1 || d === 2 || d === 4) edges.push([a, b]);
        }

    function line(px, x0, y0, x1, y1, color) {
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let e = dx + dy;
        for (;;) {
            if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) {
                px[y0 * W + x0] = color;
                if (x0 + 1 < W) px[y0 * W + x0 + 1] = color; // chunky 2px lines
            }
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * e;
            if (e2 >= dy) { e += dy; x0 += sx; }
            if (e2 <= dx) { e += dx; y0 += sy; }
        }
    }

    const t0 = Date.now();
    function paint(px) {
        const t = (Date.now() - t0) / 1000;
        // background: vertical fade
        for (let y = 0; y < H; y++) {
            const shade = 0xff000000 + ((16 + y * 24 / H) << 16 | (16 + y * 16 / H) << 8 | (28 + y * 40 / H)) >>> 0;
            px.fill(shade, y * W, (y + 1) * W);
        }
        // spin, project, draw
        const cx = Math.cos(t * 0.9), sx = Math.sin(t * 0.9);
        const cy = Math.cos(t * 1.3), sy = Math.sin(t * 1.3);
        const pts = corners.map(([x, y, z]) => {
            const X1 = x * cy - z * sy, Z1 = x * sy + z * cy;
            const Y1 = y * cx - Z1 * sx, Z2 = y * sx + Z1 * cx;
            const s = 160 / (Z2 + 4);
            return [W / 2 + X1 * s * 1.4, H / 2 + Y1 * s];
        });
        edges.forEach(([a, b], i) => {
            const hue = [0xffe74c3c, 0xff2ecc71, 0xff3498db, 0xfff1c40f][i & 3];
            line(px, pts[a][0], pts[a][1], pts[b][0], pts[b][1], hue);
        });
    }

    // --- present loop --------------------------------------------------------
    let serial = 0;
    let frames = 0;
    let statT = Date.now();
    let stalled = false;
    let closing = false;

    function renderFrame(targetMsc) {
        if (closing) return;
        const b = bufs.find(x => !x.busy);
        if (!b) { stalled = true; return; } // resumed on IdleNotify
        b.sync(dri.DMABUF_SYNC.START | dri.DMABUF_SYNC.WRITE);
        paint(b.px);
        b.sync(dri.DMABUF_SYNC.END | dri.DMABUF_SYNC.WRITE);
        b.busy = true;
        serial = (serial + 1) >>> 0;
        Present.Pixmap(wid, b.pixmap, { serial, targetMsc: targetMsc || 0 });
        X.flush();
    }

    X.on('event', ev => {
        switch (ev.name) {
        case 'PresentCompleteNotify':
            if (ev.kind === Present.CompleteKind.Pixmap) {
                frames++;
                const now = Date.now();
                if (now - statT >= 2000) {
                    console.log(`${(frames * 1000 / (now - statT)).toFixed(1)} fps (msc ${ev.msc})`);
                    frames = 0;
                    statT = now;
                }
                renderFrame(ev.msc + 1);
            }
            break;
        case 'PresentIdleNotify': {
            const b = bufs.find(x => x.pixmap === ev.pixmap);
            if (b) b.busy = false;
            if (stalled) { stalled = false; renderFrame(0); }
            break;
        }
        case 'KeyPress':
            if (ev.keycode === 9 || ev.keycode === 24) shutdown(0); // Esc, q
            break;
        case 'DestroyNotify':
            if (ev.wid === wid) shutdown(0);
            break;
        }
    });

    function shutdown(code) {
        if (closing) return;
        closing = true;
        bufs.forEach(b => {
            if (b.imported) X.FreePixmap(b.pixmap);
            b.close();
        });
        X.DestroyWindow(wid);
        X.terminate();
        process.exitCode = code;
    }
    process.on('SIGINT', () => shutdown(0));

    console.log('software 3D via udmabuf -> DRI3 -> Present; q or Esc to quit');
    // rendering starts once both imports are confirmed (see above)
}
