module.exports = {
    //
    LIGHT0: 0x4000,

    // glEnable
    POSITION: 0x1203,
    CULL_FACE: 0x0B44,
    LIGHTING: 0x0B50,
    DEPTH_TEST: 0x0B71,
    NORMALIZE: 0x0BA1,

    // glShadeModel
    FLAT: 0x1D00,
    SMOOTH: 0x1D01,

    //
    TRUE: 1,
    FALSE: 0,

    // glBegin
    POINTS: 0x0000,
    LINES: 0x0001,
    LINE_LOOP: 0x0002,
    LINE_STRIP: 0x0003,
    TRIANGLES: 0x0004,
    TRIANGLES_STRIP: 0x0005,
    TRIANGLES_FAN: 0x0006,
    QUADS: 0x0007,
    QUAD_STRIP: 0x0008,
    POLYGON: 0x0009,

    // glClear
    COLOR_BUFFER_BIT: 0x00004000,
    DEPTH_BUFFER_BIT: 0x00000100,

    // glMatrixMode
    PROJECTION: 0x1701,
    MODELVIEW: 0x1700,

    // glMaterial
    FRONT: 0x0404,
    AMBIENT_AND_DIFFUSE: 0x1602,

    COMPILE: 0x1300,

    // glGetString
    RENDERER: 0x1F01,
    VERSION: 0x1F02,
    VENDOR: 0x1F00,
    EXTENSIONS: 0x1F03
}
