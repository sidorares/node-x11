// Browser stub for node's `net`. The client only reaches for real sockets
// when no custom transport is used; the demo runner always registers the
// 'demo' display protocol, so these should never be called.
module.exports = {
    createConnection() {
        throw new Error('net.createConnection is not available in the browser');
    },
    createServer() {
        throw new Error('net.createServer is not available in the browser');
    }
};
