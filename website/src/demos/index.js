import helloWindow from './hello-window.js';
import gradientRects from './gradient-rects.js';
import text from './text.js';
import pointerPaint from './pointer-paint.js';
import eventLog from './event-log.js';
import bouncingBall from './bouncing-ball.js';
import keyboard from './keyboard.js';
import glxTriangle from './glx-triangle.js';
import glxCube from './glx-cube.js';

// Ordered list shown in the playground picker. Each entry:
// { id, title, description, code } (+ optional screenWidth/screenHeight).
const demos = [
  helloWindow,
  gradientRects,
  text,
  pointerPaint,
  eventLog,
  bouncingBall,
  keyboard,
  glxTriangle,
  glxCube,
];

export default demos;
