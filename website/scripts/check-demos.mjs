// Correctness gate for the playground demos: runs every demo string from
// website/src/demos against the real JS X server (lib/xserver) in node,
// exactly the way the browser runner does (require shim + DISPLAY protocol),
// injects input where relevant, and asserts nothing threw and pixels changed.
//
//   node scripts/check-demos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const websiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(websiteDir, '..');
const demosDir = path.join(websiteDir, 'src', 'demos');

const x11 = require(path.join(repoRoot, 'lib'));
const { XServer, createStreamPair } = require(path.join(repoRoot, 'lib', 'xserver'));

// same wiring as static/demo/runner.html
process.env.DISPLAY = 'demo/local:0';

let current = null; // { server, streams }
x11.registerDisplayProtocol('demo', () => {
  if (!current) throw new Error('no demo server running');
  const [clientSide, serverSide] = createStreamPair();
  current.server.addClientStream(serverSide);
  current.streams.push(clientSide);
  return clientSide;
});

// Demo modules are browser ESM ({ export default {...} }, no imports);
// evaluate them in node with a one-line transform.
function loadDemo(file) {
  const src = fs.readFileSync(file, 'utf8');
  return new Function(`${src.replace(/^export default/m, 'return')}`)();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function checksum(server) {
  server.compose();
  const data = server.root.raster.data;
  let sum = 0;
  for (let i = 0; i < data.length; i++)
    sum = (sum * 31 + data[i]) >>> 0;
  return sum;
}

// per-demo input exercise, mirroring what a user would do in the browser
const exercises = {
  'pointer-paint'(server) {
    server.injectPointerMove(200, 200);
    server.injectButton(1, true);
    for (let i = 0; i <= 10; i++)
      server.injectPointerMove(200 + i * 8, 200 + i * 4);
    server.injectButton(1, false);
  },
  keyboard(server) {
    server.injectPointerMove(120, 120); // focus follows the pointer window
    for (const ch of [0x68, 0x65, 0x79]) { // 'h' 'e' 'y'
      const keycode = server.keymap.keycodeForKeysym(ch);
      server.injectKey(keycode, true);
      server.injectKey(keycode, false);
    }
  },
  'event-log'(server) {
    server.injectPointerMove(60, 60);
    server.injectButton(1, true);
    server.injectButton(1, false);
  },
};

async function runDemo(demo) {
  const server = new XServer({ width: 640, height: 480 });
  current = { server, streams: [] };
  const problems = [];
  const timers = { intervals: [], timeouts: [] };
  let logCount = 0;

  const demoConsole = {
    log: () => { logCount++; },
    info: () => { logCount++; },
    warn: () => {},
    error: (...args) => problems.push(new Error(`console.error: ${args.join(' ')}`)),
  };
  const trackInterval = (fn, ms) => { const id = setInterval(fn, ms); timers.intervals.push(id); return id; };
  const trackTimeout = (fn, ms) => { const id = setTimeout(fn, ms); timers.timeouts.push(id); return id; };
  const demoRequire = name => {
    if (name === 'x11') return x11;
    throw new Error(`module not available in the playground: ${name}`);
  };
  const onUncaught = err => problems.push(err);
  process.on('uncaughtException', onUncaught);

  const before = checksum(server);
  try {
    const fn = new Function(
      'require', 'process', 'console',
      'setInterval', 'setTimeout', 'clearInterval', 'clearTimeout',
      demo.code);
    fn(demoRequire, process, demoConsole,
      trackInterval, trackTimeout, clearInterval, clearTimeout);
    await sleep(400); // handshake, map, Expose drawing
    const afterSetup = checksum(server);
    if (exercises[demo.id]) {
      exercises[demo.id](server);
      await sleep(300);
    }
    const after = checksum(server);

    if (after === before && afterSetup === before)
      problems.push(new Error('no pixels changed on the server raster'));
    if (demo.id === 'pointer-paint' && after === afterSetup)
      problems.push(new Error('painting via injected pointer input changed nothing'));
    if (demo.id === 'keyboard' && after === afterSetup)
      problems.push(new Error('typing via injected key input changed nothing'));
    if (demo.id === 'event-log' && logCount === 0)
      problems.push(new Error('no events were logged'));
    if (demo.id === 'bouncing-ball') {
      const mid = checksum(server);
      await sleep(120);
      if (checksum(server) === mid)
        problems.push(new Error('animation is not animating'));
    }
  } catch (err) {
    problems.push(err);
  } finally {
    timers.intervals.forEach(clearInterval);
    timers.timeouts.forEach(clearTimeout);
    current.streams.forEach(s => { try { s.destroy(); } catch { /* gone */ } });
    current = null;
    await sleep(50); // let in-flight callbacks drain while still monitored
    process.removeListener('uncaughtException', onUncaught);
  }
  return problems;
}

const files = fs.readdirSync(demosDir)
  .filter(f => f.endsWith('.js') && f !== 'index.js')
  .sort();
if (files.length === 0) {
  console.error('no demos found in', demosDir);
  process.exit(1);
}

let failed = 0;
let skipped = 0;
for (const file of files) {
  const demo = loadDemo(path.join(demosDir, file));
  if (demo.requiresWebGL) {
    // GLX demos need a real WebGL context; the headless-browser pass
    // (playwright over the built site) covers them instead
    console.log(`skip ${demo.id} (WebGL)`);
    skipped++;
    continue;
  }
  const problems = await runDemo(demo);
  if (problems.length === 0) {
    console.log(`ok   ${demo.id}`);
  } else {
    failed++;
    console.error(`FAIL ${demo.id}`);
    for (const p of problems)
      console.error(`     ${p && p.stack ? p.stack.split('\n')[0] : p}`);
  }
}

console.log(failed === 0 ? `all ${files.length - skipped} demos green (${skipped} WebGL-only skipped)` : `${failed} demo(s) failed`);
process.exit(failed === 0 ? 0 : 1);
