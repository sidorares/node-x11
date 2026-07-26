// Injected first into the demo bundle (esbuild `inject`): provides the
// Buffer and process globals that the node-x11 client/server code expects.
// They are installed on globalThis (not bundle-scoped) on purpose so the
// runner page can tweak process.env.DISPLAY before demo code runs.
const { Buffer } = require('buffer');
const process = require('process'); // aliased to process/browser by the build

if (!globalThis.Buffer)
    globalThis.Buffer = Buffer;
if (!globalThis.process)
    globalThis.process = process;
if (!globalThis.process.env)
    globalThis.process.env = {};
// browsers have no setImmediate; stream pairs and the client's cached-atom
// fast path rely on it for async delivery
if (typeof globalThis.setImmediate !== 'function')
    globalThis.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
