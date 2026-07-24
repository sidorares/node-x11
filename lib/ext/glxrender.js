// GL render-command serializer for the GLX Render/RenderLarge requests.
// Command opcodes are X_GLrop_* from GL/glxproto.h; see also
// http://cgit.freedesktop.org/mesa/mesa/tree/src/mapi/glapi/gen/gl_API.xml

const constants = require('./glxconstants');

const MAX_SMALL_RENDER = 65536 - 16;

module.exports = (GLX, ctx) => {
    let buffers = [];
    let currentLength = 0;

    function commandBuffer(opcode, len) {
        if (currentLength + len > MAX_SMALL_RENDER) {
            render();
        }
        if (len > MAX_SMALL_RENDER)
            throw Error('Buffer too big. Make sure you are using RenderLarge for large commands');

        currentLength += len;
        const res = Buffer.alloc(len);
        res.writeUInt16LE(len, 0);
        res.writeUInt16LE(opcode, 2);
        return res;
    }

    function serialize0(opcode) {
        buffers.push(commandBuffer(opcode, 4));
    }

    function serialize3fv(opcode, c1, c2, c3) {
        const res = commandBuffer(opcode, 16);
        res.writeFloatLE(c1, 4);
        res.writeFloatLE(c2, 8);
        res.writeFloatLE(c3, 12);
        buffers.push(res);
    }

    function serialize4fv(opcode, c1, c2, c3, c4) {
        const res = commandBuffer(opcode, 20);
        res.writeFloatLE(c1, 4);
        res.writeFloatLE(c2, 8);
        res.writeFloatLE(c3, 12);
        res.writeFloatLE(c4, 16);
        buffers.push(res);
    }

    function serialize4i(opcode, c1, c2, c3, c4) {
        const res = commandBuffer(opcode, 20);
        res.writeInt32LE(c1, 4);
        res.writeInt32LE(c2, 8);
        res.writeInt32LE(c3, 12);
        res.writeInt32LE(c4, 16);
        buffers.push(res);
    }

    function serialize6d(opcode, d1, d2, d3, d4, d5, d6) {
        const res = commandBuffer(opcode, 52);
        res.writeDoubleLE(d1, 4);
        res.writeDoubleLE(d2, 12);
        res.writeDoubleLE(d3, 20);
        res.writeDoubleLE(d4, 28);
        res.writeDoubleLE(d5, 36);
        res.writeDoubleLE(d6, 44);
        buffers.push(res);
    }

    function serialize1d(opcode, d1) {
        const res = commandBuffer(opcode, 12);
        res.writeDoubleLE(d1, 4);
        buffers.push(res);
    }

    function serialize2i(opcode, value1, value2) {
        const res = commandBuffer(opcode, 12);
        res.writeUInt32LE(value1 >>> 0, 4);
        res.writeUInt32LE(value2 >>> 0, 8);
        buffers.push(res);
    }

    function serialize1i(opcode, value) {
        const res = commandBuffer(opcode, 8);
        res.writeUInt32LE(value >>> 0, 4);
        buffers.push(res);
    }

    function serialize1f(opcode, value) {
        const res = commandBuffer(opcode, 8);
        res.writeFloatLE(value, 4);
        buffers.push(res);
    }

    function serialize2f(opcode, f1, f2) {
        const res = commandBuffer(opcode, 12);
        res.writeFloatLE(f1, 4);
        res.writeFloatLE(f2, 8);
        buffers.push(res);
    }

    function serialize3i(opcode, i1, i2, i3) {
        const res = commandBuffer(opcode, 16);
        res.writeUInt32LE(i1 >>> 0, 4);
        res.writeUInt32LE(i2 >>> 0, 8);
        res.writeUInt32LE(i3 >>> 0, 12);
        buffers.push(res);
    }

    function serialize1i1f(opcode, i1, f1) {
        const res = commandBuffer(opcode, 12);
        res.writeUInt32LE(i1 >>> 0, 4);
        res.writeFloatLE(f1, 8);
        buffers.push(res);
    }

    function serialize2i1f(opcode, i1, i2, f1) {
        const res = commandBuffer(opcode, 16);
        res.writeUInt32LE(i1 >>> 0, 4);
        res.writeUInt32LE(i2 >>> 0, 8);
        res.writeFloatLE(f1, 12);
        buffers.push(res);
    }

    function serialize2ifv(opcode, i1, i2, fv) {
        const res = commandBuffer(opcode, 12 + fv.length * 4);
        res.writeUInt32LE(i1 >>> 0, 4);
        res.writeUInt32LE(i2 >>> 0, 8);
        for (let i = 0; i < fv.length; ++i)
            res.writeFloatLE(fv[i], 12 + i * 4);
        buffers.push(res);
    }

    function serialize2i4f(opcode, i1, i2, f1, f2, f3, f4) {
        const res = commandBuffer(opcode, 28);
        res.writeUInt32LE(i1 >>> 0, 4);
        res.writeUInt32LE(i2 >>> 0, 8);
        res.writeFloatLE(f1, 12);
        res.writeFloatLE(f2, 16);
        res.writeFloatLE(f3, 20);
        res.writeFloatLE(f4, 24);
        buffers.push(res);
    }

    function serialize16f(opcode, m) {
        const res = commandBuffer(opcode, 68);
        for (let i = 0; i < 16; ++i)
            res.writeFloatLE(m[i], 4 + i * 4);
        buffers.push(res);
    }

    function render(ctxLocal) {
        if (!ctxLocal) // ctxLocal overrides ctx passed during creation of renderContext
            ctxLocal = ctx;

        if (buffers.length == 0) {
            currentLength = 0;
            return;
        }

        GLX.Render(ctxLocal, buffers);
        buffers = [];
        currentLength = 0;
    }

    const renderContext = {
        Render: render,
        Begin(what) {
            serialize1i(4, what);
        },
        End() {
            serialize0(23);
        },
        Ortho(left, right, bottom, top, znear, zfar) {
            serialize6d(182, left, right, bottom, top, znear, zfar);
        },
        Frustum(left, right, bottom, top, znear, zfar) {
            serialize6d(175, left, right, bottom, top, znear, zfar);
        },
        PopMatrix() {
            serialize0(183);
        },
        PushMatrix() {
            serialize0(184);
        },
        LoadIdentity() {
            serialize0(176);
        },
        LoadMatrixf(m) {
            serialize16f(177, m);
        },
        MultMatrixf(m) {
            serialize16f(180, m);
        },
        Rotatef(a, x, y, z) {
            serialize4fv(186, a, x, y, z);
        },
        CallList(list) {
            serialize1i(1, list);
        },
        ListBase(base) {
            serialize1i(3, base);
        },
        Viewport(x, y, w, h) {
            serialize4i(191, x, y, w, h);
        },
        Vertex2f(x, y) {
            serialize2f(66, x, y);
        },
        Vertex3f(x, y, z) {
            serialize3fv(70, x, y, z);
        },
        Vertex3fv(v) {
            serialize3fv(70, v[0], v[1], v[2]);
        },
        Color3f(r, g, b) {
            serialize3fv(8, r, g, b);
        },
        Normal3f(x, y, z) {
            serialize3fv(30, x, y, z);
        },
        Normal3fv(v) {
            serialize3fv(30, v[0], v[1], v[2]);
        },
        Color4f(r, g, b, a) {
            serialize4fv(16, r, g, b, a);
        },
        RasterPos2f(x, y) {
            serialize2f(34, x, y);
        },
        Rectf(x1, y1, x2, y2) {
            serialize4fv(46, x1, y1, x2, y2);
        },
        Scalef(x, y, z) {
            serialize3fv(188, x, y, z);
        },
        Translatef(x, y, z) {
            serialize3fv(190, x, y, z);
        },
        ClearColor(r, g, b, a) {
            serialize4fv(130, r, g, b, a);
        },
        ClearDepth(depth) {
            serialize1d(132, depth);
        },
        ClearStencil(s) {
            serialize1i(131, s);
        },
        MatrixMode(mode) {
            serialize1i(179, mode);
        },
        Enable(value) {
            serialize1i(139, value);
        },
        Disable(value) {
            serialize1i(138, value);
        },
        ColorMaterial(face, mode) {
            serialize2i(78, face, mode);
        },
        CullFace(mode) {
            serialize1i(79, mode);
        },
        FrontFace(mode) {
            serialize1i(84, mode);
        },
        Fogf(pname, param) {
            serialize1i1f(80, pname, param);
        },
        Fogfv(pname, fv) {
            const res = commandBuffer(81, 8 + fv.length * 4);
            res.writeUInt32LE(pname >>> 0, 4);
            for (let i = 0; i < fv.length; ++i)
                res.writeFloatLE(fv[i], 8 + i * 4);
            buffers.push(res);
        },
        Lightfv(light, name, p1, p2, p3, p4) {
            if (p1.length)
                serialize2i4f(87, light, name, p1[0], p1[1], p1[2], p1[3]);
            else
                serialize2i4f(87, light, name, p1, p2, p3, p4);
        },
        LightModelf(pname, param) {
            serialize1i1f(90, pname, param);
        },
        Materialfv(face, name, p1, p2, p3, p4) {
            if (p1.length)
                serialize2i4f(97, face, name, p1[0], p1[1], p1[2], p1[3]);
            else
                serialize2i4f(97, face, name, p1, p2, p3, p4);
        },
        Clear(mask) {
            serialize1i(127, mask);
        },
        ShadeModel(model) {
            serialize1i(104, model);
        },
        AlphaFunc(func, ref) {
            serialize1i1f(159, func, ref);
        },
        BlendFunc(sfactor, dfactor) {
            serialize2i(160, sfactor, dfactor);
        },
        LogicOp(opcode) {
            serialize1i(161, opcode);
        },
        StencilFunc(func, ref, mask) {
            serialize3i(162, func, ref, mask);
        },
        StencilOp(fail, zfail, zpass) {
            serialize3i(163, fail, zfail, zpass);
        },
        StencilMask(mask) {
            serialize1i(133, mask);
        },
        DepthFunc(func) {
            serialize1i(164, func);
        },
        DepthMask(flag) {
            serialize1i(135, flag ? 1 : 0);
        },
        LineWidth(w) {
            serialize1f(95, w);
        },
        LineStipple(factor, pattern) {
            serialize2i(94, factor, pattern);
        },
        PointSize(r) {
            serialize1f(100, r);
        },
        PolygonMode(face, mode) {
            serialize2i(101, face, mode);
        },
        Scissor(x, y, w, h) {
            serialize4i(103, x, y, w, h);
        },
        DrawBuffer(mode) {
            serialize1i(126, mode);
        },
        ReadBuffer(mode) {
            serialize1i(171, mode);
        },
        Hint(target, mode) {
            serialize2i(85, target, mode);
        },
        BindTexture(target, texture) {
            serialize2i(4117, target, texture);
        },
        TexEnvf(target, pname, param) {
            serialize2i1f(111, target, pname, param);
        },
        TexEnvi(target, pname, param) {
            serialize3i(113, target, pname, param);
        },
        TexGeni(coord, pname, param) {
            serialize3i(119, coord, pname, param);
        },
        TexGenfv(coord, pname, fv) {
            serialize2ifv(118, coord, pname, fv);
        },
        ColorMask(r, g, b, a) {
            const res = commandBuffer(134, 8);
            res[4] = r ? 1 : 0;
            res[5] = g ? 1 : 0;
            res[6] = b ? 1 : 0;
            res[7] = a ? 1 : 0;
            buffers.push(res);
        },
        TexParameterf(target, pname, param) {
            serialize2i1f(105, target, pname, param);
        },
        TexParameterfv(target, pname, param) {
            serialize2ifv(106, target, pname, param);
        },
        TexParameteri(target, pname, param) {
            serialize3i(107, target, pname, param);
        },
        TexImage2D(target, level, internalFormat, width, height, border, format, type, data) {
            const typeSize = [];
            typeSize[constants.FLOAT] = 4;
            typeSize[constants.BYTE] = 1;
            typeSize[constants.UNSIGNED_BYTE] = 1;
            if (!typeSize[type])
                throw new Error(`unsupported texture type:${type}`);

            // large render command: 4-byte total length, 4-byte opcode,
            // 20 bytes of pixel-unpack state, then the TexImage2D payload
            const res = Buffer.alloc(60 + data.length * typeSize[type]);
            res.writeUInt32LE(res.length, 0);
            res.writeUInt32LE(110, 4);

            res[8] = 0; // swapbytes
            res[9] = 0; // lsbfirst
            res.writeUInt16LE(0, 10);  // unused
            res.writeUInt32LE(0, 12);  // rowlength
            res.writeUInt32LE(0, 16);  // skiprows
            res.writeUInt32LE(0, 20);  // skippixels
            res.writeUInt32LE(4, 24);  // alignment

            res.writeUInt32LE(target, 28);
            res.writeUInt32LE(level, 32);
            res.writeUInt32LE(internalFormat, 36);
            res.writeUInt32LE(width, 40);
            res.writeUInt32LE(height, 44);
            res.writeUInt32LE(border, 48);
            res.writeUInt32LE(format, 52);
            res.writeUInt32LE(type, 56);

            switch (type) {
            case constants.FLOAT:
                for (let i = 0; i < data.length; ++i)
                    res.writeFloatLE(data[i], 60 + i * 4);
                break;
            case constants.BYTE:
            case constants.UNSIGNED_BYTE:
                for (let i = 0; i < data.length; ++i)
                    res[60 + i] = data[i];
                break;
            }

            // make sure buffer for glxRender request is emptied first
            render();

            let dataLen = res.length;
            const maxSize = 262124;
            let totalRequests = Math.floor(dataLen / maxSize);
            if (dataLen % maxSize)
                totalRequests++;

            // for some reason RenderLarge does not like everything to be sent
            // in one go - add one extra empty request for small requests
            if (dataLen < maxSize) {
                GLX.RenderLarge(ctx, 1, 2, res);
                GLX.RenderLarge(ctx, 2, 2, Buffer.alloc(0));
                return;
            }

            let pos = 0;
            let reqNum = 1;
            while (dataLen > 0) {
                if (dataLen < maxSize) {
                    GLX.RenderLarge(ctx, reqNum, totalRequests, res.slice(pos));
                    break;
                } else {
                    GLX.RenderLarge(ctx, reqNum, totalRequests, res.slice(pos, pos + maxSize));
                    pos += maxSize;
                    dataLen -= maxSize;
                    reqNum++;
                }
            }
        },

        // GL_ARB_vertex_program / GL_ARB_fragment_program
        ProgramString(target, format, src) {
            const len = src.length;
            const padded = (len + 3) & ~3;
            const res = commandBuffer(4217, 16 + padded);
            res.writeUInt32LE(target >>> 0, 4);
            res.writeUInt32LE(format >>> 0, 8);
            res.writeUInt32LE(len, 12);
            res.write(src, 16, 'latin1');
            buffers.push(res);
        },

        BindProgram(target, program) {
            serialize2i(4180, target, program);
        },

        TexCoord2f(x, y) {
            serialize2f(54, x, y);
        }
    };

    // import all constants
    for (const c in constants)
        renderContext[c] = constants[c];

    // bind some glx requests: flush pending render commands first, then
    // issue the request with the pipeline's context tag pre-bound
    'NewList EndList DeleteLists GenLists GenTextures DeleteTextures IsTexture SwapBuffers Finish Flush'.split(' ').forEach(name => {
        renderContext[name] = (p1, p2, p3, p4, p5, p6, p7, p8) => {
            render();
            GLX[name](ctx, p1, p2, p3, p4, p5, p6, p7, p8);
        };
    });

    return renderContext;
};
