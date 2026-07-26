// Builds the in-browser demo runtime bundle for the playground:
//   browser/index.js  →  static/demo/x11-demo-runtime.js  (IIFE, global X11Demo)
// If browser/glx/index.js exists it is folded in as X11Demo.glx (feature-
// detected at runtime by the runner) — the build succeeds either way.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const websiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(websiteDir, '..');
const shimsDir = path.join(websiteDir, 'scripts', 'browser-shims');
const outFile = path.join(websiteDir, 'static', 'demo', 'x11-demo-runtime.js');

const hasGlx = fs.existsSync(path.join(repoRoot, 'browser', 'glx', 'index.js'));

// Virtual entry so the glx add-on can be included conditionally without
// browser/index.js knowing about it.
function entrySource(withGlx) {
  return [
    "const runtime = require('./browser/index.js');",
    withGlx ? "runtime.glx = require('./browser/glx/index.js');" : '// no browser/glx yet',
    'module.exports = runtime;',
  ].join('\n');
}

async function build(withGlx) {
  await esbuild.build({
    stdin: {
      contents: entrySource(withGlx),
      resolveDir: repoRoot,
      sourcefile: 'x11-demo-entry.js',
      loader: 'js',
    },
    bundle: true,
    outfile: outFile,
    format: 'iife',
    globalName: 'X11Demo',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    logLevel: 'info',
    define: { 'process.env.NODE_ENV': '"production"' },
    // Buffer/process globals for the bundled node-style code:
    inject: [path.join(shimsDir, 'globals.js')],
    alias: {
      // real polyfills (installed as website devDependencies)
      buffer: require.resolve('buffer/'),
      events: require.resolve('events/'),
      process: require.resolve('process/browser'),
      // inert stubs for node builtins reached only on node-only code paths
      net: path.join(shimsDir, 'net.js'),
      fs: path.join(shimsDir, 'fs.js'),
      os: path.join(shimsDir, 'os.js'),
      path: path.join(shimsDir, 'path.js'),
    },
  });
}

let glxIncluded = false;
if (hasGlx) {
  try {
    await build(true);
    glxIncluded = true;
  } catch (err) {
    // a broken/in-progress browser/glx must never take the website down:
    // fall back to the core-only bundle (the runner feature-detects glx)
    console.warn('browser/glx failed to bundle, building core-only:', err.message);
    await build(false);
  }
} else {
  await build(false);
}

console.log(`built ${path.relative(websiteDir, outFile)} (glx: ${glxIncluded ? 'included' : 'absent'})`);
