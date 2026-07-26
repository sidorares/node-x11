// GLX indirect-rendering emulator for the JS X server: protocol extension,
// render-command decoder and GL backends (WebGL for the browser, recording
// for headless tests). See glx-extension.js for the integration contracts.

const { createGlxExtension } = require('./glx-extension');
const { WebGLBackend, RecordingBackend, BACKEND_METHODS } = require('./gl-backend');
const { RenderDecoder } = require('./render-decoder');
const matrix = require('./matrix');

module.exports = {
    createGlxExtension,
    WebGLBackend,
    RecordingBackend,
    BACKEND_METHODS,
    RenderDecoder,
    matrix
};
