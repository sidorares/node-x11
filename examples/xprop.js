// xprop(1) in JavaScript: dump a window's properties, decoded.
//
//   node examples/xprop.js               # the root window
//   node examples/xprop.js 0x400001      # a window, hex or decimal
//   node examples/xprop.js --tree        # every window in the tree, briefly
//
// This exists because "I set the property and nothing happened" is the most
// common X question there is, and the answer is almost always visible in the
// bytes. Struct-shaped properties are printed field by field, including the
// flags word — a WM_NORMAL_HINTS with flags = 0 is a legal property that
// declares nothing, and it looks identical to a correct one until you decode
// it.
//
// The footer prints the root window's _NET_WORKAREA against the screen size:
// that is the window manager's answer to a _NET_WM_STRUT, and checking it is
// the difference between "my strut was ignored" and "my strut worked and my
// layout is wrong".

const x11 = require('../lib');

// ICCCM 4.1.2.3 WM_SIZE_HINTS: 18 CARD32s, flags first.
const SIZE_HINT_FLAGS = [
    [0x001, 'USPosition'], [0x002, 'USSize'], [0x004, 'PPosition'],
    [0x008, 'PSize'], [0x010, 'PMinSize'], [0x020, 'PMaxSize'],
    [0x040, 'PResizeInc'], [0x080, 'PAspect'], [0x100, 'PBaseSize'],
    [0x200, 'PWinGravity']
];

// ICCCM 4.1.2.4 WM_HINTS: 9 CARD32s, flags first.
const WM_HINT_FLAGS = [
    [0x001, 'InputHint'], [0x002, 'StateHint'], [0x004, 'IconPixmapHint'],
    [0x008, 'IconWindowHint'], [0x010, 'IconPositionHint'],
    [0x020, 'IconMaskHint'], [0x040, 'WindowGroupHint'],
    [0x080, 'MessageHint'], [0x100, 'UrgencyHint']
];

const WM_STATES = ['WithdrawnState', 'NormalState', '(2)', 'IconicState'];

// Properties that are a plain CARDINAL array on the wire but have named
// fields in the spec. EWMH 5.9/5.10 for the struts, 5.14 for frame extents.
const NAMED_FIELDS = {
    _NET_WM_STRUT: ['left', 'right', 'top', 'bottom'],
    _NET_WM_STRUT_PARTIAL: [
        'left', 'right', 'top', 'bottom',
        'left_start_y', 'left_end_y', 'right_start_y', 'right_end_y',
        'top_start_x', 'top_end_x', 'bottom_start_x', 'bottom_end_x'
    ],
    _NET_FRAME_EXTENTS: ['left', 'right', 'top', 'bottom'],
    _NET_DESKTOP_GEOMETRY: ['width', 'height']
};

function words(data) {
    const out = [];
    for (let i = 0; i + 4 <= data.length; i += 4)
        out.push(data.readUInt32LE(i));
    return out;
}

function hex(n) {
    return `0x${(n >>> 0).toString(16)}`;
}

function decodeFlags(flags, table) {
    const set = table.filter(([bit]) => flags & bit).map(([, name]) => name);
    if (!set.length)
        return `${flags} (none set — this property declares nothing)`;
    return `${hex(flags)} (${set.join(' | ')})`;
}

function sizeHints(data) {
    const v = words(data);
    if (v.length < 18)
        return `malformed: ${v.length} words, expected 18`;
    const lines = [`flags = ${decodeFlags(v[0], SIZE_HINT_FLAGS)}`];
    // Only report what the flags claim; that is what a window manager reads.
    if (v[0] & 0x005) lines.push(`position ${v[1]}, ${v[2]} (obsolete fields)`);
    if (v[0] & 0x00a) lines.push(`size ${v[3]} by ${v[4]} (obsolete fields)`);
    if (v[0] & 0x010) lines.push(`minimum size ${v[5]} by ${v[6]}`);
    if (v[0] & 0x020) lines.push(`maximum size ${v[7]} by ${v[8]}`);
    if (v[0] & 0x040) lines.push(`resize increment ${v[9]} by ${v[10]}`);
    if (v[0] & 0x080) lines.push(`aspect ratio ${v[11]}/${v[12]} to ${v[13]}/${v[14]}`);
    if (v[0] & 0x100) lines.push(`base size ${v[15]} by ${v[16]}`);
    if (v[0] & 0x200) lines.push(`window gravity ${v[17]}`);
    return lines.join('\n\t\t');
}

function wmHints(data) {
    const v = words(data);
    if (v.length < 9)
        return `malformed: ${v.length} words, expected 9`;
    const lines = [`flags = ${decodeFlags(v[0], WM_HINT_FLAGS)}`];
    if (v[0] & 0x001) lines.push(`client accepts input: ${v[1] ? 'True' : 'False'}`);
    if (v[0] & 0x002) lines.push(`initial state: ${WM_STATES[v[2]] || v[2]}`);
    if (v[0] & 0x004) lines.push(`icon pixmap: ${hex(v[3])}`);
    if (v[0] & 0x008) lines.push(`icon window: ${hex(v[4])}`);
    if (v[0] & 0x010) lines.push(`icon position: ${v[5]}, ${v[6]}`);
    if (v[0] & 0x020) lines.push(`icon mask: ${hex(v[7])}`);
    if (v[0] & 0x040) lines.push(`window group: ${hex(v[8])}`);
    if (v[0] & 0x100) lines.push('urgency: set');
    return lines.join('\n\t\t');
}

function strings(data) {
    return data.toString('latin1').split('\0')
        .filter((s, i, a) => s.length || i < a.length - 1)
        .map(s => `"${s}"`).join(', ');
}

x11.createClient((err, display) => {
    if (err)
        throw err;
    const X = display.client;
    const screen = display.screen[0];

    const atomName = atom => new Promise(resolve => {
        if (!atom)
            return resolve('None');
        X.GetAtomName(atom, (err, name) => resolve(err ? `<atom ${atom}>` : name));
    });

    const getProperty = (wid, atom, longLength = 1024) => new Promise((resolve, reject) => {
        // type 0 = AnyPropertyType
        X.GetProperty(0, wid, atom, 0, 0, longLength, (err, prop) => err ? reject(err) : resolve(prop));
    });

    async function decode(propName, typeName, prop) {
        const { data, format } = prop;
        if (!data.length)
            return '<empty>';

        if (typeName === 'WM_SIZE_HINTS')
            return sizeHints(data);
        if (typeName === 'WM_HINTS')
            return wmHints(data);
        if (typeName === 'STRING' || typeName === 'UTF8_STRING' || typeName === 'COMPOUND_TEXT')
            return typeName === 'UTF8_STRING' ? `"${data.toString('utf8').replace(/\0+$/, '')}"` : strings(data);

        if (format === 8)
            return `${data.length} bytes: ${data.slice(0, 32).toString('hex')}${data.length > 32 ? '…' : ''}`;
        if (format === 16) {
            const out = [];
            for (let i = 0; i + 2 <= data.length; i += 2)
                out.push(data.readUInt16LE(i));
            return out.join(', ');
        }

        const v = words(data);
        if (typeName === 'ATOM')
            return (await Promise.all(v.map(atomName))).join(', ');
        if (typeName === 'WINDOW' || typeName === 'PIXMAP' || typeName === 'CURSOR' || typeName === 'COLORMAP')
            return v.map(hex).join(', ');

        const names = NAMED_FIELDS[propName];
        if (names && v.length === names.length)
            return names.map((n, i) => `${n}=${v[i]}`).join(', ');
        if (propName === '_NET_WORKAREA' && v.length % 4 === 0) {
            const out = [];
            for (let i = 0; i < v.length; i += 4)
                out.push(`desktop ${i / 4}: ${v[i + 2]}x${v[i + 3]} at ${v[i]},${v[i + 1]}`);
            return out.join('\n\t\t');
        }
        return v.join(', ');
    }

    async function dump(wid) {
        const props = await new Promise((resolve, reject) => {
            X.ListProperties(wid, (err, atoms) => err ? reject(err) : resolve(atoms));
        });
        console.log(`--- properties of ${hex(wid)} (${props.length}) ---`);
        for (const atom of props) {
            const [propName, prop] = await Promise.all([atomName(atom), getProperty(wid, atom)]);
            const typeName = await atomName(prop.type);
            const value = await decode(propName, typeName, prop);
            const more = prop.bytesAfter ? `  [+${prop.bytesAfter} bytes not read]` : '';
            console.log(`${propName}(${typeName}/${prop.format}) = ${value}${more}`);
        }
    }

    // The window manager's answer to _NET_WM_STRUT lives here, not on your
    // own window: if the workarea did not shrink, the strut had no effect.
    async function workarea() {
        const atom = await new Promise(resolve =>
            X.InternAtom(true, '_NET_WORKAREA', (err, a) => resolve(err ? 0 : a)));
        console.log(`\n--- screen 0: ${screen.pixel_width}x${screen.pixel_height} ---`);
        if (!atom)
            return console.log('_NET_WORKAREA is not set (no EWMH window manager running?)');
        const v = words((await getProperty(screen.root, atom)).data);
        if (!v.length)
            return console.log('_NET_WORKAREA is empty');
        for (let i = 0; i < v.length; i += 4) {
            const reserved = [
                v[i] ? `${v[i]} left` : null,
                v[i + 1] ? `${v[i + 1]} top` : null,
                screen.pixel_width - v[i] - v[i + 2] ? `${screen.pixel_width - v[i] - v[i + 2]} right` : null,
                screen.pixel_height - v[i + 1] - v[i + 3] ? `${screen.pixel_height - v[i + 1] - v[i + 3]} bottom` : null
            ].filter(Boolean);
            console.log(`_NET_WORKAREA desktop ${i / 4}: ${v[i + 2]}x${v[i + 3]} at ${v[i]},${v[i + 1]}` +
                (reserved.length ? `  (reserved: ${reserved.join(', ')})` : '  (nothing reserved)'));
        }
    }

    async function tree(wid, depth = 0) {
        const t = await new Promise((resolve, reject) => {
            X.QueryTree(wid, (err, res) => err ? reject(err) : resolve(res));
        });
        for (const child of t.children) {
            const props = await new Promise(resolve =>
                X.ListProperties(child, (err, atoms) => resolve(err ? [] : atoms)));
            const names = await Promise.all(props.slice(0, 6).map(atomName));
            console.log(`${'  '.repeat(depth)}${hex(child)}  ${names.join(' ') || '(no properties)'}`);
            await tree(child, depth + 1);
        }
    }

    const arg = process.argv[2];
    const run = async () => {
        if (arg === '--tree') {
            console.log(`--- window tree under root ${hex(screen.root)} ---`);
            await tree(screen.root);
        } else {
            await dump(arg ? Number(arg) : screen.root);
        }
        await workarea();
    };

    run().then(() => X.terminate(), e => {
        console.error(e.message || e);
        X.terminate();
        process.exitCode = 1;
    });
});
