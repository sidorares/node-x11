'use strict';

// Browser bundle entry: everything needed to run node-x11 demos fully
// in-page — the protocol client, the JS X server, the canvas presenter
// and the MessagePort transport. Bundled (esbuild) into the website as
// the global `X11Demo`; see website/scripts/build-demo-bundles.mjs.

const x11 = require('../lib');
const { XServer, createStreamPair } = require('../lib/xserver');
const { CanvasPresenter } = require('./compositor');
const { MessagePortStream } = require('./messageport-stream');
const { keyboardEventToKeysym } = require('./domkeys');

// One-call demo setup: boots an in-page X server presented on `canvas`.
// Returns { server, presenter, connect } where each connect() call yields a
// fresh duplex stream usable as `x11.createClient({ stream })` (or from a
// registered display protocol).
function bootDemoServer(canvas, options) {
    options = options || {};
    const server = new XServer({
        width: options.width || 640,
        height: options.height || 480
    });
    const presenter = new CanvasPresenter(server, canvas);
    const connect = () => {
        const [clientSide, serverSide] = createStreamPair();
        server.addClientStream(serverSide);
        return clientSide;
    };
    return { server, presenter, connect };
}

module.exports = {
    x11,
    XServer,
    createStreamPair,
    CanvasPresenter,
    MessagePortStream,
    keyboardEventToKeysym,
    bootDemoServer
};
