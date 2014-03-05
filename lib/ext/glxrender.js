// see http://cgit.freedesktop.org/mesa/mesa/tree/src/mapi/glapi/gen/gl_API.xml

var constants = require('./glxconstants');

var MAX_SMALL_RENDER=65536-16;

module.exports = function(GLX, ctx) {
    buffers = [];
    var currentLength = 0;

    function commandBuffer(opcode, len) {
        if (currentLength + len > MAX_SMALL_RENDER) {
            render();
        }
        if (len > MAX_SMALL_RENDER)
            throw Error('Buffer too big. Make sure you are using RenderLarge for large commands');

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

    function serialize2f(opcode, f1, f2) {
       var res = commandBuffer(opcode, 12);
        res.writeFloatLE(f1, 4);
        res.writeFloatLE(f2, 8);
        buffers.push(res);
    }

    function serialize2i(opcode, i1, i2) {
       var res = commandBuffer(opcode, 12);
        res.writeUInt32LE(i1, 4);
        res.writeUInt32LE(i2, 8);
        buffers.push(res);
    }

    function serialize3i(opcode, i1, i2, i3) {
       var res = commandBuffer(opcode, 16);
        res.writeUInt32LE(i1, 4);
        res.writeUInt32LE(i2, 8);
        res.writeUInt32LE(i3, 12);
        buffers.push(res);
    }

    function serialize2i1f(opcode, i1, i2, f1) {
       var res = commandBuffer(opcode, 16);
        res.writeUInt32LE(i1, 4);
        res.writeUInt32LE(i2, 8);
        res.writeFloatLE(f1, 12);
        buffers.push(res);
    }

    function serialize2ifv(opcode, i1, i2, fv) {
       var res = commandBuffer(opcode, 12 + fv.length*4);
        res.writeUInt32LE(i1, 4);
        res.writeUInt32LE(i2, 8);
        for (var i=0; i < fv.length; ++i)
          res.writeFloatLE(fv[i], 12+i*4);
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

        if (buffers.length == 0) {
          buffers = [];
          currentLength = 0;
          return;
        }

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
        },
        BindTexture: function(target, texture) {
           serialize2i(4117, target, texture);
        },
        TexEnvf: function(target, pname, param) {
            serialize2i1f(112, target, pname, param);
        },
        TexParameterf: function(target, pname, param) {
            serialize2i1f(105, target, pname, param);
        },
        TexParameterfv: function(target, pname, param) {
            serialize2ifv(106, target, pname, param);
        },
        TexParameteri: function(target, pname, param) {
            serialize3i(107, target, pname, param);
        },
        TexImage2D: function(target, level, internalFormat, width, height, border, format, type, data) {

          render();

          var typeSize = [];
          typeSize[constants.FLOAT] = 4;
          typeSize[constants.BYTE] = 1;
          typeSize[constants.UNSIGNED_BYTE] = 1;

          var res = new Buffer(60 + data.length*typeSize[type]);
          res.writeUInt32LE(res.length, 0);
          res.writeUInt32LE(110, 4);

          res[8] = 0; // swapbytes
          res[9] = 0; // lsbfirst
          res.writeUInt16LE(0, 10);   // unused 

	/*
	defaults: (from http://stackoverflow.com/questions/21563590/glteximage2d-protocol-arguments?noredirect=1#comment32577251_21563590 )

	GL_UNPACK_SWAP_BYTES        boolean   false           true or false
	GL_UNPACK_LSB_FIRST         boolean   false           true or false
	GL_UNPACK_ROW_LENGTH        integer   0               [0,oo)
	GL_UNPACK_SKIP_ROWS         integer   0               [0,oo)
	GL_UNPACK_SKIP_PIXELS       integer   0               [0,oo)
	GL_UNPACK_ALIGNMENT         integer   4               1, 2, 4, or 8

	*/

          res.writeUInt32LE(0, 12);   // rowlength
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

          switch(type) {
          case constants.FLOAT:
            for (var i=0; i < data.length; ++i)
              res.writeFloatLE(data[i], 60+i*typeSize[type]);
            break;
          case constants.BYTE:
          case constants.UNSIGNED_BYTE:
            for (var i=0; i < data.length; ++i)
              res[60+i] = data[i];
            break;
          default:
            throw new Error('unsupported texture type:' + type);
          }

          // bake sure buffer for glxRender request is emptied first 
          render();
          
          var dataLen = res.length;
          var maxSize = 262124;
          var totalRequests = 1 + parseInt(dataLen / maxSize) - 1;
          if (dataLen % maxSize)
            totalRequests++;

          // for some reason RenderLarge does not like everything to be sent in one go
          // add one extra buffer request for small requests
          if (dataLen < maxSize) {
            GLX.RenderLarge(ctx, 1, 2, res);
            GLX.RenderLarge(ctx, 2, 2, Buffer(0));
            return;
          }
       
          var pos = 0;
          var reqNum = 1;
          while(dataLen > 0) {
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
     
        ProgramString: function(target, format, src) {
          serialize3i(target, format, src);
          buffers.push(Buffer(src));
        },

        BindProgram: function(target, program) {
          serialize2i(target, format, src);
        },

        

        TexCoord2f: function(x, y) {
            serialize2f(54, x, y);
        }
    };

    // import all constants
    for (var c in constants)
        renderContext[c] = constants[c];

    // bind some glx functions
    'NewList EndList GenLists GenTextures IsTexture SwapBuffers Finish'.split(' ').forEach(function(name) {
        // todo: small camelCase ? to be consistent with webgl api
        //renderContext[name] = GLX[name].bind(GLX, ctx);

        // flush render buffer before glx requests
        renderContext[name] = function(p1, p2, p3, p4, p5, p6, p7, p8) {
            render();
            GLX[name](ctx, p1, p2, p3, p4, p5, p6, p7, p8);
        }
    });

    return renderContext;
}
