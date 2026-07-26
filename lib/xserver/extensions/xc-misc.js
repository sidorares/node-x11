'use strict';

// XC-MISC: resource id range recycling helpers.

const { XError, codes } = require('../errors');

module.exports = {
    name: 'XC-MISC',
    eventsCount: 0,
    errorsCount: 0,

    handleRequest(server, client, minor, body) {
        switch (minor) {
            case 0: { // GetVersion
                const b = client.startReply(0, 0);
                b.writeUInt16LE(1, 8);   // major
                b.writeUInt16LE(1, 10);  // minor
                client.send(b);
                break;
            }
            case 1: { // GetXIDRange
                const b = client.startReply(0, 0);
                b.writeUInt32LE((client.resourceBase + 1) >>> 0, 8);
                b.writeUInt32LE(client.resourceMask - 1, 12);
                client.send(b);
                break;
            }
            case 2: { // GetXIDList
                const count = Math.min(body.readUInt32LE(0), 4096);
                const b = client.startReply(count, 0);
                b.writeUInt32LE(count, 8);
                for (let i = 0; i < count; i++)
                    b.writeUInt32LE((client.resourceBase + 1 + i) >>> 0, 32 + i * 4);
                client.send(b);
                break;
            }
            default:
                throw new XError(codes.Implementation, minor);
        }
    }
};
