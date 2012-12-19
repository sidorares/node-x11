// see http://cgit.freedesktop.org/mesa/mesa/tree/src/mapi/glapi/gen/gl_API.xml

var constants = require('./glxconstants');

var MAX_SMALL_RENDER=65000;

module.exports = function(GLX, ctx) {
    buffers = [];
    var currentLength = 0;

    function commandBuffer(opcode, len) {
        if (currentLength + len > MAX_SMALL_RENDER) {
            console.log("Flushing buffer ", currentLength);
            render();
        }
        if (len > MAX_SMALL_RENDER)
        {
            throw Error('Buffer too big. Please implement RenderLarge request');
            // renderLarge();
        }

        currentLength += len;
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

    function serialize1f(opcode, value) {
       var res = commandBuffer(opcode, 8);
        res.writeFloatLE(value, 4);
        buffers.push(res);
    }

    function serialize2i(opcode, i1, i2) {
       var res = commandBuffer(opcode, 12);
        res.writeUInt32LE(i1, 4);
        res.writeUInt32LE(i2, 8);
        buffers.push(res);
    }

    function serialize2i4f(opcode, i1, i2, f1, f2, f3, f4) {
       var res = commandBuffer(opcode, 28);
        res.writeUInt32LE(i1, 4);
        res.writeUInt32LE(i2, 8);
        res.writeFloatLE(f1, 12);
        res.writeFloatLE(f2, 16);
        res.writeFloatLE(f3, 20);
        res.writeFloatLE(f4, 24);
        buffers.push(res);
    }

    function render(ctxLocal) {
        if (!ctxLocal) // ctxLocal overrides ctx passed during creation of renderContext
            ctxLocal = ctx;
        console.log("render called");
        GLX.Render(ctxLocal, buffers);
        buffers = [];
        currentLength = 0;
    }

    var renderContext =  {
        Render: render,
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
        Vertex3fv: function(v) {
            serialize3fv(70, v[0], v[1], v[2]);
        },
        Color3f: function(r, g, b) {
            serialize3fv(8, r, g, b);
        },
        Normal3f: function(x, y, z) {
            serialize3fv(30, x, y, z);
        },
        Normal3fv: function(v) {
            serialize3fv(70, v[0], v[1], v[2]);
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
            if (p1.length)
                serialize2i4f(87, light, name, p1[0], p1[1], p1[2], p1[3]);
            else
                serialize2i4f(87, light, name, p1, p2, p3, p4);
        },
        Materialfv: function(light, name, p1, p2, p3, p4) {
            if (p1.length)
                serialize2i4f(97, light, name, p1[0], p1[1], p1[2], p1[3]);
            else
                serialize2i4f(97, light, name, p1, p2, p3, p4);
        },
        Clear: function(mask) {
            serialize1i(0x7f, mask);
        },
        ShadeModel: function(model) {
            serialize1i(104, model);
        },
        BlendFunc: function(sfactor, dfactor) {
            serialize2i(160, sfactor, dfactor);
        },
        PointSize: function(r) {
            serialize1f(100, r);
        },
        Hint: function(target, mode) {
            serialize2i(85, target, mode);
        }
    };

    // import all constants
    for (var c in constants)
        renderContext[c] = constants[c];

    // bind some glx functions
    'NewList EndList GenLists SwapBuffers Finish'.split(' ').forEach(function(name) {
        // todo: small camelCase ? to be consistent with webgl api
        //renderContext[name] = GLX[name].bind(GLX, ctx);

        // flush render buffer before glx requests
        renderContext[name] = function(p1, p2, p3, p4, p5, p6, p7, p8) {
            console.log(name);
            renderContext.render();
            GLX[name](ctx, p1, p2, p3, p4, p5, p6, p7, p8);
        }
    });

    return renderContext;
}
