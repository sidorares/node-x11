'use strict';

// X protocol error codes + the exception type request handlers throw.
// The dispatcher catches XError and turns it into an error packet with the
// right sequence number / major opcode (see server.js handleRequest).

const codes = {
    Request: 1,
    Value: 2,
    Window: 3,
    Pixmap: 4,
    Atom: 5,
    Cursor: 6,
    Font: 7,
    Match: 8,
    Drawable: 9,
    Access: 10,
    Alloc: 11,
    Colormap: 12,
    GContext: 13,
    IDChoice: 14,
    Name: 15,
    Length: 16,
    Implementation: 17
};

class XError extends Error {
    constructor(code, badValue, minor) {
        super(`X error ${code}`);
        this.isXError = true;
        this.code = code;
        this.badValue = badValue || 0;
        this.minor = minor || 0;
    }
}

module.exports = { XError, codes };
