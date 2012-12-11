// see http://cgit.freedesktop.org/mesa/mesa/tree/src/mapi/glapi/gen/gl_API.xml

module.exports = function(GLX) {
    buffers = [];

    function commandBuffer(opcode, len) {
        var res = Buffer(len);
        res.writeUInt16LE(len, 0);
        res.writeUInt16LE(opcode, 2);
        return res;
    }

    function serialize0(opcode) {
        buffers.push(commandBuffer(opcode, 4));
    }

    function serialize3fv(opcode, c1, c2, c3) {
        var res = commandBuffer(opcode, 16);
        res.writeFloatLE(c1, 4);
        res.writeFloatLE(c2, 8);
        res.writeFloatLE(c3, 12);
        buffers.push(res);
    }

    function serialize4fv(opcode, c1, c2, c3, c4) {
        var res = commandBuffer(opcode, 20);
        res.writeFloatLE(c1, 4);
        res.writeFloatLE(c2, 8);
        res.writeFloatLE(c3, 12);
        res.writeFloatLE(c4, 16);
        buffers.push(res);
    }

    function serialize4i(opcode, c1, c2, c3, c4) {
        var res = commandBuffer(opcode, 20);
        res.writeInt32LE(c1, 4);
        res.writeInt32LE(c2, 8);
        res.writeInt32LE(c3, 12);
        res.writeInt32LE(c4, 16);
        buffers.push(res);
    }

    function serialize6d(opcode, d1, d2, d3, d4, d5, d6)
    {
        var res = commandBuffer(opcode, 52);
        res.writeDoubleLE(d1, 4);
        res.writeDoubleLE(d2, 12);
        res.writeDoubleLE(d3, 20);
        res.writeDoubleLE(d4, 28);
        res.writeDoubleLE(d5, 36);
        res.writeDoubleLE(d6, 44);
        buffers.push(res);
    };

    function serialize2i(opcode, value1, value2) {
       var res = commandBuffer(opcode, 12);
        res.writeUInt32LE(value1, 4);
        res.writeUInt32LE(value2, 8);
        buffers.push(res);
    }

    function serialize1i(opcode, value) {
       var res = commandBuffer(opcode, 8);
        res.writeUInt32LE(value, 4);
        buffers.push(res);
    }

    return {
        render: function(ctx) {
            GLX.Render(ctx, buffers);
            buffers = [];
        },
        Begin: function(what) {
            serialize1i(4, what);
        },
        End: function() {
            serialize0(23);
        },
        Ortho: function(left, right, bottom, top, znear, zfar) {
            serialize6d(182, left, right, bottom, top, znear, zfar);
        },
        Frustum: function(left, right, bottom, top, znear, zfar) {
            serialize6d(182, left, right, bottom, top, znear, zfar);
        },
        PopMatrix: function() {
            serialize0(183);
        },
        PushMatrix: function() {
            serialize0(184);
        },
        LoadIdentity: function() {
            serialize0(176);
        },
        Rotatef: function(a, x, y, z) {
            serialize4fv(186, a, x, y, z);
        },
        CallList: function(list) {
            serialize1i(1, list);
        },
        Viewport: function(x, y, w, h) {
            serialize4i(191, x, y, w, h); // TODO: x,y - signed, w,h - unsigned (currently all 4 unsigned)
        },
        Vertex3f: function(x, y, z) {
            serialize3fv(70, x, y, z);
        },
        Color3f: function(r, g, b) {
            serialize3fv(8, r, g, b);
        },
        Color4f: function(r, g, b, a) {
            serialize4fv(16, r, g, b, a);
        },
        Scalef: function(x, y, z) {
            serialize3fv(188, x, y, z);
        },
        Translatef: function(x, y, z) {
           serialize3fv(190, x, y, z);
        },
        ClearColor: function(r, g, b, a) {
            serialize4fv(0x82, r, g, b, a);
        },
        MatrixMode: function(mode) {
            serialize1i(179, mode);
        },
        Enable: function(value) {
            serialize1i(139, value);
        },
        Lightfv: function(light, name, p1, p2, p3, p4) {
            seralize2i4f(87, light, name, p1, p2, p3, p4);
        },
        Clear: function(mask) {
            serialize1i(0x7f, mask);
        },
        ShadeModel: function(model) {
            serialize1i(104, model);
        },
        Hint: function(target, mode) {
            serialize2i(85, target, mode);
        }
    };
}
