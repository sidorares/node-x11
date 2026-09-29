const assert = require('assert');
const x11 = require('../../lib');
const xserver = require('../../lib/xserver');

describe('xserver: listen', () => {

    it('takes connections on the loopback, and only there, unless a host is named', done => {
        const server = xserver.createServer();
        const srv = server.listen(91, () => {
            // the server asks for no credentials: nothing off this machine may reach it
            assert.strictEqual(srv.address().address, '127.0.0.1');
            const client = x11.createClient({ display: '127.0.0.1:91' }, (err, display) => {
                if (err) return done(err);
                assert.ok(display.screen[0].root > 0, 'a client connects');
                client.terminate();
                srv.close(() => done());
            });
            client.on('error', done);
        });
    });

    it('listens where it is told to', done => {
        const server = xserver.createServer();
        const srv = server.listen(92, 'localhost', () => {
            assert.ok(['127.0.0.1', '::1'].includes(srv.address().address), srv.address().address);
            srv.close(() => done());
        });
    });
});
