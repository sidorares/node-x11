// Sanity gate for the built demo runtime: evaluates the IIFE bundle in a
// bare vm context (no DOM at all — the bundle must not touch `document` at
// load time) and asserts the X11Demo global has the full public surface.
//
//   node scripts/build-demo-bundles.mjs && node scripts/check-bundle.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const websiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(websiteDir, 'static', 'demo', 'x11-demo-runtime.js');

if (!fs.existsSync(bundle)) {
  console.error('bundle missing — run: node scripts/build-demo-bundles.mjs');
  process.exit(1);
}

// deliberately minimal: no document, no window — load must not need them
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(bundle, 'utf8'), context, { filename: 'x11-demo-runtime.js' });

const g = context.X11Demo;
assert.ok(g, 'X11Demo global is defined');
assert.strictEqual(typeof g.x11.createClient, 'function', 'x11.createClient');
assert.strictEqual(typeof g.x11.registerDisplayProtocol, 'function', 'x11.registerDisplayProtocol');
assert.strictEqual(typeof g.XServer, 'function', 'XServer');
assert.strictEqual(typeof g.createStreamPair, 'function', 'createStreamPair');
assert.strictEqual(typeof g.CanvasPresenter, 'function', 'CanvasPresenter');
assert.strictEqual(typeof g.MessagePortStream, 'function', 'MessagePortStream');
assert.strictEqual(typeof g.bootDemoServer, 'function', 'bootDemoServer');
assert.ok(context.Buffer, 'Buffer global installed by the bundle');
assert.ok(context.process && context.process.env, 'process global installed by the bundle');

// the server itself must boot DOM-free (only the presenter needs a canvas)
const server = new g.XServer({ width: 64, height: 48 });
assert.strictEqual(server.width, 64);
assert.ok(server.root && server.root.raster && server.root.raster.data.length === 64 * 48);

console.log(`bundle ok (${(fs.statSync(bundle).size / 1024).toFixed(0)} KB)` +
  (g.glx ? ', glx included' : ', glx absent'));
