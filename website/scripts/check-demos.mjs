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

// The server's built-in font covers ASCII 0-127 and nothing else, so a stray
// em-dash or "×" in a drawn string comes out as a filled box. A checksum
// cannot see that, so every text request is inspected as it is made.
//
// This has to happen at call time rather than by reading the source: demos
// route text through their own label() helpers and build strings by
// concatenation, and a scan of the literal `ImageText8(...)` span misses both.
const TEXT_REQUESTS = ['ImageText8', 'ImageText16', 'PolyText8', 'PolyText16'];

function watchDrawnText(X, problems) {
  for (const name of TEXT_REQUESTS) {
    const original = X[name];
    if (typeof original !== 'function') continue;
    X[name] = function (...args) {
      for (const arg of args) {
        const strings =
          typeof arg === 'string' ? [arg]
            : Array.isArray(arg) ? arg.filter(a => typeof a === 'string')
              : [];
        for (const s of strings) {
          const bad = s.match(/[^\x00-\x7F]/);
          if (bad)
            problems.push(new Error(
              `${name} would draw non-ASCII ${JSON.stringify(bad[0])} as a filled box, in ${JSON.stringify(s)}`));
        }
      }
      return original.apply(this, args);
    };
  }
}

// x11 as the demo sees it, except that every client it opens has its text
// requests watched. A demo may connect more than once (the window manager
// does), so this wraps createClient rather than a single client.
function watchedX11(problems) {
  return new Proxy(x11, {
    get(target, prop) {
      if (prop !== 'createClient') return target[prop];
      return (...args) => {
        const last = args.length - 1;
        if (typeof args[last] === 'function') {
          const cb = args[last];
          args[last] = (err, display) => {
            if (display && display.client) watchDrawnText(display.client, problems);
            return cb(err, display);
          };
        }
        return target.createClient(...args);
      };
    },
  });
}

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
  'raster-ops'(server) {
    // drag out a rubber band, then release to commit it
    server.injectPointerMove(120, 140);
    server.injectButton(1, true);
    for (let i = 1; i <= 12; i++)
      server.injectPointerMove(120 + i * 20, 140 + i * 12);
    server.injectButton(1, false);
  },
  'window-manager'(server) {
    // grab a frame by its title bar and move it
    server.injectPointerMove(120, 78);
    server.injectButton(1, true);
    for (let i = 1; i <= 8; i++)
      server.injectPointerMove(120 + i * 10, 78 + i * 6);
    server.injectButton(1, false);
  },
};

// Demos whose whole point is that injected input changes the picture: a
// green run that never moved a pixel here would mean the handler silently
// stopped being wired up.
const mustReactToInput = new Set([
  'pointer-paint', 'keyboard', 'raster-ops', 'window-manager',
]);

// Demos driven by a timer rather than by input.
const mustAnimate = new Set(['bouncing-ball', 'copy-area', 'render-transform', 'clip-rects']);

async function runDemo(demo) {
  const server = new XServer({
    width: demo.screenWidth || 640,
    height: demo.screenHeight || 480,
  });
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
  const watched = watchedX11(problems);
  const demoRequire = name => {
    if (name === 'x11') return watched;
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
    if (mustReactToInput.has(demo.id) && after === afterSetup)
      problems.push(new Error('injected input changed nothing on screen'));
    if (demo.id === 'event-log' && logCount === 0)
      problems.push(new Error('no events were logged'));
    if (mustAnimate.has(demo.id)) {
      const mid = checksum(server);
      await sleep(150);
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
