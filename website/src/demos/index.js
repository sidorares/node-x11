import helloWindow from './hello-window.js';
import gradientRects from './gradient-rects.js';
import text from './text.js';
import shapes from './shapes.js';
import clipRects from './clip-rects.js';
import copyArea from './copy-area.js';
import pointerPaint from './pointer-paint.js';
import rasterOps from './raster-ops.js';
import eventLog from './event-log.js';
import bouncingBall from './bouncing-ball.js';
import keyboard from './keyboard.js';
import renderOperators from './render-operators.js';
import renderGradients from './render-gradients.js';
import renderTransform from './render-transform.js';
import windowManager from './window-manager.js';
import glxTriangle from './glx-triangle.js';
import glxCube from './glx-cube.js';
import guideCreateWindow from './guide-create-window.js';
import guideGc from './guide-gc.js';
import guideExtension from './guide-extension.js';

// Every demo, in the order the playground picker shows them. Each entry:
// { id, title, description, code } plus optional screenWidth/screenHeight/
// height, `playground: false` to keep it out of the picker, and
// `requiresWebGL: true` for the GLX ones that scripts/check-demos.mjs skips.
//
// Guide-scoped entries are here rather than inline in the .mdx so that
// scripts/check-demos.mjs runs them too — a snippet in the prose is exactly
// the kind that rots silently otherwise.
const all = [
  // core protocol
  helloWindow,
  gradientRects,
  text,
  shapes,
  clipRects,
  copyArea,
  // input
  pointerPaint,
  rasterOps,
  eventLog,
  bouncingBall,
  keyboard,
  // RENDER
  renderOperators,
  renderGradients,
  renderTransform,
  // putting it together
  windowManager,
  // GLX
  glxTriangle,
  glxCube,
  // guide-scoped, not in the picker
  guideCreateWindow,
  guideGc,
  guideExtension,
];

export const byId = Object.fromEntries(all.map((d) => [d.id, d]));

const demos = all.filter((d) => d.playground !== false);

export default demos;
