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
