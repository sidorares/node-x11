// based on https://github.com/substack/node-rfb
exports.clientMsgTypes = {
    setPixelFormat : 0,
    setEncodings : 2,
    fbUpdate : 3,
    keyEvent : 4,
    pointerEvent : 5,
    cutText : 6,
};

exports.serverMsgTypes = {
    fbUpdate : 0,
    setColorMap : 1,
    bell: 2,
    cutText: 3,
};

exports.versionstring = {
   V3_003: 'RFB 003.003\n',   
   V3_007: 'RFB 003.007\n',   
   V3_008: 'RFB 003.008\n'   
};

exports.encodings = {
    raw : 0,
    copyRect : 1,
    rre : 2,
    hextile : 5,
    zrle : 16,
    pseudoCursor : -239,
    pseudoDesktopSize : -223,
};

exports.subEncodings = {
};

exports.subEncodings.hextile = {
    raw: 1,
    backgroundSpecified: 2,
    foregroundSpecified: 4,
    anySubrects: 8,
    subrectsColored: 16
}

exports.security = {   
    None: 1,
    VNC: 2
};

exports.connectionFlag = {
    Exclusive: 0,
    Shared: 1
}
