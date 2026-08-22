// Every extension event parser must stamp `event.type` with the wire event
// type it was registered under. Consumers route by type (that is the only
// field that identifies the event once firstEvent is known), so a parser
// that reports only `name` is invisible to a type-keyed dispatcher.
//
// Hermetic: the client is stubbed, so this needs no X server.


const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FIRST_EVENT = 64;
const MAJOR = 130;

// Extensions whose events are GenericEvents (no classic 32-byte event, so no
// eventParsers entry) or which need a live reply before registering are not
// exercised here; the loop below simply finds no parsers for them.
function loadParsers(file) {
    const mod = require(path.join('..', 'lib', 'ext', file));
    const eventParsers = {};
    const X = {
        seq_num: 0,
        replies: {},
        eventParsers,
        geEventParsers: {},
        pack_stream: { put: () => {}, submit: () => {} },
        QueryExtension: (name, cb) => cb(null, {
            present: true,
            majorOpcode: MAJOR,
            firstEvent: FIRST_EVENT,
            firstError: 128
        })
    };
    const display = { client: X, screen: [{ root: 1, depths: {} }] };
    try {
        mod.requireExt(display, () => {});
    } catch (e) {
        // an extension that insists on a real reply before it can finish;
        // whatever it managed to register is still checked below
    }
    return eventParsers;
}

describe('extension event parsers', () => {
    const files = fs.readdirSync(path.join(__dirname, '..', 'lib', 'ext'))
        .filter(f => f.endsWith('.js'));

    for (const file of files) {
        const parsers = loadParsers(file);
        const types = Object.keys(parsers).map(Number);
        if (types.length === 0)
            continue;

        for (const type of types) {
            it(`${file}: parser for event ${type} sets event.type`, () => {
                const raw = Buffer.alloc(64);
                const ev = parsers[type](type, 7, 0, 0, raw);
                assert.strictEqual(ev.type, type,
                    `${file} event ${type} reported type ${ev.type}`);
            });
        }
    }
});
