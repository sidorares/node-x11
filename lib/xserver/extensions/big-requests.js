'use strict';

// BIG-REQUESTS: the client enables it during createClient by default.
// Extended-length request framing itself (16-bit length 0 -> 32-bit length
// word) is always accepted by the server framing layer; Enable just reports
// the maximum request size.

const { XError, codes } = require('../errors');

// 4 MiB in 4-byte units
const MAX_REQUEST_LENGTH = 0x100000;

module.exports = {
    name: 'BIG-REQUESTS',
    eventsCount: 0,
    errorsCount: 0,

    handleRequest(server, client, minor, body) {
        if (minor !== 0) // Enable is the only request
            throw new XError(codes.Implementation, minor);
        client.bigRequestsEnabled = true;
        const b = client.startReply(0, 0);
        b.writeUInt32LE(MAX_REQUEST_LENGTH, 8);
        client.send(b);
    }
};
