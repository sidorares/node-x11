// Shared helper for the JS X server suites: boots an in-process XServer and
// connects the repo's own client over a stream pair (no real X server).
const x11 = require('../../lib');
const { createServer, createStreamPair } = require('../../lib/xserver');

// boot({ server?, serverOptions?, clientOptions? }, cb)
// cb(err, { server, display, X })
function boot(options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    const server = options.server || createServer(options.serverOptions);
    const [clientSide, serverSide] = createStreamPair();
    server.addClientStream(serverSide);
    const clientOptions = Object.assign({ display: ':9', stream: clientSide }, options.clientOptions);
    x11.createClient(clientOptions, (err, display) => {
        if (err)
            return cb(err);
        cb(null, { server, display, X: display.client });
    });
}

// Round-trip barrier: everything sent before this was processed by the
// server once the callback runs. (Must be a request that always goes to the
// wire - GetInputFocus does, cached atom requests do not.)
function sync(X, cb) {
    X.GetInputFocus(cb);
}

module.exports = { boot, sync };
